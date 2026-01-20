import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { appendMessageToSheet, appendOrderToSheet, appendReviewToSheet, appendFeedbackToSheet, syncProductsToSheet, isSheetsConfigured } from "./googleSheets.js";
import squarePkg from "square";
const SquareClient = squarePkg.SquareClient || squarePkg.Client;
const SquareEnvironment = squarePkg.SquareEnvironment || squarePkg.Environment;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

// Serve the static frontend when deployed together (optional).
const FRONTEND_DIR = path.join(__dirname, "../frontend");
const FRONTEND_INDEX = path.join(FRONTEND_DIR, "index.html");
const HAS_FRONTEND = fs.existsSync(FRONTEND_INDEX);
if(HAS_FRONTEND){
  // Disable automatic index so we can customize "/" behavior.
  app.use(express.static(FRONTEND_DIR, { index: false, extensions: ["html"] }));
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

function readEnvFirst(...names){
  for(const name of names){
    const value = String(process.env[name] || "").trim();
    if(value) return value;
  }
  return "";
}

function getSquareEnvironment(){
  const valueRaw = String(process.env.SQUARE_ENV || "").trim().toLowerCase();
  if(valueRaw === "sandbox") return SquareEnvironment.Sandbox;
  return SquareEnvironment.Production;
}

const squareAccessToken = readEnvFirst("SQUARE_ACCESS_TOKEN", "SQUARE_TOKEN", "SQUARE_ACCESS");
const squareLocationId = readEnvFirst("SQUARE_LOCATION_ID", "SQUARE_LOCATIONID", "SQUARE_LOCATION", "SQUARE_LOC_ID");
const siteUrl = readEnvFirst("SITE_URL", "FRONTEND_URL", "PUBLIC_SITE_URL");
const squareEnvRaw = String(process.env.SQUARE_ENV || "").trim().toLowerCase();
const squareEnvMode = squareEnvRaw === "sandbox" ? "sandbox" : (squareEnvRaw === "production" ? "production" : "auto");
const squareClientSandbox = squareAccessToken
  ? new SquareClient({ accessToken: squareAccessToken, environment: SquareEnvironment.Sandbox })
  : null;
const squareClientProduction = squareAccessToken
  ? new SquareClient({ accessToken: squareAccessToken, environment: SquareEnvironment.Production })
  : null;

function getSquareClientCandidates(){
  if(squareEnvMode === "sandbox") return squareClientSandbox ? [squareClientSandbox] : [];
  if(squareEnvMode === "production") return squareClientProduction ? [squareClientProduction] : [];
  const out = [];
  if(squareClientSandbox) out.push(squareClientSandbox);
  if(squareClientProduction) out.push(squareClientProduction);
  return out;
}

function isSquareAuthError(err){
  const status = Number(err?.statusCode || err?.status || err?.httpStatusCode || 0);
  if(status === 401) return true;
  const body = err?.body || err?.result || err?.data || err?.responseBody || null;
  const errors = Array.isArray(body?.errors)
    ? body.errors
    : Array.isArray(err?.errors)
      ? err.errors
      : [];
  return errors.some((e)=> {
    const category = String(e?.category || "").toUpperCase();
    const code = String(e?.code || "").toUpperCase();
    return category === "AUTHENTICATION_ERROR" || code === "UNAUTHORIZED";
  });
}

async function withSquareClient(fn){
  const candidates = getSquareClientCandidates();
  if(!candidates.length){
    const error = new Error("Square client not configured.");
    error.statusCode = 400;
    throw error;
  }
  let lastErr = null;
  for(let i = 0; i < candidates.length; i++){
    const client = candidates[i];
    try{
      return await fn(client);
    }catch(err){
      lastErr = err;
      if(!isSquareAuthError(err) || i === candidates.length - 1) throw err;
    }
  }
  throw lastErr || new Error("Square request failed.");
}

// ---- DB helpers ----
const DB_PATH = path.join(__dirname, "db.json");
const COMPANY_NAME = process.env.COMPANY_NAME || "Power Poly Supplies";
const COMPANY_SLOGAN = process.env.COMPANY_SLOGAN || "Premium garment packaging and hanger supplies.";
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || process.env.EMAIL_USER || "";
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || "";
const COMPANY_LOGO_PATH = process.env.COMPANY_LOGO_PATH
  || path.join(__dirname, "../frontend/assets/logo.jpg");

app.get("/", (req,res)=>{
  if(HAS_FRONTEND){
    return res.sendFile(FRONTEND_INDEX);
  }
  res.status(200).send("OK. Try /api/health");
});

function readDB(){
  try{
    return JSON.parse(fs.readFileSync(DB_PATH,"utf-8"));
  }catch(err){
    console.error("Failed to read DB", err);
    return { products:[], orders:[], messages:[], reviews:[], users:[] };
  }
}
function writeDB(db){
  try{
    fs.writeFileSync(DB_PATH, JSON.stringify(db,null,2));
  }catch(err){
    console.error("Failed to write DB", err);
  }
}

function requireSupabase(res){
  if(!supabase){
    res.status(500).json({ ok:false, message:"Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." });
    return false;
  }
  return true;
}

function normalizeProductRow(row){
  if(!row) return row;
  return {
    ...row,
    priceCents: row.price_cents ?? row.priceCents,
    description_fr: row.description_fr ?? row.descriptionFr,
    description_ko: row.description_ko ?? row.descriptionKo,
    description_hi: row.description_hi ?? row.descriptionHi,
    description_ta: row.description_ta ?? row.descriptionTa,
    description_es: row.description_es ?? row.descriptionEs
  };
}

function normalizeOrderRow(row){
  if(!row) return row;
  return {
    ...row,
    totalCents: row.total_cents ?? row.totalCents,
    paymentMethod: row.payment_method ?? row.paymentMethod,
    createdAt: row.created_at ?? row.createdAt
  };
}

function normalizeReviewRow(row){
  if(!row) return row;
  return {
    ...row,
    productId: row.product_id ?? row.productId,
    createdAt: row.created_at ?? row.createdAt
  };
}

function normalizeMessageRow(row){
  if(!row) return row;
  return {
    ...row,
    createdAt: row.created_at ?? row.createdAt
  };
}

function normalizeUserRow(row){
  if(!row) return row;
  return {
    ...row,
    passwordHash: row.password_hash ?? row.passwordHash,
    createdAt: row.created_at ?? row.createdAt,
    lastLoginAt: row.last_login_at ?? row.lastLoginAt,
    firstLoginAt: row.first_login_at ?? row.firstLoginAt,
    welcomeEmailSent: row.welcome_email_sent ?? row.welcomeEmailSent
  };
}

async function fetchProducts(){
  const { data, error } = await supabase.from("products").select("*");
  if(error) throw error;
  return (data || []).map(normalizeProductRow);
}

async function fetchProductsByIds(ids){
  if(!ids.length) return [];
  const { data, error } = await supabase.from("products").select("*").in("id", ids);
  if(error) throw error;
  return (data || []).map(normalizeProductRow);
}

const PROVINCE_TAX_LABELS = {
  ON: "HST 13%",
  NS: "HST 15%",
  NB: "HST 15%",
  NL: "HST 15%",
  PE: "HST 15%",
  AB: "GST 5%",
  BC: "GST 5%",
  SK: "GST 5%",
  MB: "GST 5%",
  QC: "GST 5%",
  YT: "GST 5%",
  NT: "GST 5%",
  NU: "GST 5%"
};

const PROVINCE_TAX_RATES = {
  ON: { rate: 0.13 },
  NS: { rate: 0.15 },
  NB: { rate: 0.15 },
  NL: { rate: 0.15 },
  PE: { rate: 0.15 },
  AB: { rate: 0.05 },
  BC: { rate: 0.05 },
  SK: { rate: 0.05 },
  MB: { rate: 0.05 },
  QC: { rate: 0.05, qstRate: 0.09975 },
  YT: { rate: 0.05 },
  NT: { rate: 0.05 },
  NU: { rate: 0.05 }
};

function formatMoney(cents, currency){
  return `${(Number(cents || 0) / 100).toFixed(2)} ${currency || "CAD"}`;
}

function getTieredPriceCents(product, qty){
  if(!product) return 0;
  const base = Math.round(Number(product.priceCents) || 0);
  if((product.category || "") === "Garment Bags"){
    const count = Math.max(0, Number(qty) || 0);
    if(count >= 20) return 3699;
    if(count >= 15) return 3799;
    if(count >= 10) return 3899;
  }
  return base;
}

function calculateTaxCents(subtotalCents, provinceCode){
  const info = PROVINCE_TAX_RATES[provinceCode] || { rate: 0 };
  const gstAmount = Math.round(subtotalCents * info.rate);
  const qstAmount = info.qstRate ? Math.round(subtotalCents * info.qstRate) : 0;
  return {
    taxCents: gstAmount + qstAmount,
    gstAmount,
    qstAmount
  };
}

function normalizePostal(value){
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getShippingForPostal(postal){
  const clean = normalizePostal(postal);
  if(!clean){
    return { zone: "Unknown", label: "Delivery charges - Contact us", amountCents: 0 };
  }
  const prefix = clean[0];
  if(prefix === "M" || prefix === "L"){
    return { zone: "GTA", label: "Standard delivery (GTA) - Free", amountCents: 0 };
  }
  return { zone: "Canada", label: "Delivery charges - Contact us", amountCents: 0 };
}

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getReceiptLabels(language){
  const lang = language === "fr" ? "fr" : "en";
  if(lang === "fr"){
    return {
    item: "Article",
    qty: "Qt",
    price: "Prix",
    line: "Total",
    subtotal: "Sous-total",
    total: "Total",
    orderId: "ID de commande",
    province: "Province",
    address: "Adresse",
    customer: "Client",
    email: "Courriel",
    phone: "Telephone"
    };
  }
  if(lang === "ko"){
    return {
      item: "Item",
      qty: "Qty",
      price: "Price",
      line: "Line Total",
      subtotal: "Subtotal",
      total: "Total",
      orderId: "Order ID",
      province: "Province",
      address: "Address",
      customer: "Customer",
      email: "Email",
      phone: "Phone"
    };
  }
  return {
    item: "Item",
    qty: "Qty",
    price: "Price",
    line: "Line Total",
    subtotal: "Subtotal",
    total: "Total",
    orderId: "Order ID",
    province: "Province",
    address: "Address",
    customer: "Customer",
    email: "Email",
    phone: "Phone"
  };
}

function buildReceiptHtml({
  orderId,
  customer,
  items,
  subtotalCents,
  taxCents,
  totalCents,
  currency,
  taxLabel,
  headerText,
  introText,
  logoCid,
  logoExists,
  language
}){
  const labels = getReceiptLabels(language);
  const safeName = escapeHtml(customer?.name || "");
  const safeEmail = escapeHtml(customer?.email || "");
  const safePhone = escapeHtml(customer?.phone || "");
  const addressParts = [
    customer?.address1 || "",
    customer?.address2 || "",
    customer?.city || "",
    customer?.province || "",
    customer?.postal || ""
  ].map(part=> String(part || "").trim()).filter(Boolean);
  const safeAddress = escapeHtml(addressParts.join(", "));
  const safeProvince = escapeHtml(customer?.province || "");
  const savingsCents = (items || []).reduce((sum, item) => {
    const base = Number(item.priceCentsBase ?? item.priceCents ?? 0);
    const current = Number(item.priceCents ?? 0);
    const diff = Math.max(0, base - current);
    return sum + (diff * (Number(item.qty) || 0));
  }, 0);
  const savingsRow = savingsCents > 0
    ? `
      <tr>
        <td style="padding:6px 0; color:#6b7280;">You saved</td>
        <td style="padding:6px 0; text-align:right;">${formatMoney(savingsCents, currency)}</td>
      </tr>
    `
    : "";
  const lines = (items || []).map((item) => {
    const lineTotal = item.priceCents * item.qty;
    const desc = (language === "fr"
      ? (item.description_fr || item.description || "")
      : language === "ko"
        ? (item.description_ko || item.description || "")
        : (item.description || item.description_fr || item.description_ko || "")
    ).trim();
    const shortDesc = desc
      ? (desc.split(/[.!?]/)[0] || desc).trim()
      : "";
    const trimmedDesc = shortDesc.length > 120 ? `${shortDesc.slice(0, 120)}...` : shortDesc;
    const descHtml = trimmedDesc
      ? `<div style="margin-top:4px; font-size:12px; color:#6b7280;">${escapeHtml(trimmedDesc)}</div>`
      : "";
    return `
      <tr>
        <td style="padding:8px 0;">${escapeHtml(item.name)}${descHtml}</td>
        <td style="padding:8px 0; text-align:center;">${item.qty}</td>
        <td style="padding:8px 0; text-align:right;">${formatMoney(item.priceCents, currency)}</td>
        <td style="padding:8px 0; text-align:right;">${formatMoney(lineTotal, currency)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div style="font-family:Arial,sans-serif; color:#1f2933; max-width:680px; margin:0 auto; line-height:1.5;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:2px solid #e5e7eb; padding-bottom:16px; margin-bottom:16px;">
        <div>
          <div style="font-size:20px; font-weight:700;">${COMPANY_NAME}</div>
          <div style="font-size:13px; color:#6b7280;">${COMPANY_SLOGAN}</div>
        </div>
        ${logoExists ? `<img src="cid:${logoCid}" alt="${COMPANY_NAME} logo" style="height:48px;"/>` : ""}
      </div>
      <h2 style="margin:0 0 8px;">${escapeHtml(headerText)}</h2>
      <p style="margin:0 0 16px;">${escapeHtml(introText)}</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid #e5e7eb;">
            <th style="padding-bottom:8px;">${labels.item}</th>
            <th style="padding-bottom:8px; text-align:center;">${labels.qty}</th>
            <th style="padding-bottom:8px; text-align:right;">${labels.price}</th>
            <th style="padding-bottom:8px; text-align:right;">${labels.line}</th>
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <table style="width:100%; border-top:1px solid #e5e7eb; padding-top:12px; margin-top:12px;">
        <tr>
          <td style="padding:6px 0; color:#6b7280;">${labels.subtotal}</td>
          <td style="padding:6px 0; text-align:right;">${formatMoney(subtotalCents, currency)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280;">${escapeHtml(taxLabel)}</td>
          <td style="padding:6px 0; text-align:right;">${formatMoney(taxCents, currency)}</td>
        </tr>
        <tr style="font-weight:700;">
          <td style="padding:10px 0;">${labels.total}</td>
          <td style="padding:10px 0; text-align:right;">${formatMoney(totalCents, currency)}</td>
        </tr>
        ${savingsRow}
      </table>
      <div style="margin-top:16px; font-size:13px; color:#6b7280;">
        <div><strong>${labels.orderId}:</strong> ${escapeHtml(orderId)}</div>
        ${safeProvince ? `<div><strong>${labels.province}:</strong> ${safeProvince}</div>` : ""}
        ${safeAddress ? `<div><strong>${labels.address}:</strong> ${safeAddress}</div>` : ""}
        ${safeName ? `<div><strong>${labels.customer}:</strong> ${safeName}</div>` : ""}
        ${safeEmail ? `<div><strong>${labels.email}:</strong> ${safeEmail}</div>` : ""}
        ${safePhone ? `<div><strong>${labels.phone}:</strong> ${safePhone}</div>` : ""}
        ${COMPANY_ADDRESS ? `<div style="margin-top:10px;">${escapeHtml(COMPANY_ADDRESS)}</div>` : ""}
        ${COMPANY_EMAIL ? `<div>${escapeHtml(COMPANY_EMAIL)}</div>` : ""}
      </div>
    </div>
  `;
}

function getSenderAddress(){
  const sender = process.env.EMAIL_FROM || COMPANY_EMAIL || process.env.EMAIL_USER || "";
  if(!sender) return COMPANY_NAME;
  return `"${COMPANY_NAME}" <${sender}>`;
}

function formatLetterDate(value){
  const date = value instanceof Date ? value : new Date();
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function firstNameFrom(value){
  const text = String(value || "").trim();
  if(!text) return "there";
  return text.split(/\s+/)[0];
}

function buildWelcomeHtml(name, loginDate){
  const safeFullName = escapeHtml(name || "");
  const safeFirstName = escapeHtml(firstNameFrom(name));
  const safeDate = escapeHtml(formatLetterDate(loginDate));
  const contactLine = "www.powerpolysupplies.com | powerpolysupplies@gmail.com | 647 570 4878";
  const supportEmail = COMPANY_EMAIL || process.env.EMAIL_USER || "";
  const supportLine = supportEmail
    ? `<p>If you ever need help, just reply to this email or reach us at ${escapeHtml(supportEmail)}.</p>`
    : "<p>If you ever need help, just reply to this email.</p>";
  return `
    <div style="font-family:Arial,sans-serif; color:#1f2933; max-width:640px; margin:0 auto; line-height:1.6;">
      <div style="border-bottom:2px solid #e5e7eb; padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:18px; font-weight:700;">Power Poly Supplies Main Head Office</div>
        <div style="font-size:12px; color:#6b7280;">${escapeHtml(contactLine)}</div>
      </div>
      <div style="font-size:12px; color:#6b7280; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        ${safeFullName ? `<div><strong>Recipient:</strong> ${safeFullName}</div>` : ""}
        <div><strong>Date:</strong> ${safeDate}</div>
      </div>
      <p style="margin-top:16px;">Dear ${safeFirstName},</p>
      <p>Welcome to Power Poly Supplies. We are excited to have you with us and ready to support your packaging needs.</p>
      <p>This account gives you quick access to bulk pricing, order history, and faster checkout.</p>
      <div style="display:inline-block; margin:10px 0; padding:6px 12px; border-radius:999px; background:#fff3e6; border:1px solid #f3c89a; font-weight:700;">Verified Power Poly Member</div>
      ${supportLine}
      <p style="margin-top:18px;">Sincerely,</p>
      <p style="margin:0; font-weight:700;">Power Poly Supplies</p>
      <p style="margin:0; font-weight:700;">Main Head Office</p>
    </div>
  `;
}

function buildVerificationHtml(name, code){
  const safeName = escapeHtml(name || "there");
  return `
    <div style="font-family:Arial,sans-serif; color:#1f2933; max-width:600px; margin:0 auto; line-height:1.6;">
      <h2 style="margin:0 0 8px;">Your Power Poly verification code</h2>
      <p>Hi ${safeName},</p>
      <p>You are one step away from joining Power Poly Supplies.</p>
      <div style="font-size:22px; font-weight:700; letter-spacing:2px; margin:12px 0;">${escapeHtml(code)}</div>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
}

// ---- Email transporter ----
let emailTransporter = null;

function buildTransportConfig(){
  const user = process.env.EMAIL_USER || "";
  const pass = process.env.EMAIL_PASS || "";
  if(!user || !pass) return null;

  const host = (process.env.EMAIL_HOST || "").trim();
  const portRaw = (process.env.EMAIL_PORT || "").trim();
  const port = portRaw ? Number(portRaw) : 0;
  const secureEnv = String(process.env.EMAIL_SECURE || "").trim().toLowerCase();
  const secure = secureEnv === "true" || secureEnv === "1" || port === 465;
  const service = (process.env.EMAIL_SERVICE || "").trim();

  if(host){
    return {
      host,
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure,
      auth: { user, pass }
    };
  }

  if(service){
    return { service, auth: { user, pass } };
  }

  // Default (works for Gmail only if you use an App Password)
  return { service: "gmail", auth: { user, pass } };
}

function getEmailTransporter(){
  if(emailTransporter) return emailTransporter;
  const config = buildTransportConfig();
  if(!config) return null;
  emailTransporter = nodemailer.createTransport(config);
  return emailTransporter;
}

async function sendEmailSafe(mail){
  const transporter = getEmailTransporter();
  if(!transporter) return { ok:false, message:"Email not configured." };
  try{
    await transporter.sendMail(mail);
    return { ok:true };
  }catch(err){
    console.error("Email send failed", err);
    return { ok:false, message:"Failed to send email." };
  }
}

// Simple in-memory verification store
const verificationCodes = new Map();
const authSessions = new Map();

function createSession(email){
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  authSessions.set(token, { email, expiresAt });
  return { token, expiresAt };
}

function hashPassword(password){
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored){
  if(!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hash, "hex");
  if(storedBuf.length != derived.length) return false;
  return crypto.timingSafeEqual(storedBuf, derived);
}

function getSessionFromRequest(req){
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if(!token) return null;
  const session = authSessions.get(token);
  if(!session) return null;
  if(Date.now() > session.expiresAt){
    authSessions.delete(token);
    return null;
  }
  return { token, ...session };
}


// Health check
app.get("/api/health",(req,res)=>{
  const supabaseReady = !!supabase;
  const sheetsReady = isSheetsConfigured();
  const emailConfigured = !!buildTransportConfig();
  res.json({
    ok:true,
    status:"up",
    square: {
      configured: !!((squareClientSandbox || squareClientProduction) && squareLocationId && siteUrl),
      env: squareEnvMode,
      accessTokenSet: !!squareAccessToken,
      locationIdSet: !!squareLocationId,
      siteUrlSet: !!siteUrl
    },
    email: { configured: emailConfigured },
    supabase: supabaseReady,
    sheets: sheetsReady
  });
});

app.get("/api/email/health", async (req,res)=>{
  const transporter = getEmailTransporter();
  if(!transporter) return res.json({ ok:false, configured:false, message:"Email not configured." });
  try{
    await transporter.verify();
    res.json({ ok:true, configured:true });
  }catch(err){
    console.error("Email verify failed", err);
    res.status(500).json({ ok:false, configured:true, message:"Email configured but verification failed." });
  }
});

// ---- Products endpoint (frontend uses this for real stock) ----
app.get("/api/products", async (req,res)=>{
  if(!requireSupabase(res)) return;
  try{
    const products = await fetchProducts();
    res.json({ ok:true, products });
  }catch(err){
    console.error("Supabase products fetch failed", err);
    res.status(500).json({ ok:false, message:"Failed to load products." });
  }
});

// ---- Product reviews ----
app.get("/api/products/:id/reviews", async (req,res)=>{
  if(!requireSupabase(res)) return;
  try{
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", req.params.id)
      .order("created_at", { ascending: false });
    if(error) throw error;
    const reviews = (data || []).map(normalizeReviewRow);
    const avg = reviews.length ? (reviews.reduce((s,r)=>s + Number(r.rating || 0),0)/reviews.length) : 0;
    res.json({ ok:true, reviews, average: Number(avg.toFixed(2)), count: reviews.length });
  }catch(err){
    console.error("Supabase reviews fetch failed", err);
    res.status(500).json({ ok:false, message:"Failed to load reviews." });
  }
});

app.post("/api/products/:id/reviews", async (req,res)=>{
  const { rating, name, comment } = req.body || {};
  const productId = req.params.id;
  const cleanRating = Number(rating);
  if(!cleanRating || cleanRating < 1 || cleanRating > 5){
    return res.status(400).json({ ok:false, message:"Rating must be between 1 and 5." });
  }

  const entry = {
    id: "REV-" + Date.now(),
    product_id: productId,
    rating: cleanRating,
    name: (name || "Anonymous").slice(0,64),
    comment: (comment || "").slice(0,500),
    created_at: new Date().toISOString()
  };
  if(!requireSupabase(res)) return;
  try{
    const { error } = await supabase.from("reviews").insert(entry);
    if(error) throw error;
  }catch(err){
    console.error("Supabase review insert failed", err);
    return res.status(500).json({ ok:false, message:"Failed to save review." });
  }

  if(isSheetsConfigured()){
    let product = null;
    try{
      const products = await fetchProductsByIds([productId]);
      product = products[0] || null;
    }catch(err){
      product = null;
    }
    try{
      await appendReviewToSheet([
        new Date().toISOString(),
        entry.id,
        productId,
        product?.name || "",
        entry.rating,
        entry.name,
        entry.comment,
        entry.created_at
      ]);
    }catch(sheetErr){
      console.error("Review sheet append failed", sheetErr);
    }
  }

  let reviews = [];
  try{
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if(error) throw error;
    reviews = (data || []).map(normalizeReviewRow);
  }catch(err){
    reviews = [normalizeReviewRow(entry)];
  }
  const avg = reviews.length ? (reviews.reduce((s,r)=>s + Number(r.rating || 0),0)/reviews.length) : 0;

  res.json({ ok:true, review: entry, average: Number(avg.toFixed(2)), count: reviews.length });
});

// ---- Account: order history ----
app.get("/api/account/orders", async (req,res)=>{
  const session = getSessionFromRequest(req);
  if(!session) return res.status(401).json({ ok:false, message:"Unauthorized" });
  if(!requireSupabase(res)) return;

  try{
    const email = (session.email || "").toLowerCase();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_email", email)
      .order("created_at", { ascending: false });
    if(error) throw error;
    res.json({ ok:true, orders: (data || []).map(normalizeOrderRow) });
  }catch(err){
    console.error("Supabase account orders fetch failed", err);
    res.status(500).json({ ok:false, message:"Unable to load orders." });
  }
});

// ---- Admin: orders list ----
app.get("/api/admin/orders", async (req,res)=>{
  if(!requireSupabase(res)) return;
  try{
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if(error) throw error;
    res.json({ ok:true, orders: (data || []).map(normalizeOrderRow) });
  }catch(err){
    console.error("Supabase admin orders fetch failed", err);
    res.status(500).json({ ok:false, message:"Failed to load orders." });
  }
});

// ---- Admin: messages list ----
app.get("/api/admin/messages", async (req,res)=>{
  if(!requireSupabase(res)) return;
  try{
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    if(error) throw error;
    res.json({ ok:true, messages: (data || []).map(normalizeMessageRow) });
  }catch(err){
    console.error("Supabase admin messages fetch failed", err);
    res.status(500).json({ ok:false, message:"Failed to load messages." });
  }
});

// ---- Admin: mark fulfilled ----
app.post("/api/admin/orders/:id/fulfill", async (req,res)=>{
  if(!requireSupabase(res)) return;
  try{
    const { data, error } = await supabase
      .from("orders")
      .update({ status:"fulfilled" })
      .eq("id", req.params.id)
      .select("id")
      .single();
    if(error) throw error;
    if(!data) return res.status(404).json({ ok:false });
    res.json({ ok:true });
  }catch(err){
    console.error("Supabase order fulfill failed", err);
    res.status(500).json({ ok:false, message:"Failed to update order." });
  }
});

// ---- Create pay-later order + reduce stock + email ----
app.post("/api/order", async (req,res)=>{
  const { customer, items, totalCents, currency, paymentMethod, shipping } = req.body;
  if(!customer?.email || !items?.length) return res.status(400).json({ ok:false, message:"Missing email or items" });
  if(!requireSupabase(res)) return;

  try{
    const productIds = items.map(it=>it.id).filter(Boolean);
    const products = await fetchProductsByIds(productIds);
    const productsById = new Map(products.map(p=>[p.id, p]));
    const productUpdates = [];

    // Reduce stock (basic) + enrich items with descriptions + apply tier pricing
    const normalizedItems = items.map((it)=>{
      const product = productsById.get(it.id);
      if(product){
        const nextStock = Math.max(0, Number(product.stock || 0) - it.qty);
        productUpdates.push({ id: product.id, stock: nextStock });
      }
      const unitPriceCents = product ? getTieredPriceCents(product, it.qty) : Number(it.priceCents || 0);
      const basePriceCents = product ? Number(product.priceCents || unitPriceCents) : Number(it.priceCentsBase ?? it.priceCents ?? 0);
      const currency = it.currency || product?.currency || "CAD";
      const currencyBase = product?.currency || it.currencyBase || it.currency || "CAD";
      return {
        ...it,
        priceCents: unitPriceCents,
        currency,
        priceCentsBase: basePriceCents,
        currencyBase,
        description: it.description || product?.description || "",
        description_fr: it.description_fr || product?.description_fr || "",
        description_ko: it.description_ko || product?.description_ko || "",
        description_hi: it.description_hi || product?.description_hi || "",
        description_ta: it.description_ta || product?.description_ta || "",
        description_es: it.description_es || product?.description_es || ""
      };
    });

    const shippingInfo = shipping && typeof shipping === "object"
      ? {
          zone: shipping.zone || "Unknown",
          label: shipping.label || "Shipping",
          amountCents: Number(shipping.costCents ?? shipping.amountCents ?? 0)
        }
      : getShippingForPostal(customer?.postal);
    const subtotalCents = normalizedItems.reduce((sum, item) => sum + (item.priceCents * item.qty), 0);
    const taxData = calculateTaxCents(subtotalCents, customer?.province);
    const totalCentsComputed = subtotalCents + (shippingInfo.amountCents || 0) + taxData.taxCents;
    const orderId = "ORD-" + Date.now();
    const order = {
      id: orderId,
      status: "pending",
      payment_method: paymentMethod || "pay_later",
      customer,
      customer_email: (customer?.email || "").toLowerCase(),
      shipping: {
        zone: shippingInfo.zone,
        label: shippingInfo.label,
        costCents: shippingInfo.amountCents
      },
      items: normalizedItems,
      total_cents: totalCentsComputed,
      currency,
      language: ["en","fr","ko","hi","ta","es"].includes(String(customer?.language || "").toLowerCase())
        ? String(customer.language).toLowerCase()
        : "en",
      created_at: new Date().toISOString()
    };

    if(productUpdates.length){
      for(const update of productUpdates){
        const { error } = await supabase.from("products").update({ stock: update.stock }).eq("id", update.id);
        if(error) throw error;
      }
    }
    const { error: orderError } = await supabase.from("orders").insert(order);
    if(orderError) throw orderError;

    const deliveryId = "DEL-" + Date.now();
    const delivery = {
      id: deliveryId,
      order_id: orderId,
      customer_email: (customer?.email || "").toLowerCase(),
      name: customer?.name || "",
      phone: customer?.phone || "",
      address_line1: customer?.address1 || "",
      address_line2: customer?.address2 || "",
      city: customer?.city || "",
      province: customer?.province || "",
      postal: customer?.postal || "",
      country: customer?.country || "Canada",
      delivery_notes: customer?.deliveryNotes || "",
      shipping_zone: shippingInfo.zone || "",
      shipping_label: shippingInfo.label || "",
      status: "pending",
      created_at: new Date().toISOString()
    };
    const { error: deliveryError } = await supabase.from("deliveries").insert(delivery);
    if(deliveryError) throw deliveryError;

    const emailConfigured = !!buildTransportConfig();
    const taxCentsNow = taxData.taxCents;
    const taxLabelNow = `${PROVINCE_TAX_LABELS[customer?.province] || "Tax"}${customer?.province ? ` - ${customer.province}` : ""}`;
    const logoExistsNow = fs.existsSync(COMPANY_LOGO_PATH);
    const attachmentsNow = logoExistsNow ? [{
      filename: path.basename(COMPANY_LOGO_PATH),
      path: COMPANY_LOGO_PATH,
      cid: "pps-logo"
    }] : [];

    let receiptEmailSent = false;
    if(emailConfigured){
      const lang = String(customer?.language || "en").toLowerCase();
      const headerText = lang === "fr" ? "Reçu" : (lang === "es" ? "Recibo" : "Receipt");
      const introText = lang === "fr"
        ? "Merci pour votre commande chez Power Poly Supplies. Nous la préparons avec soin. Voici votre reçu."
        : lang === "es"
          ? "Gracias por tu pedido en Power Poly Supplies. Ya estamos preparando tu pedido. Aquí está tu recibo."
          : "Thanks for choosing Power Poly Supplies. We are getting your order ready now. Here is your receipt.";
      const subjectText = lang === "fr"
        ? `Merci pour votre commande ! Power Poly Supplies - ${orderId}`
        : lang === "es"
          ? `¡Gracias por tu pedido! Recibo de Power Poly Supplies - ${orderId}`
          : `Thanks for your order! Power Poly Supplies receipt - ${orderId}`;

      const receiptHtml = buildReceiptHtml({
        orderId,
        customer,
        items: normalizedItems,
        subtotalCents,
        taxCents: taxCentsNow,
        totalCents: totalCentsComputed,
        currency,
        taxLabel: taxLabelNow,
        headerText,
        introText,
        logoCid: "pps-logo",
        logoExists: logoExistsNow,
        language: customer?.language
      });

      const customerSend = await sendEmailSafe({
        from: getSenderAddress(),
        to: customer.email,
        subject: subjectText,
        html: receiptHtml,
        attachments: attachmentsNow
      });
      receiptEmailSent = !!customerSend.ok;
      if(!customerSend.ok) console.error("Customer receipt email failed", customerSend.message);
    }

    res.json({ ok:true, orderId, receiptEmailSent, emailConfigured });

    // Run slower tasks in background so checkout returns fast.
    (async ()=>{
      if(isSheetsConfigured()){
        try{
          const latestProducts = await fetchProducts();
          await syncProductsToSheet(latestProducts || []);
        }catch(sheetErr){
          console.error("Products sheet sync failed", sheetErr);
        }
      }

      const taxCents = taxData.taxCents;
      const taxLabel = `${PROVINCE_TAX_LABELS[customer?.province] || "Tax"}${customer?.province ? ` - ${customer.province}` : ""}`;

      if(isSheetsConfigured()){
        const itemsSummary = normalizedItems.map((item) => `${item.name} x${item.qty}`).join("; ");
        try{
          await appendOrderToSheet([
            new Date().toISOString(),
            orderId,
            customer?.name || "",
            customer?.email || "",
            customer?.phone || "",
            shippingInfo.zone,
            formatMoney(shippingInfo.amountCents, currency),
            itemsSummary,
            formatMoney(totalCentsComputed, currency)
          ]);
        }catch(sheetErr){
          console.error("Order sheet append failed", sheetErr);
        }
      }

      const emailConfigured = !!buildTransportConfig();
      const adminEmail = process.env.ORDER_TO;
      const logoExists = fs.existsSync(COMPANY_LOGO_PATH);
      const attachments = logoExists ? [{
        filename: path.basename(COMPANY_LOGO_PATH),
        path: COMPANY_LOGO_PATH,
        cid: "pps-logo"
      }] : [];

      if(emailConfigured){
        const lang = String(customer?.language || "en").toLowerCase();
        const headerText = lang === "fr"
          ? "Reçu"
          : lang === "es"
            ? "Recibo"
            : lang === "hi"
              ? "रसीद"
              : lang === "ta"
                ? "ரசீது"
                : "Receipt";
        const introText = lang === "fr"
          ? "Merci pour votre commande chez Power Poly Supplies. Nous la préparons avec soin. Voici votre reçu."
          : lang === "es"
            ? "Gracias por tu pedido en Power Poly Supplies. Ya estamos preparando tu pedido. Aquí está tu recibo."
            : lang === "hi"
              ? "Power Poly Supplies में आपके ऑर्डर के लिए धन्यवाद। हम आपका ऑर्डर तैयार कर रहे हैं। यह आपकी रसीद है।"
              : lang === "ta"
                ? "Power Poly Supplies-ல் உங்கள் ஆர்டருக்கு நன்றி. உங்கள் ஆர்டரை தயாரித்து கொண்டிருக்கிறோம். இதோ உங்கள் ரசீது."
                : "Thanks for choosing Power Poly Supplies. We are getting your order ready now. Here is your receipt.";
        const subjectText = lang === "fr"
          ? `Merci pour votre commande ! Power Poly Supplies - ${orderId}`
          : lang === "es"
            ? `¡Gracias por tu pedido! Recibo de Power Poly Supplies - ${orderId}`
            : lang === "hi"
              ? `आपके ऑर्डर के लिए धन्यवाद! Power Poly Supplies रसीद - ${orderId}`
              : lang === "ta"
                ? `உங்கள் ஆர்டருக்கு நன்றி! Power Poly Supplies ரசீது - ${orderId}`
                : `Thanks for your order! Power Poly Supplies receipt - ${orderId}`;

        const receiptHtml = buildReceiptHtml({
          orderId,
          customer,
          items: normalizedItems,
          subtotalCents,
          taxCents,
          totalCents: totalCentsComputed,
          currency,
          taxLabel,
          headerText,
          introText,
          logoCid: "pps-logo",
          logoExists,
          language: customer?.language
        });

        if(!receiptEmailSent){
          const customerSend = await sendEmailSafe({
            from: getSenderAddress(),
            to: customer.email,
            subject: subjectText,
            html: receiptHtml,
            attachments
          });
          if(!customerSend.ok) console.error("Customer receipt email failed", customerSend.message);
        }

        if(adminEmail){
          const adminHtml = buildReceiptHtml({
            orderId,
            customer,
            items: normalizedItems,
            subtotalCents,
            taxCents,
            totalCents: totalCentsComputed,
            currency,
            taxLabel,
            headerText: "New Order",
            introText: "A new order has been placed on Power Poly Supplies.",
            logoCid: "pps-logo",
            logoExists,
            language: customer?.language
          });

          const adminSend = await sendEmailSafe({
            from: getSenderAddress(),
            to: adminEmail,
            subject: `New Order ${orderId} (${order.payment_method || paymentMethod || "pay_later"})`,
            html: adminHtml,
            attachments
          });
          if(!adminSend.ok) console.error("Admin order email failed", adminSend.message);
        }
      }
    })().catch((err)=>{
      console.error("Order async work failed", err);
    });
  }catch(err){
    console.error("Order error", err);
    res.status(500).json({ ok:false, message:"Order failed on server" });
  }
});

// ---- Contact form -> email ----
app.post("/api/contact", async (req,res)=>{
  const { name, email, phone, message } = req.body;
  if(!email || !message) return res.status(400).json({ ok:false, message:"Email and message required" });
  if(!requireSupabase(res)) return;

  try{
    const emailReady = !!buildTransportConfig() && !!process.env.ORDER_TO;
    let emailSent = false;

    const msgId = "MSG-" + Date.now();
    const entry = {
      id: msgId,
      name: name || "",
      email,
      phone: phone || "",
      message,
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from("messages").insert(entry);
    if(error) throw error;

    if(isSheetsConfigured()){
      try{
        await appendMessageToSheet([
          new Date().toISOString(),
          msgId,
          name || "",
          email,
          phone || "",
          message
        ]);
      }catch(sheetErr){
        console.error("Message sheet append failed", sheetErr);
      }
    }

    if(emailReady){
      const out = await sendEmailSafe({
        from: getSenderAddress(),
        to: process.env.ORDER_TO,
        subject: "New Contact Message - Power Poly Supplies",
        html: `
          <h2>New Contact Message</h2>
          <p><b>Name:</b> ${name || ""}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Phone:</b> ${phone || ""}</p>
          <hr/>
          <p>${(message || "").replace(/\n/g,"<br/>")}</p>
        `
      });
      emailSent = out.ok;
    }

    res.json({ ok:true, emailSent });
  }catch(err){
    console.error("Contact email failed", err);
    res.status(500).json({ ok:false, message:"Failed to send email" });
  }
});

// ---- Help widget -> help_requests + messages ----
app.post("/api/help", async (req,res)=>{
  const { name, email, message } = req.body;
  if(!email || !message) return res.status(400).json({ ok:false, message:"Email and message required" });
  if(!requireSupabase(res)) return;

  try{
    const emailReady = !!buildTransportConfig() && !!process.env.ORDER_TO;
    let emailSent = false;

    const helpId = "HELP-" + Date.now();
    const entry = {
      id: helpId,
      name: name || "",
      email,
      message,
      created_at: new Date().toISOString()
    };
    const { error: helpErr } = await supabase.from("help_requests").insert(entry);
    if(helpErr) throw helpErr;

    const msgId = "MSG-" + Date.now();
    const messageEntry = {
      id: msgId,
      name: name || "",
      email,
      phone: "",
      message: `[Help] ${message}`,
      created_at: new Date().toISOString()
    };
    const { error: msgErr } = await supabase.from("messages").insert(messageEntry);
    if(msgErr) throw msgErr;

    if(isSheetsConfigured()){
      try{
        await appendMessageToSheet([
          new Date().toISOString(),
          msgId,
          name || "",
          email,
          "",
          `[Help] ${message}`
        ]);
      }catch(sheetErr){
        console.error("Help message sheet append failed", sheetErr);
      }
    }

    if(emailReady){
      const out = await sendEmailSafe({
        from: getSenderAddress(),
        to: process.env.ORDER_TO,
        subject: "New Help Request - Power Poly Supplies",
        html: `
          <h2>New Help Request</h2>
          <p><b>Name:</b> ${name || ""}</p>
          <p><b>Email:</b> ${email}</p>
          <hr/>
          <p>${(message || "").replace(/\n/g,"<br/>")}</p>
        `
      });
      emailSent = out.ok;
    }

    res.json({ ok:true, emailSent });
  }catch(err){
    console.error("Help request failed", err);
    res.status(500).json({ ok:false, message:"Failed to send help request" });
  }
});

// ---- Auth: send verification code ----
app.post("/api/auth/send-code", async (req,res)=>{
  const { email, name } = req.body;
  const emailKey = String(email || "").trim().toLowerCase();
  if(!emailKey) return res.status(400).json({ ok:false, message:"Email required" });
  try{
    const code = Math.floor(1000 + Math.random()*9000).toString(); // 4-digit
    const expiresAt = Date.now() + 10*60*1000; // 10 minutes
    verificationCodes.set(emailKey, { code, expiresAt });

    const emailConfigured = !!buildTransportConfig();

    if(emailConfigured){
      const out = await sendEmailSafe({
        from: getSenderAddress(),
        to: email,
        subject: "Welcome to Power Poly Supplies - your verification code",
        html: buildVerificationHtml(name, code)
      });
      if(out.ok) res.json({ ok:true });
      else res.status(500).json({ ok:false, message:"Failed to send code. Check mail credentials." });
    }else{
      // Dev fallback: return code in response when email is not configured
      console.warn("Email not configured; returning code in response for dev use.");
      res.json({ ok:true, devMode:true, code, message:"Email not configured; using dev mode code." });
    }
  }catch(err){
    console.error("Send code failed", err);
    res.status(500).json({ ok:false, message:"Failed to send code. Check mail credentials." });
  }
});

// ---- Auth: check verification code ----
app.post("/api/auth/check-code", (req,res)=>{
  const { email, code } = req.body;
  const emailKey = String(email || "").trim().toLowerCase();
  if(!emailKey || !code) return res.status(400).json({ ok:false, message:"Email and code required" });

  const entry = verificationCodes.get(emailKey);
  if(!entry) return res.status(400).json({ ok:false, message:"No code sent. Please request a code first." });
  if(Date.now() > entry.expiresAt){
    verificationCodes.delete(emailKey);
    return res.status(400).json({ ok:false, message:"Code expired. Please request a new one." });
  }
  if(entry.code !== code){
    return res.status(400).json({ ok:false, message:"Invalid code." });
  }

  res.json({ ok:true, message:"Code verified." });
});

// ---- Auth: register ----
app.post("/api/auth/register", async (req,res)=>{
  const { email, code, password, name } = req.body;
  const emailKey = String(email || "").trim().toLowerCase();
  if(!emailKey || !code || !password) return res.status(400).json({ ok:false, message:"Email, code, and password required" });

  const entry = verificationCodes.get(emailKey);
  if(!entry) return res.status(400).json({ ok:false, message:"No code sent. Please request a code first." });
  if(Date.now() > entry.expiresAt){
    verificationCodes.delete(emailKey);
    return res.status(400).json({ ok:false, message:"Code expired. Please request a new one." });
  }
  if(entry.code !== code){
    return res.status(400).json({ ok:false, message:"Invalid code." });
  }

  if(!requireSupabase(res)) return;
  const lower = emailKey;
  try{
    const { data: existing, error: existingErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", lower)
      .maybeSingle();
    if(existingErr) throw existingErr;
    if(existing) return res.status(400).json({ ok:false, message:"Account already exists. Please log in." });
  }catch(err){
    console.error("Supabase user lookup failed", err);
    return res.status(500).json({ ok:false, message:"Unable to create account." });
  }

  const user = {
    id: "USR-" + Date.now(),
    email: lower,
    name: (name || "").slice(0,80),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };
  const now = new Date().toISOString();
  const userRow = {
    id: user.id,
    email: user.email,
    name: user.name,
    password_hash: user.passwordHash,
    created_at: now,
    last_login_at: now,
    first_login_at: now,
    welcome_email_sent: false
  };
  try{
    const { error: insertErr } = await supabase.from("users").insert(userRow);
    if(insertErr) throw insertErr;
  }catch(err){
    console.error("Supabase user insert failed", err);
    return res.status(500).json({ ok:false, message:"Unable to create account." });
  }
  verificationCodes.delete(emailKey);

  const session = createSession(lower);
  const emailConfigured = !!buildTransportConfig();
  const shouldSendWelcome = emailConfigured;

  if(shouldSendWelcome){
    (async ()=>{
      const out = await sendEmailSafe({
        from: getSenderAddress(),
        to: lower,
        subject: "Welcome to Power Poly Supplies!",
        html: buildWelcomeHtml(user.name || "", new Date(now))
      });
      if(!out.ok) return;
      supabase.from("users")
        .update({ welcome_email_sent:true })
        .eq("email", lower)
        .then(({ error: updateErr })=>{
          if(updateErr) console.error("Supabase welcome email flag update failed", updateErr);
        });
    })().catch((err)=>{
      console.error("Welcome email failed", err);
    });
  }

  res.json({ ok:true, token: session.token, email: lower, name: user.name || "", expiresAt: session.expiresAt });
});

// ---- Auth: verify code (stub, no persistence) ----
app.post("/api/auth/verify-code", (req,res)=>{
  const { email, code } = req.body;
  const emailKey = String(email || "").trim().toLowerCase();
  if(!emailKey || !code) return res.status(400).json({ ok:false, message:"Email and code required" });

  const entry = verificationCodes.get(emailKey);
  if(!entry) return res.status(400).json({ ok:false, message:"No code sent. Please request a code first." });
  if(Date.now() > entry.expiresAt){
    verificationCodes.delete(emailKey);
    return res.status(400).json({ ok:false, message:"Code expired. Please request a new one." });
  }
  if(entry.code !== code){
    return res.status(400).json({ ok:false, message:"Invalid code." });
  }

  verificationCodes.delete(emailKey);
  const session = createSession(emailKey);
  res.json({ ok:true, message:"Code verified.", token: session.token, email: emailKey, expiresAt: session.expiresAt });
});

// ---- Auth: login ----
app.post("/api/auth/login", async (req,res)=>{
  const { email, password } = req.body;
  const emailKey = String(email || "").trim().toLowerCase();
  if(!emailKey || !password) return res.status(400).json({ ok:false, message:"Email and password required" });

  if(!requireSupabase(res)) return;
  const lower = emailKey;
  let user = null;
  try{
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", lower)
      .maybeSingle();
    if(error) throw error;
    user = normalizeUserRow(data);
  }catch(err){
    console.error("Supabase user login lookup failed", err);
    return res.status(500).json({ ok:false, message:"Unable to log in." });
  }
  if(!user || !verifyPassword(password, user.password_hash)){
    return res.status(400).json({ ok:false, message:"Invalid email or password." });
  }

  const session = createSession(lower);
  supabase.from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("email", lower)
    .then(({ error })=>{
      if(error) console.error("Supabase last login update failed", error);
    });
  res.json({ ok:true, token: session.token, email: lower, name: user.name || "", expiresAt: session.expiresAt });
});

// ---- Auth: logout ----
app.post("/api/auth/logout", (req,res)=>{
  const session = getSessionFromRequest(req);
  if(session) authSessions.delete(session.token);
  res.json({ ok:true });
});

// ---- Square Checkout ----
async function createSquarePaymentAndOrder(body){
  const { items, customer } = body || {};
  if(!Array.isArray(items) || items.length === 0){
    const error = new Error("No items to pay for.");
    error.status = 400;
    throw error;
  }

  const currency = String(items[0]?.currency || "CAD").toUpperCase();
  const badCurrency = items.some(i => String(i?.currency || currency).toUpperCase() !== currency);
  if(badCurrency){
    const error = new Error("All items must use the same currency.");
    error.status = 400;
    throw error;
  }

  const productIds = (items || []).map(i=>i.id).filter(Boolean);
  let productsById = new Map();
  try{
    const products = await fetchProductsByIds(productIds);
    productsById = new Map(products.map(p=>[p.id, p]));
  }catch(err){
    console.error("Supabase products fetch for square failed", err);
  }

  const normalizedItems = (items || []).map((i)=>{
    const qty = Math.max(1, Number(i.qty || 1));
    const product = productsById.get(i.id);
    const unitAmount = product ? getTieredPriceCents(product, qty) : Number(i.priceCents || 0);
    return {
      id: i.id || "",
      name: i.name || product?.name || "Item",
      qty,
      priceCents: Math.max(0, Math.round(unitAmount)),
      currency: currency,
      description: i.description || product?.description || "",
      description_fr: i.description_fr || product?.description_fr || "",
      description_ko: i.description_ko || product?.description_ko || "",
      description_hi: i.description_hi || product?.description_hi || "",
      description_ta: i.description_ta || product?.description_ta || "",
      description_es: i.description_es || product?.description_es || ""
    };
  });

  const orderId = `SQR-${Date.now()}`;
  const redirectBase = String(siteUrl).replace(/\/+$/,"");
  const redirectUrl = `${redirectBase}/thank-you.html?order_id=${encodeURIComponent(orderId)}`;
  const idempotencyKey = crypto.randomUUID();

  const lineItems = normalizedItems.map((i)=>({
    name: i.name,
    quantity: String(i.qty),
    basePriceMoney: { amount: BigInt(i.priceCents), currency: i.currency }
  }));

  const result = await withSquareClient((client)=> client.checkout.paymentLinks.create({
    idempotencyKey,
    order: {
      locationId: squareLocationId,
      referenceId: orderId,
      lineItems
    },
    checkoutOptions: {
      redirectUrl
    }
  }));

  const paymentUrl = result?.paymentLink?.url;
  if(!paymentUrl){
    const error = new Error("Failed to create Square payment link.");
    error.status = 500;
    throw error;
  }

  const squarePaymentLinkId = result?.paymentLink?.id || "";
  const squareOrderId = result?.paymentLink?.orderId || result?.paymentLink?.order_id || "";

  const nowIso = new Date().toISOString();
  const totalCents = normalizedItems.reduce((sum, i)=> sum + (i.priceCents * i.qty), 0);
  const customerEmail = (customer?.email || "").toLowerCase();
  const orderRow = {
    id: orderId,
    status: "pending",
    payment_method: "square_checkout",
    customer: customer || {},
    customer_email: customerEmail,
    shipping: { zone: "Square", label: "Square", costCents: 0 },
    items: normalizedItems,
    total_cents: totalCents,
    currency,
    square_payment_link_id: squarePaymentLinkId,
    square_order_id: squareOrderId,
    language: ["en","fr","ko","hi","ta","es"].includes(String(customer?.language || "").toLowerCase())
      ? String(customer.language).toLowerCase()
      : "en",
    created_at: nowIso
  };
  const { error: orderError } = await supabase.from("orders").insert(orderRow);
  if(orderError) console.error("Supabase square order insert failed", orderError);

  return { ok:true, url: paymentUrl, orderId, squarePaymentLinkId, squareOrderId };
}

function requireSquareConfigured(res){
  if(!(squareClientSandbox || squareClientProduction) || !squareLocationId){
    const missing = [];
    if(!squareAccessToken) missing.push("SQUARE_ACCESS_TOKEN");
    if(!squareLocationId) missing.push("SQUARE_LOCATION_ID");
    res.status(400).json({ ok:false, message:`Square not configured (missing ${missing.join(" + ") || "keys"}).` });
    return false;
  }
  if(!siteUrl){
    res.status(400).json({ ok:false, message:"SITE_URL not configured (set SITE_URL to your public frontend URL)." });
    return false;
  }
  return true;
}

function getHttpStatus(value, fallback = 500){
  const num = Number(value);
  if(Number.isFinite(num) && num >= 100 && num <= 599) return num;
  return fallback;
}

function summarizeSquareError(err){
  const body = err?.body || err?.result || err?.data || err?.responseBody || null;
  const errors = Array.isArray(body?.errors)
    ? body.errors
    : Array.isArray(err?.errors)
      ? err.errors
      : [];
  const requestId = body?.requestId || body?.request_id || err?.requestId || err?.request_id || "";

  const sanitizedErrors = errors
    .filter(e => e && (e.category || e.code || e.detail))
    .map(e => ({
      category: e.category || "",
      code: e.code || "",
      detail: e.detail || "",
      field: e.field || ""
    }));

  const first = sanitizedErrors[0];
  const messageFromSquare = first
    ? [first.category, first.code, first.detail].filter(Boolean).join(" - ")
    : "";

  const message = messageFromSquare || err?.message || "Square request failed.";
  const statusCode = getHttpStatus(err?.statusCode || err?.status || err?.httpStatusCode, 500);

  return { statusCode, message, errors: sanitizedErrors, requestId };
}

async function handleCreatePayment(req,res){
  if(!requireSquareConfigured(res)) return;
  if(!requireSupabase(res)) return;
  try{
    const out = await createSquarePaymentAndOrder(req.body || {});
    res.json(out);
  }catch(err){
    console.error("Square create-payment error", err);
    const summary = summarizeSquareError(err);
    const hint = isSquareAuthError(err)
      ? ` Check your Square token + environment (SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_ENV). Current SQUARE_ENV mode: ${squareEnvMode}.`
      : "";
    res.status(summary.statusCode).json({
      ok:false,
      message: `${summary.message}${hint}`,
      errors: summary.errors,
      requestId: summary.requestId
    });
  }
}

async function handlePaymentStatus(req,res){
  if(!requireSquareConfigured(res)) return;
  if(!requireSupabase(res)) return;
  try{
    const orderId = String(req.query.orderId || req.query.order_id || "").trim();
    if(!orderId) return res.status(400).json({ ok:false, message:"orderId is required" });

    const { data: orderRow, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if(error) throw error;
    if(!orderRow) return res.status(404).json({ ok:false, message:"Order not found" });

    const squareOrderId = orderRow.square_order_id || "";
    if(!squareOrderId){
      return res.json({ ok:true, orderId, status: orderRow.status || "pending" });
    }

    const result = await withSquareClient((client)=> client.orders.get({ orderId: squareOrderId }));
    const state = String(result?.order?.state || "").toUpperCase();

    let status = orderRow.status || "pending";
    if(state === "COMPLETED") status = "paid";
    if(state === "CANCELED") status = "canceled";

    const statusWas = String(orderRow.status || "pending");
    if(status !== (orderRow.status || "")){
      const { error: updateError } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if(updateError) console.error("Supabase order status update failed", updateError);
    }

    // Send receipt once when a Square order becomes paid.
    if(status === "paid" && statusWas !== "paid"){
      const emailConfigured = !!buildTransportConfig();
      const customerEmail = String(orderRow.customer_email || orderRow.customer?.email || "").trim();
      const adminEmail = String(process.env.ORDER_TO || "").trim();

      if(emailConfigured && (customerEmail || adminEmail)){
        const items = Array.isArray(orderRow.items) ? orderRow.items : [];
        const currency = String(orderRow.currency || "CAD").toUpperCase();
        const totalCents = Number(orderRow.total_cents || 0);
        const taxItems = items.filter(i => String(i?.id || "").toLowerCase() === "tax");
        const taxCents = taxItems.reduce((sum, i)=> sum + (Number(i.priceCents || 0) * Number(i.qty || 1)), 0);
        const subtotalCents = Math.max(0, totalCents - taxCents);
        const taxLabel = String(taxItems[0]?.name || "Tax");

        const lang = String(orderRow.language || orderRow.customer?.language || "en").toLowerCase();
        const headerText = lang === "fr"
          ? "Reçu"
          : lang === "es"
            ? "Recibo"
            : lang === "hi"
              ? "रसीद"
              : lang === "ta"
                ? "ரசீது"
                : "Receipt";
        const introText = lang === "fr"
          ? "Merci pour votre commande chez Power Poly Supplies. Nous la préparons avec soin. Voici votre reçu."
          : lang === "es"
            ? "Gracias por tu pedido en Power Poly Supplies. Ya estamos preparando tu pedido. Aquí está tu recibo."
            : lang === "hi"
              ? "Power Poly Supplies में आपके ऑर्डर के लिए धन्यवाद। हम आपका ऑर्डर तैयार कर रहे हैं। यह आपकी रसीद है।"
              : lang === "ta"
                ? "Power Poly Supplies-ல் உங்கள் ஆர்டருக்கு நன்றி. உங்கள் ஆர்டரை தயாரித்து கொண்டிருக்கிறோம். இதோ உங்கள் ரசீது."
                : "Thanks for choosing Power Poly Supplies. We are getting your order ready now. Here is your receipt.";

        const logoExists = fs.existsSync(COMPANY_LOGO_PATH);
        const attachments = logoExists ? [{
          filename: path.basename(COMPANY_LOGO_PATH),
          path: COMPANY_LOGO_PATH,
          cid: "pps-logo"
        }] : [];

        const receiptHtml = buildReceiptHtml({
          orderId,
          customer: orderRow.customer || { email: customerEmail },
          items,
          subtotalCents,
          taxCents,
          totalCents,
          currency,
          taxLabel,
          headerText,
          introText,
          logoCid: "pps-logo",
          logoExists,
          language: lang
        });

        (async ()=>{
          if(customerEmail){
            const subject = lang === "fr"
              ? `Merci pour votre commande ! Power Poly Supplies - ${orderId}`
              : lang === "es"
                ? `¡Gracias por tu pedido! Recibo de Power Poly Supplies - ${orderId}`
                : lang === "hi"
                  ? `आपके ऑर्डर के लिए धन्यवाद! Power Poly Supplies रसीद - ${orderId}`
                  : lang === "ta"
                    ? `உங்கள் ஆர்டருக்கு நன்றி! Power Poly Supplies ரசீது - ${orderId}`
                    : `Thanks for your order! Power Poly Supplies receipt - ${orderId}`;
            await sendEmailSafe({ from: getSenderAddress(), to: customerEmail, subject, html: receiptHtml, attachments });
          }
          if(adminEmail){
            await sendEmailSafe({
              from: getSenderAddress(),
              to: adminEmail,
              subject: `New Order ${orderId} (square_checkout)`,
              html: receiptHtml,
              attachments
            });
          }
        })().catch((err)=> console.error("Square receipt email failed", err));
      }
    }

    res.json({ ok:true, orderId, status, square: { orderId: squareOrderId, state } });
  }catch(err){
    console.error("Square payment-status error", err);
    const summary = summarizeSquareError(err);
    res.status(summary.statusCode).json({
      ok:false,
      message: summary.message || "Unable to check payment status.",
      errors: summary.errors,
      requestId: summary.requestId
    });
  }
}

// New Square endpoints (preferred) + safe aliases
app.post("/api/create-payment", handleCreatePayment);
app.post("/create-payment", handleCreatePayment);
app.post("/pi/create-payment", handleCreatePayment);
app.get("/api/create-payment", (req,res)=> res.status(405).json({ ok:false, message:"Use POST /api/create-payment" }));
app.get("/create-payment", (req,res)=> res.status(405).json({ ok:false, message:"Use POST /create-payment" }));
app.get("/pi/create-payment", (req,res)=> res.status(405).json({ ok:false, message:"Use POST /pi/create-payment" }));

app.get("/api/payment-status", handlePaymentStatus);
app.get("/payment-status", handlePaymentStatus);
app.get("/pi/payment-status", handlePaymentStatus);

// Backward-compat endpoint used by older frontend code
app.post("/api/square-checkout", async (req,res)=>{
  if(!requireSquareConfigured(res)) return;
  if(!requireSupabase(res)) return;
  try{
    const out = await createSquarePaymentAndOrder(req.body || {});
    // Keep the old shape (also include ok/orderId for newer clients).
    res.json({ ok:true, url: out.url, orderId: out.orderId });
  }catch(err){
    console.error("Square checkout error", err);
    res.status(err.status || 500).json({ ok:false, message: err.message || "Square checkout failed. Check API keys." });
  }
});

// Alias for apps expecting /api/orders (same behavior as /api/account/orders)
async function handleOrders(req,res){
  const session = getSessionFromRequest(req);
  if(!session) return res.status(401).json({ ok:false, message:"Unauthorized" });
  if(!requireSupabase(res)) return;
  try{
    const email = (session.email || "").toLowerCase();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_email", email)
      .order("created_at", { ascending: false });
    if(error) throw error;
    res.json({ ok:true, orders: (data || []).map(normalizeOrderRow) });
  }catch(err){
    console.error("Supabase orders fetch failed", err);
    res.status(500).json({ ok:false, message:"Unable to load orders." });
  }
}

app.get("/api/orders", handleOrders);
app.get("/orders", handleOrders);
app.get("/pi/orders", handleOrders);

// ---- Feedback -> email ----
app.get("/api/feedback/public", async (req,res)=>{
  if(!requireSupabase(res)) return;
  const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);
  try{
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if(error) throw error;

    const items = (data || []).map((row)=>({
      id: row.id,
      name: row.name || "Anonymous",
      message: row.message || "",
      rating: row.rating ?? row.rating_value ?? null,
      createdAt: row.created_at || row.createdAt || ""
    }));
    res.json({ ok:true, feedback: items });
  }catch(err){
    console.error("Feedback fetch failed", err);
    res.status(500).json({ ok:false, message:"Failed to load feedback." });
  }
});

app.post("/api/feedback", async (req,res)=>{
  const { name, email, message } = req.body;
  if(!message) return res.status(400).json({ ok:false, message:"Message required" });
  if(!requireSupabase(res)) return;

  try{
    const emailReady = !!buildTransportConfig() && !!process.env.ORDER_TO;
    let emailSent = false;

    const fbId = "FB-" + Date.now();
    const entry = {
      id: fbId,
      name: name || "",
      email: email || "",
      message,
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from("feedback").insert(entry);
    if(error) throw error;

    if(isSheetsConfigured()){
      try{
        await appendFeedbackToSheet([
          new Date().toISOString(),
          fbId,
          name || "",
          email || "",
          message
        ]);
      }catch(sheetErr){
        console.error("Feedback sheet append failed", sheetErr);
      }
    }

    if(emailReady){
      const out = await sendEmailSafe({
        from: getSenderAddress(),
        to: process.env.ORDER_TO,
        subject: "New Feedback - Power Poly Supplies",
        html: `
          <h2>New Feedback</h2>
          <p><b>Name:</b> ${name || ""}</p>
          <p><b>Email:</b> ${email || ""}</p>
          <hr/>
          <p>${(message || "").replace(/\n/g,"<br/>")}</p>
        `
      });
      emailSent = out.ok;
    }

    res.json({ ok:true, emailSent });
  }catch(err){
    console.error("Feedback email failed", err);
    res.status(500).json({ ok:false, message:"Failed to send feedback" });
  }
});

app.listen(PORT, HOST, ()=>{
  const hostLabel = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Backend running on http://${hostLabel}:${PORT}`);
  if(isSheetsConfigured()){
    if(!supabase){
      console.warn("Supabase not configured; skipping sheets product sync.");
    }else{
      fetchProducts()
        .then((products)=> syncProductsToSheet(products || []))
        .catch((err)=>{ console.error("Products sheet sync failed", err); });
    }
  }
});
