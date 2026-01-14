import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { appendMessageToSheet, appendOrderToSheet, appendReviewToSheet, appendFeedbackToSheet, syncProductsToSheet, isSheetsConfigured } from "./googleSheets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

// ---- DB helpers ----
const DB_PATH = path.join(__dirname, "db.json");
const COMPANY_NAME = process.env.COMPANY_NAME || "Power Poly Supplies";
const COMPANY_SLOGAN = process.env.COMPANY_SLOGAN || "Premium garment packaging and hanger supplies.";
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || process.env.EMAIL_USER || "";
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || "";
const COMPANY_LOGO_PATH = process.env.COMPANY_LOGO_PATH
  || path.join(__dirname, "../frontend/assets/logo.jpg");

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
  const sender = COMPANY_EMAIL || process.env.EMAIL_USER || "";
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
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

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
  const stripeReady = !!stripe;
  const supabaseReady = !!supabase;
  const sheetsReady = isSheetsConfigured();
  res.json({
    ok:true,
    status:"up",
    stripe: stripeReady,
    supabase: supabaseReady,
    sheets: sheetsReady
  });
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
      language: customer?.language === "fr" ? "fr" : (customer?.language === "ko" ? "ko" : "en"),
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

    res.json({ ok:true, orderId });

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

      const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASS;
      const adminEmail = process.env.ORDER_TO;
      const logoExists = fs.existsSync(COMPANY_LOGO_PATH);
      const attachments = logoExists ? [{
        filename: path.basename(COMPANY_LOGO_PATH),
        path: COMPANY_LOGO_PATH,
        cid: "pps-logo"
      }] : [];

      if(emailConfigured){
        const headerText = customer?.language === "fr"
          ? "Recu"
          : customer?.language === "ko"
            ? "Receipt"
            : "Receipt";
        const introText = customer?.language === "fr"
          ? "Merci pour votre commande chez Power Poly Supplies. Nous la preparons avec soin. Voici votre recu."
          : customer?.language === "ko"
            ? "Thanks for choosing Power Poly Supplies. We are getting your order ready now. Here is your receipt."
            : "Thanks for choosing Power Poly Supplies. We are getting your order ready now. Here is your receipt.";
        const subjectText = customer?.language === "fr"
          ? `Merci pour votre commande ! Power Poly Supplies - ${orderId}`
          : customer?.language === "ko"
            ? `Thanks for your order! Power Poly Supplies receipt - ${orderId}`
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

        try{
          await transporter.sendMail({
            from: getSenderAddress(),
            to: customer.email,
            subject: subjectText,
            html: receiptHtml,
            attachments
          });
        }catch(mailErr){
          console.error("Customer receipt email failed", mailErr);
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

          try{
            await transporter.sendMail({
              from: getSenderAddress(),
              to: adminEmail,
              subject: `New Order ${orderId} (${order.paymentMethod})`,
              html: adminHtml,
              attachments
            });
          }catch(mailErr){
            console.error("Admin order email failed", mailErr);
          }
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
    const emailReady = process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.ORDER_TO;
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
      try{
        await transporter.sendMail({
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
        emailSent = true;
      }catch(mailErr){
        console.error("Contact email failed", mailErr);
      }
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
    const emailReady = process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.ORDER_TO;
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
      try{
        await transporter.sendMail({
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
        emailSent = true;
      }catch(mailErr){
        console.error("Help email failed", mailErr);
      }
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


  try{
    const code = Math.floor(1000 + Math.random()*9000).toString(); // 4-digit
    const expiresAt = Date.now() + 10*60*1000; // 10 minutes
    verificationCodes.set(emailKey, { code, expiresAt });

    const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASS;

    if(emailConfigured){
      await transporter.sendMail({
        from: getSenderAddress(),
        to: email,
        subject: "Welcome to Power Poly Supplies - your verification code",
        html: buildVerificationHtml(name, code)
      });
      res.json({ ok:true });
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
  verificationCodes.delete(email);

  const session = createSession(lower);
  const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASS;
  const shouldSendWelcome = emailConfigured;

  if(shouldSendWelcome){
    transporter.sendMail({
      from: getSenderAddress(),
      to: lower,
      subject: "Welcome to Power Poly Supplies!",
      html: buildWelcomeHtml(user.name || "", new Date(now))
    }).then(()=>{
      supabase.from("users")
        .update({ welcome_email_sent:true })
        .eq("email", lower)
        .then(({ error: updateErr })=>{
          if(updateErr) console.error("Supabase welcome email flag update failed", updateErr);
        });
    }).catch((mailErr)=>{
      console.error("Welcome email failed", mailErr);
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

// ---- Stripe Checkout ----
app.post("/api/stripe-checkout", async (req,res)=>{
  if(!stripe){
    return res.status(400).json({ ok:false, message:"Stripe not configured (set STRIPE_SECRET_KEY in .env)" });
  }

  try{
    const { items, customer } = req.body;
    if(!Array.isArray(items) || items.length === 0){
      return res.status(400).json({ ok:false, message:"No items to pay for." });
    }

    const language = customer?.language === "fr" ? "fr" : "en";
    if(!requireSupabase(res)) return;
    const productIds = (items || []).map(i=>i.id).filter(Boolean);
    let productsById = new Map();
    try{
      const products = await fetchProductsByIds(productIds);
      productsById = new Map(products.map(p=>[p.id, p]));
    }catch(err){
      console.error("Supabase products fetch for stripe failed", err);
    }
    const line_items = (items || []).map(i=>{
      const product = productsById.get(i.id);
      const unitAmount = product ? getTieredPriceCents(product, i.qty) : Number(i.priceCents || 0);
      const description = language === "fr"
        ? (product?.description_fr || i.description_fr || product?.description || i.description || "")
        : (product?.description || i.description || product?.description_fr || i.description_fr || "");
      return {
        quantity: i.qty,
        price_data:{
          currency: (i.currency || product?.currency || "CAD").toLowerCase(),
          unit_amount: unitAmount,
          product_data:{
            name: i.name || product?.name || "Item",
            description: description || undefined
          }
        }
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode:"payment",
      line_items,
      success_url: `${process.env.SITE_URL}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/cart.html`
      ,
      customer_email: customer?.email || undefined,
      metadata: {
        name: customer?.name || "",
        email: customer?.email || "",
        phone: customer?.phone || "",
        address_line1: customer?.address1 || "",
        address_line2: customer?.address2 || "",
        city: customer?.city || "",
        postal: customer?.postal || "",
        delivery_notes: customer?.deliveryNotes || "",
        province: customer?.province || "",
        language
      }
    });

    res.json({ ok:true, url: session.url });
  }catch(err){
    console.error("Stripe checkout error", err);
    res.status(500).json({ ok:false, message:"Stripe checkout failed. Check API keys." });
  }
});

// ---- Feedback -> email ----
app.post("/api/feedback", async (req,res)=>{
  const { name, email, message } = req.body;
  if(!message) return res.status(400).json({ ok:false, message:"Message required" });
  if(!requireSupabase(res)) return;

  try{
    const emailReady = process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.ORDER_TO;
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
      try{
        await transporter.sendMail({
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
        emailSent = true;
      }catch(mailErr){
        console.error("Feedback email failed", mailErr);
      }
    }

    res.json({ ok:true, emailSent });
  }catch(err){
    console.error("Feedback email failed", err);
    res.status(500).json({ ok:false, message:"Failed to send feedback" });
  }
});

// ---- Stripe: send receipt after successful checkout ----
app.post("/api/stripe-receipt", async (req,res)=>{
  if(!stripe){
    return res.status(400).json({ ok:false, message:"Stripe not configured (set STRIPE_SECRET_KEY in .env)" });
  }

  const { sessionId } = req.body || {};
  if(!sessionId) return res.status(400).json({ ok:false, message:"Missing session id" });

  try{
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand:["line_items"] });
    if(!session) return res.status(404).json({ ok:false, message:"Session not found" });

    const currency = (session.currency || "cad").toUpperCase();
    if(!requireSupabase(res)) return;
    let productsByName = new Map();
    try{
      const products = await fetchProducts();
      productsByName = new Map((products || []).map(p=>[(p.name || "").toLowerCase(), p]));
    }catch(err){
      console.error("Supabase products fetch for receipt failed", err);
    }
    const items = (session.line_items?.data || []).map(item=>{
      const name = item.description || item.price?.product?.name || "Item";
      const product = productsByName.get(String(name).toLowerCase());
      return {
        name,
        qty: item.quantity || 1,
        priceCents: item.amount_total ? Math.round(item.amount_total / (item.quantity || 1)) : (item.amount_subtotal || 0),
        currency,
        priceCentsBase: Number(product?.priceCents || 0),
        currencyBase: product?.currency || currency,
        description: product?.description || "",
        description_fr: product?.description_fr || "",
        description_ko: product?.description_ko || ""
      };
    });

    const subtotalCents = session.amount_subtotal || items.reduce((sum,i)=>sum + (i.priceCents * i.qty), 0);
    const totalCents = session.amount_total || subtotalCents;
    const taxCents = Math.max(0, totalCents - subtotalCents);
    const meta = session.metadata || {};
    const customer = {
      name: meta.name || session.customer_details?.name || "",
      email: meta.email || session.customer_details?.email || "",
      phone: meta.phone || session.customer_details?.phone || "",
      address1: meta.address_line1 || "",
      address2: meta.address_line2 || "",
      city: meta.city || "",
      postal: meta.postal || "",
      deliveryNotes: meta.delivery_notes || "",
      province: meta.province || "",
      language: meta.language === "fr" ? "fr" : (meta.language === "ko" ? "ko" : "en")
    };
    const taxLabel = `${PROVINCE_TAX_LABELS[customer?.province] || "Tax"}${customer?.province ? ` - ${customer.province}` : ""}`;
    const orderId = session.id;
    const nowIso = new Date().toISOString();

    const order = {
      id: orderId,
      status: "paid",
      payment_method: "stripe",
      customer,
      customer_email: (customer?.email || "").toLowerCase(),
      shipping: {
        zone: "Stripe",
        label: "Stripe",
        costCents: 0
      },
      items,
      total_cents: totalCents,
      currency,
      language: customer?.language === "fr" ? "fr" : (customer?.language === "ko" ? "ko" : "en"),
      created_at: nowIso
    };
    const { error: orderError } = await supabase.from("orders").upsert([order], { onConflict: "id" });
    if(orderError) throw orderError;

    const deliveryId = `DEL-${Date.now()}`;
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
      country: "Canada",
      delivery_notes: customer?.deliveryNotes || "",
      shipping_zone: "Stripe",
      shipping_label: "Stripe",
      status: "pending",
      created_at: nowIso
    };
    const { error: deliveryError } = await supabase.from("deliveries").upsert([delivery], { onConflict: "id" });
    if(deliveryError) throw deliveryError;

    const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASS;
    const adminEmail = process.env.ORDER_TO;
    const logoExists = fs.existsSync(COMPANY_LOGO_PATH);
    const attachments = logoExists ? [{
      filename: path.basename(COMPANY_LOGO_PATH),
      path: COMPANY_LOGO_PATH,
      cid: "pps-logo"
    }] : [];

    let customerEmailSent = false;
    let adminEmailSent = false;

    if(emailConfigured && customer.email){
      const headerText = customer?.language === "fr"
        ? "Recu"
        : customer?.language === "ko"
          ? "Receipt"
          : "Receipt";
      const introText = customer?.language === "fr"
        ? "Merci pour votre commande chez Power Poly Supplies. Nous la preparons avec soin. Voici votre recu."
        : customer?.language === "ko"
          ? "Thanks for choosing Power Poly Supplies. We are getting your order ready now. Here is your receipt."
          : "Thanks for choosing Power Poly Supplies. We are getting your order ready now. Here is your receipt.";
      const subjectText = customer?.language === "fr"
        ? `Merci pour votre commande ! Power Poly Supplies - ${orderId}`
        : customer?.language === "ko"
          ? `Thanks for your order! Power Poly Supplies receipt - ${orderId}`
          : `Thanks for your order! Power Poly Supplies receipt - ${orderId}`;

      const receiptHtml = buildReceiptHtml({
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
        logoCid: "pps-logo",
        logoExists,
        language: customer?.language
      });

      try{
        await transporter.sendMail({
          from: getSenderAddress(),
          to: customer.email,
          subject: subjectText,
          html: receiptHtml,
          attachments
        });
        customerEmailSent = true;
      }catch(mailErr){
        console.error("Stripe customer receipt email failed", mailErr);
      }
    }

    if(emailConfigured && adminEmail){
      const adminHtml = buildReceiptHtml({
        orderId,
        customer,
        items,
        subtotalCents,
        taxCents,
        totalCents,
        currency,
        taxLabel,
        headerText: "New Order",
        introText: "A new Stripe order has been placed on Power Poly Supplies.",
        logoCid: "pps-logo",
        logoExists,
        language: customer?.language
      });
      try{
        await transporter.sendMail({
          from: getSenderAddress(),
          to: adminEmail,
          subject: `New Stripe Order ${orderId}`,
          html: adminHtml,
          attachments
        });
        adminEmailSent = true;
      }catch(mailErr){
        console.error("Stripe admin email failed", mailErr);
      }
    }

    res.json({ ok:true, customerEmailSent, adminEmailSent });
  }catch(err){
    console.error("Stripe receipt error", err);
    res.status(500).json({ ok:false, message:"Stripe receipt failed. Check API keys." });
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
