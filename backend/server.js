import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import https from "https";
import { createClient } from "@supabase/supabase-js";
import { appendMessageToSheet, appendOrderToSheet, appendReviewToSheet, appendFeedbackToSheet, syncProductsToSheet, isSheetsConfigured } from "./googleSheets.js";
import { qboBuildAuthUrl, qboDownloadInvoicePdf, qboHandleCallback, qboIsConfigured, qboStatus, qboUpsertInvoiceForOrder } from "./quickbooks.js";
import squarePkg from "square";
const SquareClient = squarePkg.SquareClient || squarePkg.Client;
const SquareEnvironment = squarePkg.SquareEnvironment || squarePkg.Environment;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In Render (and other hosted environments), rely on platform env vars instead of a checked-in `.env`.
if(!process.env.RENDER){
  dotenv.config({ path: path.join(__dirname, ".env") });
}

const app = express();
app.set("trust proxy", 1);

function normalizeOrigin(value){
  const raw = String(value || "").trim();
  if(!raw) return "";
  return raw.replace(/\/+$/,"");
}

function buildCorsAllowlist(){
  const allow = new Set();
  const fromEnv = String(process.env.CORS_ORIGINS || "").split(",").map(s=>normalizeOrigin(s)).filter(Boolean);
  fromEnv.forEach(o=>allow.add(o));
  const site = normalizeOrigin(process.env.SITE_URL);
  if(site) allow.add(site);

  // Local dev convenience (safe because these are non-production origins).
  // Keep enabled even in hosted environments so you can test a deployed backend from a local frontend.
  [
    "http://localhost:3000",
    "http://localhost:4173",
    "http://localhost:5000",
    "http://localhost:5173",
    "http://localhost:5500",
    "http://localhost:5501",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:5501",
    "http://127.0.0.1:8080"
  ].forEach(o=>allow.add(o));
  return allow;
}

const corsAllowlist = buildCorsAllowlist();
app.use(cors({
  origin(origin, cb){
    if(!origin) return cb(null, true); // server-to-server / curl
    const normalized = normalizeOrigin(origin);
    const githubPagesOk = /^https:\/\/[a-z0-9-]+\.github\.io$/i.test(normalized);
    const ok = corsAllowlist.has(normalized) || githubPagesOk;
    return cb(null, ok);
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Admin-Token","X-Requested-With"],
  maxAge: 86400
}));

app.use((req,res,next)=>{
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

app.use(express.json({
  limit: "250kb",
  verify(req, res, buf){
    req.rawBody = buf;
  }
}));

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
    let value = String(process.env[name] || "").trim();
    // Strip wrapping quotes (common copy/paste mistake in dashboards).
    if(
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ){
      value = value.slice(1, -1).trim();
    }
    // Remove whitespace/newlines + zero-width chars that can silently break auth.
    value = value
      .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
      .replace(/[\u0000-\u001F\u007F]+/g, "");
    if(value) return value;
  }
  return "";
}

function readEnvFirstMeta(...names){
  for(const name of names){
    const value = readEnvFirst(name);
    if(value) return { name, value };
  }
  return { name: "", value: "" };
}

function requireAdmin(req, res){
  const adminToken = String(process.env.ADMIN_TOKEN || "").trim();
  if(!adminToken) return true;
  const header = String(req.headers["x-admin-token"] || "").trim();
  if(header !== adminToken){
    res.status(401).json({ ok:false, message:"Unauthorized" });
    return false;
  }
  return true;
}

function getSquareEnvironment(){
  const valueRaw = String(process.env.SQUARE_ENV || "").trim().toLowerCase();
  if(valueRaw === "sandbox") return SquareEnvironment.Sandbox;
  return SquareEnvironment.Production;
}

const squareAccessTokenSandboxMeta = readEnvFirstMeta(
  "SQUARE_ACCESS_TOKEN_SANDBOX",
  "SQUARE_SANDBOX_ACCESS_TOKEN",
  "SQUARE_ACCESS_TOKEN_SB",
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_TOKEN",
  "SQUARE_ACCESS"
);
const squareAccessTokenProductionMeta = readEnvFirstMeta(
  "SQUARE_ACCESS_TOKEN_PRODUCTION",
  "SQUARE_ACCESS_TOKEN_PROD",
  "SQUARE_PRODUCTION_ACCESS_TOKEN",
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_TOKEN",
  "SQUARE_ACCESS"
);
const squareLocationIdSandboxMeta = readEnvFirstMeta(
  "SQUARE_LOCATION_ID_SANDBOX",
  "SQUARE_SANDBOX_LOCATION_ID",
  "SQUARE_LOCATION_ID_SB",
  "SQUARE_LOCATION_ID",
  "SQUARE_LOCATIONID",
  "SQUARE_LOCATION",
  "SQUARE_LOC_ID"
);
const squareLocationIdProductionMeta = readEnvFirstMeta(
  "SQUARE_LOCATION_ID_PRODUCTION",
  "SQUARE_LOCATION_ID_PROD",
  "SQUARE_PRODUCTION_LOCATION_ID",
  "SQUARE_LOCATION_ID",
  "SQUARE_LOCATIONID",
  "SQUARE_LOCATION",
  "SQUARE_LOC_ID"
);
const siteUrlMeta = readEnvFirstMeta("SITE_URL", "FRONTEND_URL", "PUBLIC_SITE_URL");
const squareWebhookSignatureKeyMeta = readEnvFirstMeta("SQUARE_WEBHOOK_SIGNATURE_KEY", "SQUARE_WEBHOOK_SECRET", "SQUARE_SIGNATURE_KEY");
const squareWebhookUrlMeta = readEnvFirstMeta("SQUARE_WEBHOOK_URL");
const recaptchaSecretMeta = readEnvFirstMeta("RECAPTCHA_SECRET_KEY", "RECAPTCHA_SECRET", "GOOGLE_RECAPTCHA_SECRET");
const squareAccessTokenSandbox = squareAccessTokenSandboxMeta.value;
const squareAccessTokenProduction = squareAccessTokenProductionMeta.value;
const squareLocationIdSandbox = squareLocationIdSandboxMeta.value;
const squareLocationIdProduction = squareLocationIdProductionMeta.value;
const siteUrl = siteUrlMeta.value;
const squareWebhookSignatureKey = squareWebhookSignatureKeyMeta.value;
const squareWebhookUrl = squareWebhookUrlMeta.value;
const recaptchaSecretKey = recaptchaSecretMeta.value;
const squareEnvRaw = String(process.env.SQUARE_ENV || "").trim().toLowerCase();
const squareEnvMode = squareEnvRaw === "sandbox" ? "sandbox" : (squareEnvRaw === "production" ? "production" : "auto");
const squareClientSandbox = squareAccessTokenSandbox
  ? new SquareClient({ accessToken: squareAccessTokenSandbox, environment: SquareEnvironment.Sandbox })
  : null;
const squareClientProduction = squareAccessTokenProduction
  ? new SquareClient({ accessToken: squareAccessTokenProduction, environment: SquareEnvironment.Production })
  : null;

function getSquareClientCandidates({ requireLocationId = false } = {}){
  // Prefer the configured env first, but fall back to the other env on auth errors.
  // This helps recover from common misconfigurations (token/location belong to sandbox but SQUARE_ENV=production, or vice-versa).
  const out = [];
  const pushCandidate = (envLabel, client, locationId)=> {
    if(!client) return;
    if(requireLocationId && !locationId) return;
    out.push({ envLabel, client, locationId });
  };
  if(squareEnvMode === "production"){
    pushCandidate("production", squareClientProduction, squareLocationIdProduction);
    pushCandidate("sandbox", squareClientSandbox, squareLocationIdSandbox);
    return out;
  }
  if(squareEnvMode === "sandbox"){
    pushCandidate("sandbox", squareClientSandbox, squareLocationIdSandbox);
    pushCandidate("production", squareClientProduction, squareLocationIdProduction);
    return out;
  }
  // auto: try sandbox first, then production
  pushCandidate("sandbox", squareClientSandbox, squareLocationIdSandbox);
  pushCandidate("production", squareClientProduction, squareLocationIdProduction);
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

async function withSquareClient(fn, opts = {}){
  const candidates = getSquareClientCandidates(opts);
  if(!candidates.length){
    const error = new Error("Square client not configured.");
    error.statusCode = 400;
    throw error;
  }
  let lastErr = null;
  for(let i = 0; i < candidates.length; i++){
    const candidate = candidates[i];
    try{
      return await fn(candidate);
    }catch(err){
      lastErr = err;
      if(!isSquareAuthError(err) || i === candidates.length - 1) throw err;
    }
  }
  throw lastErr || new Error("Square request failed.");
}

function maskSecret(value){
  const text = String(value || "").trim();
  if(!text) return "";
  if(text.length <= 10) return `${text.slice(0,2)}…${text.slice(-2)}`;
  return `${text.slice(0,6)}…${text.slice(-4)}`;
}

function verifySquareWebhook(req){
  const signature = String(req.headers["x-square-signature"] || "").trim();
  if(!signature) return { ok:false, reason:"missing_signature" };
  if(!squareWebhookSignatureKey) return { ok:false, reason:"missing_signature_key" };

  const raw = req.rawBody;
  if(!raw || !(raw instanceof Buffer)) return { ok:false, reason:"missing_raw_body" };

  const url = String(squareWebhookUrl || "").trim();
  if(!url) return { ok:false, reason:"missing_webhook_url" };

  const signed = url + raw.toString("utf8");
  const expected = crypto
    .createHmac("sha256", squareWebhookSignatureKey)
    .update(signed, "utf8")
    .digest("base64");

  try{
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if(a.length !== b.length) return { ok:false, reason:"mismatch" };
    if(!crypto.timingSafeEqual(a, b)) return { ok:false, reason:"mismatch" };
    return { ok:true };
  }catch{
    return { ok:false, reason:"mismatch" };
  }
}

function getClientIp(req){
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").trim();
  const forwardedIp = forwardedFor ? String(forwardedFor.split(",")[0] || "").trim() : "";
  return forwardedIp || String(req.ip || req.socket?.remoteAddress || "").trim();
}

function rateLimit({ windowMs, max, keyPrefix }){
  const buckets = new Map();
  const win = Math.max(1000, Number(windowMs) || 60000);
  const cap = Math.max(1, Number(max) || 30);
  const prefix = String(keyPrefix || "rl:");

  return (req,res,next)=>{
    const now = Date.now();
    const ip = getClientIp(req);
    const key = `${prefix}${ip}`;
    const current = buckets.get(key);
    if(!current || now >= current.resetAt){
      buckets.set(key, { count: 1, resetAt: now + win });
      return next();
    }
    current.count += 1;
    if(current.count > cap){
      const retrySeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retrySeconds));
      return res.status(429).json({ ok:false, message:"Too many requests. Please try again shortly." });
    }
    return next();
  };
}

function postUrlEncoded(url, params){
  const body = new URLSearchParams(params || {}).toString();
  if(typeof fetch === "function"){
    return fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body
    }).then(async (res)=> {
      const text = await res.text().catch(()=> "");
      return { ok: res.ok, status: res.status, text };
    });
  }
  return new Promise((resolve, reject)=> {
    try{
      const parsed = new URL(url);
      const req = https.request({
        method:"POST",
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ""),
        headers:{
          "Content-Type":"application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body)
        }
      }, (res)=> {
        let text = "";
        res.on("data", (chunk)=>{ text += String(chunk); });
        res.on("end", ()=> resolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300, status: res.statusCode || 0, text }));
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    }catch(err){
      reject(err);
    }
  });
}

async function verifyRecaptcha(token){
  if(!recaptchaSecretKey) return { ok:true, skipped:true, reason:"not_configured" };
  const response = String(token || "").trim();
  if(!response) return { ok:false, skipped:false, reason:"missing_token" };
  try{
    const result = await postUrlEncoded("https://www.google.com/recaptcha/api/siteverify", {
      secret: recaptchaSecretKey,
      response
    });
    if(!result.ok) return { ok:false, skipped:false, reason:"http_error", status: result.status };
    const data = JSON.parse(result.text || "{}");
    return { ok: !!data?.success, skipped:false, data };
  }catch(err){
    return { ok:false, skipped:false, reason:"network_error", error: String(err?.message || err) };
  }
}

async function squareTest(client, label){
  if(!client) return { ok:false, label, skipped:true };
  try{
    const result = await client.locations.list();
    const locations = Array.isArray(result?.locations) ? result.locations : [];
    return {
      ok:true,
      label,
      baseUrl: String(client?.environment || ""),
      locations: locations.map((l)=>({ id: l.id || "", name: l.name || "", status: l.status || "" }))
    };
  }catch(err){
    const summary = summarizeSquareError(err);
    return {
      ok:false,
      label,
      baseUrl: String(client?.environment || ""),
      statusCode: summary.statusCode,
      message: summary.message,
      errors: summary.errors,
      requestId: summary.requestId
    };
  }
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
  discountCents = 0,
  discountLabel = "",
  taxCents,
  totalCents,
  currency,
  taxLabel,
  headerText,
  introText,
  logoUrl,
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
  const discountRow = discountCents > 0
    ? `
      <tr>
        <td style="padding:6px 0; color:#6b7280;">${escapeHtml(discountLabel || "Discount")}</td>
        <td style="padding:6px 0; text-align:right;">-${formatMoney(discountCents, currency)}</td>
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

  const safeLogoUrl = String(logoUrl || "").trim();
  const logoHtml = safeLogoUrl
    ? `<img src="${escapeHtml(safeLogoUrl)}" alt="${escapeHtml(COMPANY_NAME)} logo" style="height:48px; max-width:160px; object-fit:contain;"/>`
    : (logoExists ? `<img src="cid:${logoCid}" alt="${escapeHtml(COMPANY_NAME)} logo" style="height:48px; max-width:160px; object-fit:contain;"/>` : "");

  return `
    <div style="font-family:Arial,sans-serif; color:#1f2933; max-width:680px; margin:0 auto; line-height:1.5;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:2px solid #e5e7eb; padding-bottom:16px; margin-bottom:16px;">
        <div>
          <div style="font-size:20px; font-weight:700;">${COMPANY_NAME}</div>
          <div style="font-size:13px; color:#6b7280;">${COMPANY_SLOGAN}</div>
        </div>
        ${logoHtml}
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
        ${discountRow}
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

function getPublicLogoUrl(){
  const base = String(siteUrl || "").trim().replace(/\/+$/, "");
  if(!base) return "";
  const filename = path.basename(COMPANY_LOGO_PATH || "logo.jpg");
  return `${base}/assets/${encodeURIComponent(filename)}`;
}

function getSenderAddress(){
  const sender = process.env.EMAIL_FROM || COMPANY_EMAIL || process.env.EMAIL_USER || "";
  if(!sender) return COMPANY_NAME;
  return `"${COMPANY_NAME}" <${sender}>`;
}

function getEmailConfigSummary(){
  const config = buildTransportConfig();
  const sendgridKey = String(process.env.SENDGRID_API_KEY || "").trim();
  const sendgridFrom = String(process.env.SENDGRID_FROM || process.env.EMAIL_FROM || COMPANY_EMAIL || process.env.EMAIL_USER || "").trim();
  const sendgridConfigured = !!(sendgridKey && sendgridFrom);
  if(!config) return { configured:false, sendgrid: { configured: sendgridConfigured } };
  return {
    configured:true,
    from: getSenderAddress(),
    transport: {
      service: config.service || "",
      host: config.host || "",
      port: config.port || null,
      secure: !!config.secure
    },
    sendgrid: { configured: sendgridConfigured }
  };
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

function buildWelcomeText(name, loginDate){
  const safeFirstName = firstNameFrom(name);
  const safeDate = formatLetterDate(loginDate);
  return [
    `Dear ${safeFirstName},`,
    "",
    "Welcome to Power Poly Supplies.",
    "This account gives you quick access to bulk pricing, order history, and faster checkout.",
    "",
    `Date: ${safeDate}`,
    "",
    "Power Poly Supplies"
  ].join("\n");
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

function buildVerificationText(name, code){
  const safeFirstName = firstNameFrom(name);
  return [
    `Hi ${safeFirstName},`,
    "",
    "Your Power Poly verification code is:",
    String(code || "").trim(),
    "",
    "This code expires in 10 minutes.",
    "If you did not request this, you can ignore this email.",
    "",
    "Power Poly Supplies"
  ].join("\n");
}

// ---- Email transporter ----
let emailTransporter = null;

function buildTransportConfig(){
  const user = String(process.env.EMAIL_USER || "").trim();
  // App passwords are sometimes pasted with spaces; strip whitespace.
  const pass = String(process.env.EMAIL_PASS || "").replace(/\s+/g, "");
  if(!user || !pass) return null;

  const host = (process.env.EMAIL_HOST || "").trim();
  const portRaw = (process.env.EMAIL_PORT || "").trim();
  const port = portRaw ? Number(portRaw) : 0;
  const secureEnv = String(process.env.EMAIL_SECURE || "").trim().toLowerCase();
  const secure = secureEnv === "true" || secureEnv === "1" || port === 465;
  const service = (process.env.EMAIL_SERVICE || "").trim();
  const servername = host || (service === "gmail" ? "smtp.gmail.com" : "");
  const tls = servername ? { servername } : undefined;
  const connectionTimeout = 20_000;
  const greetingTimeout = 20_000;
  const socketTimeout = 60_000;

  if(host){
    return {
      host,
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure,
      auth: { user, pass },
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      tls
    };
  }

  if(service){
    return {
      service,
      auth: { user, pass },
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      tls
    };
  }

  // Default (works for Gmail only if you use an App Password)
  return {
    service: "gmail",
    auth: { user, pass },
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
    tls: { servername: "smtp.gmail.com" }
  };
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
  if(!transporter) return { ok:false, code:"PPS_SMTP_NOT_CONFIGURED", message:"Email not configured." };
  try{
    const timeoutMs = Math.max(5_000, Number(process.env.EMAIL_SEND_TIMEOUT_MS) || 25_000);
    await Promise.race([
      transporter.sendMail(mail),
      new Promise((_, reject)=> setTimeout(()=> reject(Object.assign(new Error("SMTP send timeout"), { code: "PPS_SMTP_SEND_TIMEOUT" })), timeoutMs))
    ]);
    return { ok:true };
  }catch(err){
    console.error("Email send failed", err);
    return {
      ok:false,
      message:"Failed to send email.",
      code: String(err?.code || ""),
      response: String(err?.response || ""),
      command: String(err?.command || ""),
      errorMessage: String(err?.message || "")
    };
  }
}

async function sendEmailSendGrid({ from, to, subject, html, text }){
  const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
  const senderEmail = String(process.env.SENDGRID_FROM || "").trim()
    || String(process.env.EMAIL_FROM || "").trim()
    || String(COMPANY_EMAIL || "").trim()
    || String(process.env.EMAIL_USER || "").trim();
  if(!apiKey || !senderEmail) return { ok:false, message:"SendGrid not configured." };

  const toEmail = String(to || "").trim();
  if(!toEmail) return { ok:false, message:"Missing recipient email." };

  const senderNameMatch = String(from || "").match(/^"([^"]+)"\s*<.+>$/);
  const senderName = senderNameMatch ? senderNameMatch[1] : COMPANY_NAME;

  const payload = {
    personalizations: [{ to: [{ email: toEmail }] }],
    from: { email: senderEmail, name: senderName || COMPANY_NAME },
    reply_to: { email: senderEmail, name: senderName || COMPANY_NAME },
    subject: String(subject || ""),
    content: [
      { type: "text/plain", value: String(text || "").trim() || " " },
      { type: "text/html", value: String(html || "").trim() || "<p></p>" }
    ]
  };

  try{
    const timeoutMs = Math.max(2_000, Number(process.env.SENDGRID_TIMEOUT_MS) || 8_000);
    const controller = new AbortController();
    const timeoutId = setTimeout(()=> controller.abort(), timeoutMs);
    const res = await fetch("https://api.sendgrid.com/v3/mail/send",{
      method:"POST",
      headers:{
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":"application/json"
      },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });
    clearTimeout(timeoutId);
    if(res.status >= 200 && res.status < 300){
      return { ok:true };
    }
    const body = await res.text().catch(()=> "");
    return { ok:false, message:"SendGrid send failed.", status: res.status, response: body.slice(0, 2000) };
  }catch(err){
    if(err?.name === "AbortError"){
      return { ok:false, code:"PPS_SENDGRID_TIMEOUT", message:"SendGrid send timed out." };
    }
    return { ok:false, message:"SendGrid send failed.", errorMessage: String(err?.message || "") };
  }
}

async function sendEmailAny(mail){
  const summary = getEmailConfigSummary();
  const sendgridConfigured = !!summary?.sendgrid?.configured;
  const smtpVerified = !!emailVerifyCache.ok;

  // When SMTP is present but blocked (common on hosted platforms), skip waiting for SMTP timeouts.
  // If SendGrid is configured and SMTP isn't verified, prefer SendGrid immediately.
  if(sendgridConfigured && !smtpVerified){
    const sg = await sendEmailSendGrid({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text
    });
    if(sg.ok) return { ok:true, provider:"sendgrid" };
    return { ok:false, provider:"sendgrid", sendgrid: sg };
  }

  // Prefer SMTP if it works; fall back to SendGrid API when SMTP is blocked/times out.
  const smtp = await sendEmailSafe(mail);
  if(smtp.ok) return { ok:true, provider:"smtp" };

  const code = String(smtp.code || "");
  const shouldFallback = code === "PPS_SMTP_SEND_TIMEOUT"
    || code === "PPS_SMTP_VERIFY_TIMEOUT"
    || code === "ETIMEDOUT"
    || code === "PPS_SMTP_NOT_CONFIGURED";
  if(!shouldFallback) return { ...smtp, provider:"smtp" };

  const sg = await sendEmailSendGrid({
    from: mail.from,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text
  });
  if(sg.ok) return { ok:true, provider:"sendgrid" };
  return { ok:false, provider:"sendgrid", ...smtp, sendgrid: sg };
}

// ---- Email verification (cached) ----
let emailVerifyCache = { at: 0, ok: false, error: null };

async function verifyEmailTransporter({ force = false } = {}){
  const transporter = getEmailTransporter();
  const summary = getEmailConfigSummary();
  if(!transporter) return { ok:false, ...summary, verified:false, message:"Email not configured." };

  const ttlMs = 60_000;
  if(!force && emailVerifyCache.at && (Date.now() - emailVerifyCache.at) < ttlMs){
    return {
      ok: emailVerifyCache.ok,
      ...summary,
      verified: emailVerifyCache.ok,
      message: emailVerifyCache.ok ? "Verified." : "Email configured but verification failed.",
      error: emailVerifyCache.error
    };
  }

  try{
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject)=> setTimeout(
        ()=> reject(Object.assign(new Error("SMTP verify timeout"), { code: "PPS_SMTP_VERIFY_TIMEOUT" })),
        Math.max(5_000, Number(process.env.EMAIL_VERIFY_TIMEOUT_MS) || 25_000)
      ))
    ]);
    emailVerifyCache = { at: Date.now(), ok: true, error: null };
    return { ok:true, ...summary, verified:true, message:"Verified." };
  }catch(err){
    const error = {
      code: String(err?.code || ""),
      response: String(err?.response || ""),
      command: String(err?.command || ""),
      message: String(err?.message || "")
    };
    emailVerifyCache = { at: Date.now(), ok: false, error };
    return { ok:false, ...summary, verified:false, message:"Email configured but verification failed.", error };
  }
}

// Simple in-memory verification store
const verificationCodes = new Map();
const authSessions = new Map();
const oauthStates = new Map(); // state -> { provider, nextUrl, createdAt }
let verificationStoreMode = "auto"; // auto | supabase | memory

async function trySupabaseUpsertVerificationCode(email, code, expiresAt){
  if(!supabase) return { ok:false, reason:"no_supabase" };
  try{
    const payload = {
      email: String(email || "").trim().toLowerCase(),
      code: String(code || ""),
      expires_at: Number(expiresAt) || 0,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase
      .from("verification_codes")
      .upsert(payload, { onConflict: "email" });
    if(error){
      const msg = String(error.message || "");
      if(msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")){
        return { ok:false, reason:"table_missing", error };
      }
      return { ok:false, reason:"supabase_error", error };
    }
    return { ok:true };
  }catch(err){
    return { ok:false, reason:"exception", error: err };
  }
}

async function trySupabaseGetVerificationCode(email){
  if(!supabase) return { ok:false, reason:"no_supabase", entry:null };
  try{
    const key = String(email || "").trim().toLowerCase();
    if(!key) return { ok:false, reason:"no_email", entry:null };
    const { data, error } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("email", key)
      .maybeSingle();
    if(error){
      const msg = String(error.message || "");
      if(msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")){
        return { ok:false, reason:"table_missing", entry:null, error };
      }
      return { ok:false, reason:"supabase_error", entry:null, error };
    }
    if(!data) return { ok:true, entry:null };
    return {
      ok:true,
      entry: {
        code: String(data.code || ""),
        expiresAt: Number(data.expires_at) || 0
      }
    };
  }catch(err){
    return { ok:false, reason:"exception", entry:null, error: err };
  }
}

async function trySupabaseDeleteVerificationCode(email){
  if(!supabase) return { ok:false, reason:"no_supabase" };
  try{
    const key = String(email || "").trim().toLowerCase();
    if(!key) return { ok:false, reason:"no_email" };
    const { error } = await supabase.from("verification_codes").delete().eq("email", key);
    if(error){
      const msg = String(error.message || "");
      if(msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")){
        return { ok:false, reason:"table_missing", error };
      }
      return { ok:false, reason:"supabase_error", error };
    }
    return { ok:true };
  }catch(err){
    return { ok:false, reason:"exception", error: err };
  }
}

async function putVerificationCode(emailKey, { code, expiresAt }){
  const key = String(emailKey || "").trim().toLowerCase();
  if(!key) return;

  // Always keep an in-memory fallback (single-instance dev works without Supabase table).
  verificationCodes.set(key, { code: String(code || ""), expiresAt: Number(expiresAt) || 0 });

  if(verificationStoreMode === "memory") return;
  if(verificationStoreMode === "auto" || verificationStoreMode === "supabase"){
    const out = await trySupabaseUpsertVerificationCode(key, code, expiresAt);
    if(out.ok){
      verificationStoreMode = "supabase";
      return;
    }
    // If the table doesn't exist, don't keep spamming Supabase on every request.
    if(out.reason === "table_missing"){
      verificationStoreMode = "memory";
    }
  }
}

async function getVerificationCode(emailKey){
  const key = String(emailKey || "").trim().toLowerCase();
  if(!key) return null;

  if(verificationStoreMode === "supabase" || verificationStoreMode === "auto"){
    const out = await trySupabaseGetVerificationCode(key);
    if(out.ok){
      if(out.entry) return out.entry;
      // If Supabase is enabled and says "no row", fall back to memory (useful right after deploy).
    }else if(out.reason === "table_missing"){
      verificationStoreMode = "memory";
    }
  }

  return verificationCodes.get(key) || null;
}

async function deleteVerificationCode(emailKey){
  const key = String(emailKey || "").trim().toLowerCase();
  if(!key) return;

  verificationCodes.delete(key);
  if(verificationStoreMode === "supabase"){
    const out = await trySupabaseDeleteVerificationCode(key);
    if(!out.ok && out.reason === "table_missing"){
      verificationStoreMode = "memory";
    }
  }
}

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

function base64Url(bytes){
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createOauthState({ provider, nextUrl }){
  const state = base64Url(crypto.randomBytes(18));
  oauthStates.set(state, {
    provider: String(provider || ""),
    nextUrl: String(nextUrl || ""),
    createdAt: Date.now()
  });
  return state;
}

function consumeOauthState(state){
  const key = String(state || "").trim();
  if(!key) return null;
  const entry = oauthStates.get(key);
  oauthStates.delete(key);
  if(!entry) return null;
  const ttlMs = 10 * 60 * 1000;
  if(Date.now() - Number(entry.createdAt || 0) > ttlMs) return null;
  return entry;
}

function getFrontendBase(req){
  const configured = String(siteUrl || "").trim().replace(/\/+$/,"");
  if(configured) return configured;
  if(HAS_FRONTEND){
    const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
    const host = String(req.headers["x-forwarded-host"] || req.get("host") || "").split(",")[0].trim();
    if(host) return `${proto}://${host}`.replace(/\/+$/,"");
  }
  return "";
}

function getBackendBase(req){
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.get("host") || "").split(",")[0].trim();
  if(!host) return "";
  return `${proto}://${host}`.replace(/\/+$/,"");
}

function sanitizeNextUrl(nextUrl, frontendBase){
  const next = String(nextUrl || "").trim();
  if(!next) return "";
  // Allow relative paths.
  if(next.startsWith("/") && !next.startsWith("//")) return next;
  // Allow same-origin absolute URLs only.
  try{
    const base = String(frontendBase || "").trim();
    if(!base) return "";
    const nextParsed = new URL(next);
    const baseParsed = new URL(base);
    if(nextParsed.origin !== baseParsed.origin) return "";
    return nextParsed.pathname + nextParsed.search + nextParsed.hash;
  }catch{
    return "";
  }
}

async function upsertOauthUser({ email, name }){
  const lower = String(email || "").trim().toLowerCase();
  const displayName = String(name || "").trim().slice(0, 80);
  if(!lower) throw new Error("Missing email from OAuth provider.");

  const now = new Date().toISOString();
  let existing = null;
  try{
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", lower)
      .maybeSingle();
    if(error) throw error;
    existing = data || null;
  }catch(err){
    console.error("Supabase OAuth user lookup failed", err);
    const e = new Error("Unable to log in.");
    e.status = 500;
    throw e;
  }

  if(existing){
    supabase.from("users")
      .update({ last_login_at: now, ...(displayName ? { name: displayName } : {}) })
      .eq("email", lower)
      .then(({ error })=>{
        if(error) console.error("Supabase OAuth user update failed", error);
      });
    return { email: lower, name: existing?.name || displayName || "" };
  }

  const userId = "USR-" + Date.now();
  const userRow = {
    id: userId,
    email: lower,
    name: displayName,
    // Set a random password hash so the row matches the expected schema.
    password_hash: hashPassword(crypto.randomBytes(24).toString("hex")),
    created_at: now,
    last_login_at: now,
    first_login_at: now,
    welcome_email_sent: false
  };

  try{
    const { error: insertErr } = await supabase.from("users").insert(userRow);
    if(insertErr) throw insertErr;
  }catch(err){
    console.error("Supabase OAuth user insert failed", err);
    const e = new Error("Unable to create account.");
    e.status = 500;
    throw e;
  }

  const emailConfigured = !!buildTransportConfig();
  if(emailConfigured){
    try{
      const out = await sendEmailAny({
        from: getSenderAddress(),
        to: lower,
        subject: "Welcome to Power Poly Supplies!",
        html: buildWelcomeHtml(displayName || "", new Date(now))
      });
      if(out.ok){
        supabase.from("users")
          .update({ welcome_email_sent:true })
          .eq("email", lower)
          .then(({ error: updateErr })=>{
            if(updateErr) console.error("Supabase OAuth welcome email flag update failed", updateErr);
          });
      }else{
        console.error("OAuth welcome email failed", out);
      }
    }catch(err){
      console.error("OAuth welcome email failed", err);
    }
  }

  return { email: lower, name: displayName || "" };
}


// Health check
app.get("/api/health",(req,res)=>{
  const supabaseReady = !!supabase;
  const sheetsReady = isSheetsConfigured();
  const emailSummary = getEmailConfigSummary();
  const emailSmtpConfigured = !!buildTransportConfig();
  const emailSmtpVerified = !!emailVerifyCache.ok;
  const emailSendgridConfigured = !!emailSummary?.sendgrid?.configured;
  const emailReady = emailSmtpVerified || emailSendgridConfigured;
  const squareCheckoutCandidates = getSquareClientCandidates({ requireLocationId: true });
  res.json({
    ok:true,
    status:"up",
    square: {
      configured: !!(squareCheckoutCandidates.length && siteUrl),
      env: squareEnvMode,
      siteUrlSet: !!siteUrl,
      webhook: {
        signatureKeySet: !!squareWebhookSignatureKey,
        signatureKeyVar: squareWebhookSignatureKeyMeta.name,
        webhookUrlSet: !!squareWebhookUrl,
        webhookUrlVar: squareWebhookUrlMeta.name
      },
      checkoutCandidates: squareCheckoutCandidates.map((c)=> c.envLabel),
      sandbox: {
        accessTokenSet: !!squareAccessTokenSandbox,
        accessTokenHint: maskSecret(squareAccessTokenSandbox),
        accessTokenVar: squareAccessTokenSandboxMeta.name,
        accessTokenLength: String(squareAccessTokenSandbox || "").length,
        locationIdSet: !!squareLocationIdSandbox,
        locationIdHint: maskSecret(squareLocationIdSandbox),
        locationIdVar: squareLocationIdSandboxMeta.name,
        locationIdLength: String(squareLocationIdSandbox || "").length
      },
      production: {
        accessTokenSet: !!squareAccessTokenProduction,
        accessTokenHint: maskSecret(squareAccessTokenProduction),
        accessTokenVar: squareAccessTokenProductionMeta.name,
        accessTokenLength: String(squareAccessTokenProduction || "").length,
        locationIdSet: !!squareLocationIdProduction,
        locationIdHint: maskSecret(squareLocationIdProduction),
        locationIdVar: squareLocationIdProductionMeta.name,
        locationIdLength: String(squareLocationIdProduction || "").length
      }
    },
    email: {
      ready: emailReady,
      configured: emailReady,
      verified: emailSmtpVerified,
      smtp: { configured: emailSmtpConfigured, verified: emailSmtpVerified },
      sendgrid: { configured: emailSendgridConfigured }
    },
    supabase: supabaseReady,
    sheets: sheetsReady
  });
});

app.get("/api/email/health", async (req,res)=>{
  const out = await verifyEmailTransporter({ force: true });
  const sendgridConfigured = !!out?.sendgrid?.configured;
  const ready = !!out?.verified || sendgridConfigured;
  const message = ready
    ? (out?.verified
      ? "SMTP verified."
      : (out?.configured ? "SMTP verification failed; SendGrid fallback enabled." : "SMTP not configured; SendGrid enabled."))
    : String(out?.message || "Email not ready.");
  const payload = {
    ...out,
    ok: ready,
    ready,
    message,
    smtp: { configured: !!out?.configured, verified: !!out?.verified },
    sendgrid: { configured: sendgridConfigured }
  };
  res.status(ready ? 200 : 500).json(payload);
});

app.get("/api/email/diagnose", async (req,res)=>{
  const adminToken = String(process.env.ADMIN_TOKEN || "").trim();
  if(adminToken){
    const header = String(req.headers["x-admin-token"] || "").trim();
    if(header !== adminToken){
      return res.status(401).json({ ok:false, message:"Unauthorized" });
    }
  }

  const verification = await verifyEmailTransporter({ force: true });
  const sendgridConfigured = !!verification?.sendgrid?.configured;
  const ready = !!verification?.verified || sendgridConfigured;

  const to = String(req.query.to || "").trim();
  if(!to){
    return res.status(200).json({
      ready,
      ...verification,
      smtp: { configured: !!verification?.configured, verified: !!verification?.verified },
      sendgrid: { configured: sendgridConfigured },
      ok: ready,
      message: ready
        ? "Provide ?to=you@example.com to send a test email."
        : "Email not ready. Configure SMTP or SendGrid."
    });
  }

  const out = await sendEmailAny({
    from: getSenderAddress(),
    to,
    subject: "Power Poly Supplies - Email test",
    html: "<p>This is a test email from Power Poly Supplies.</p>"
  });

  if(!out.ok){
    return res.status(500).json({
      ready,
      ...verification,
      smtp: { configured: !!verification?.configured, verified: !!verification?.verified },
      sendgrid: { configured: sendgridConfigured },
      ok:false,
      send: out
    });
  }
  res.json({
    ready:true,
    ...verification,
    smtp: { configured: !!verification?.configured, verified: !!verification?.verified },
    sendgrid: { configured: sendgridConfigured },
    ok:true,
    send: out
  });
});

app.get("/api/square/diagnose", async (req,res)=>{
  if(!requireSquareClientConfigured(res)) return;
  try{
    const prod = await squareTest(squareClientProduction, "production");
    const sandbox = await squareTest(squareClientSandbox, "sandbox");
    res.json({
      ok: !!(prod.ok || sandbox.ok),
      envMode: squareEnvMode,
      sandbox: {
        accessTokenHint: maskSecret(squareAccessTokenSandbox),
        accessTokenVar: squareAccessTokenSandboxMeta.name,
        accessTokenLength: String(squareAccessTokenSandbox || "").length,
        locationIdHint: maskSecret(squareLocationIdSandbox),
        locationIdVar: squareLocationIdSandboxMeta.name,
        locationIdLength: String(squareLocationIdSandbox || "").length
      },
      production: {
        accessTokenHint: maskSecret(squareAccessTokenProduction),
        accessTokenVar: squareAccessTokenProductionMeta.name,
        accessTokenLength: String(squareAccessTokenProduction || "").length,
        locationIdHint: maskSecret(squareLocationIdProduction),
        locationIdVar: squareLocationIdProductionMeta.name,
        locationIdLength: String(squareLocationIdProduction || "").length
      },
      expectedBaseUrls: {
        production: SquareEnvironment.Production,
        sandbox: SquareEnvironment.Sandbox
      },
      productionTest: prod,
      sandboxTest: sandbox
    });
  }catch(err){
    const summary = summarizeSquareError(err);
    res.status(summary.statusCode).json({
      ok:false,
      envMode: squareEnvMode,
      message: summary.message,
      errors: summary.errors,
      requestId: summary.requestId
    });
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

// ---- Admin: QuickBooks Online ----
app.get("/api/admin/qbo/status", (req,res)=>{
  if(!requireAdmin(req,res)) return;
  res.json({ ok:true, ...qboStatus() });
});

app.get("/api/admin/qbo/auth-url", (req,res)=>{
  if(!requireAdmin(req,res)) return;
  try{
    const out = qboBuildAuthUrl();
    res.json({ ok:true, url: out.url });
  }catch(err){
    res.status(400).json({ ok:false, message: String(err?.message || "Unable to build QuickBooks auth URL.") });
  }
});

app.get("/api/qbo/callback", async (req,res)=>{
  try{
    const code = String(req.query?.code || "").trim();
    const realmId = String(req.query?.realmId || "").trim();
    const state = String(req.query?.state || "").trim();
    if(!code || !realmId || !state){
      return res.status(400).send("Missing code/realmId/state.");
    }
    const out = await qboHandleCallback({ code, realmId, state });
    const env = String(out?.env || "");
    res.status(200).send(
      `QuickBooks connected successfully. Realm: ${out?.realmId || ""} (${env}). You can close this tab.`
    );
  }catch(err){
    console.error("QBO callback error", err);
    res.status(400).send(`QuickBooks connection failed: ${String(err?.message || "Unknown error")}`);
  }
});

app.post("/api/admin/qbo/sync-order", async (req,res)=>{
  if(!requireAdmin(req,res)) return;
  if(!requireSupabase(res)) return;
  if(!qboIsConfigured()){
    return res.status(400).json({ ok:false, message:"QuickBooks not configured on the backend." });
  }

  try{
    const orderId = String(req.body?.orderId || "").trim();
    if(!orderId) return res.status(400).json({ ok:false, message:"orderId is required" });

    const { data: orderRow, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if(error) throw error;
    if(!orderRow) return res.status(404).json({ ok:false, message:"Order not found." });

    const sendEmail = req.body?.sendEmail;
    const out = await qboUpsertInvoiceForOrder(orderRow, { sendEmail });
    res.json({ ok:true, orderId, ...out });
  }catch(err){
    console.error("QBO sync order error", err);
    res.status(500).json({ ok:false, message:String(err?.message || "Unable to sync order to QuickBooks.") });
  }
});

app.get("/api/admin/qbo/invoice-pdf", async (req,res)=>{
  if(!requireAdmin(req,res)) return;
  try{
    const invoiceId = String(req.query?.invoiceId || "").trim();
    if(!invoiceId) return res.status(400).json({ ok:false, message:"invoiceId is required" });
    const pdf = await qboDownloadInvoicePdf(invoiceId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"invoice-${invoiceId}.pdf\"`);
    res.status(200).send(pdf);
  }catch(err){
    console.error("QBO invoice pdf error", err);
    res.status(500).json({ ok:false, message:String(err?.message || "Unable to download invoice PDF.") });
  }
});

// ---- Create pay-later order + reduce stock + email ----
app.post("/api/order", async (req,res)=>{
  const { customer, items, currency, paymentMethod, shipping, discount } = req.body;
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
    const rawDiscountCents = Math.max(0, Math.round(Number(discount?.amountCents ?? 0)));
    const discountCents = Math.min(subtotalCents, rawDiscountCents);
    const discountedSubtotalCents = Math.max(0, subtotalCents - discountCents);
    const taxData = calculateTaxCents(discountedSubtotalCents, customer?.province);
    const totalCentsComputed = discountedSubtotalCents + (shippingInfo.amountCents || 0) + taxData.taxCents;
    const orderId = "ORD-" + Date.now();
    const customerWithRewards = discountCents > 0
      ? {
          ...(customer || {}),
          rewards: {
            source: String(discount?.source || "rewards"),
            code: String(discount?.code || "").trim(),
            amountCents: discountCents
          }
        }
      : customer;
    const order = {
      id: orderId,
      status: "pending",
      payment_method: paymentMethod || "pay_later",
      customer: customerWithRewards,
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

    // Stock updates can be slow; apply them in the background after responding.
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

    const emailSummary = getEmailConfigSummary();
    const emailSmtpConfigured = !!buildTransportConfig();
    const emailSendgridConfigured = !!emailSummary?.sendgrid?.configured;
    const emailReady = !!emailVerifyCache.ok || emailSendgridConfigured;
    const taxCentsNow = taxData.taxCents;
    const taxLabelNow = `${PROVINCE_TAX_LABELS[customer?.province] || "Tax"}${customer?.province ? ` - ${customer.province}` : ""}`;
    const logoExistsNow = fs.existsSync(COMPANY_LOGO_PATH);
    const attachmentsNow = logoExistsNow ? [{
      filename: path.basename(COMPANY_LOGO_PATH),
      path: COMPANY_LOGO_PATH,
      cid: "pps-logo"
    }] : [];

    let receiptEmailSent = false;
    let receiptEmailProvider = "";
    let receiptEmailError = null;
    if(emailReady){
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
        customer: customerWithRewards,
        items: normalizedItems,
        subtotalCents,
        discountCents,
        discountLabel: discountCents > 0
          ? (customerWithRewards?.rewards?.code ? `Rewards (${customerWithRewards.rewards.code})` : "Rewards")
          : "",
        taxCents: taxCentsNow,
        totalCents: totalCentsComputed,
        currency,
        taxLabel: taxLabelNow,
        headerText,
        introText,
        logoUrl: getPublicLogoUrl(),
        logoCid: "pps-logo",
        logoExists: logoExistsNow,
        language: customer?.language
      });

      // If SendGrid is configured (and SMTP isn't verified), send immediately for best UX.
      if(emailSendgridConfigured && !emailVerifyCache.ok){
        const out = await sendEmailSendGrid({
          from: getSenderAddress(),
          to: customer.email,
          subject: subjectText,
          html: receiptHtml
        });
        receiptEmailProvider = "sendgrid";
        receiptEmailSent = !!out.ok;
        if(!out.ok) receiptEmailError = out;
      }else{
        // Otherwise, queue in background.
        receiptEmailProvider = "queued";
        receiptEmailSent = true;
        (async ()=>{
          const customerSend = await sendEmailAny({
            from: getSenderAddress(),
            to: customer.email,
            subject: subjectText,
            html: receiptHtml,
            attachments: attachmentsNow
          });
          if(!customerSend.ok) console.error("Customer receipt email failed", customerSend);
        })().catch((err)=> console.error("Customer receipt email failed", err));
      }
    }

    res.json({
      ok:true,
      orderId,
      receiptEmailQueued: receiptEmailSent,
      receiptEmailProvider,
      receiptEmailError,
      email: {
        ready: emailReady,
        smtp: { configured: emailSmtpConfigured, verified: !!emailVerifyCache.ok },
        sendgrid: { configured: emailSendgridConfigured }
      }
    });

    // Run slower tasks in background so checkout returns fast.
    (async ()=>{
      if(productUpdates.length){
        for(const update of productUpdates){
          const { error } = await supabase.from("products").update({ stock: update.stock }).eq("id", update.id);
          if(error) console.error("Supabase stock update failed", error);
        }
      }

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

      const emailSummaryBg = getEmailConfigSummary();
      const emailReadyBg = !!emailVerifyCache.ok || !!emailSummaryBg?.sendgrid?.configured;
      const adminEmail = process.env.ORDER_TO;
      const logoExists = fs.existsSync(COMPANY_LOGO_PATH);
      const attachments = logoExists ? [{
        filename: path.basename(COMPANY_LOGO_PATH),
        path: COMPANY_LOGO_PATH,
        cid: "pps-logo"
      }] : [];

      if(emailReadyBg){
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
          logoUrl: getPublicLogoUrl(),
          logoCid: "pps-logo",
          logoExists,
          language: customer?.language
        });

        if(!receiptEmailSent){
          const customerSend = await sendEmailAny({
            from: getSenderAddress(),
            to: customer.email,
            subject: subjectText,
            html: receiptHtml,
            attachments
          });
          if(!customerSend.ok) console.error("Customer receipt email failed", customerSend);
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
            logoUrl: getPublicLogoUrl(),
            logoCid: "pps-logo",
            logoExists,
            language: customer?.language
          });

          const adminSend = await sendEmailAny({
            from: getSenderAddress(),
            to: adminEmail,
            subject: `New Order ${orderId} (${order.payment_method || paymentMethod || "pay_later"})`,
            html: adminHtml,
            attachments
          });
          if(!adminSend.ok) console.error("Admin order email failed", adminSend);
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
  const { name, email, phone, message, orderType, attachment } = req.body;
  if(!email || !message) return res.status(400).json({ ok:false, message:"Email and message required" });
  if(!requireSupabase(res)) return;

  try{
    const emailReady = !!buildTransportConfig() && !!process.env.ORDER_TO;
    let emailSent = false;
    const orderTypeSafe = String(orderType || "").trim();

    const msgParts = [];
    if(orderTypeSafe) msgParts.push(`Order type: ${orderTypeSafe}`);
    msgParts.push(String(message || ""));
    const messageForStorage = msgParts.filter(Boolean).join("\n\n");

    let emailAttachments = undefined;
    let attachmentNote = "";
    if(attachment && typeof attachment === "object"){
      const filename = String(attachment.name || "").trim();
      const contentType = String(attachment.type || "application/octet-stream").trim();
      const base64 = String(attachment.base64 || "");
      if(filename && base64){
        const buf = Buffer.from(base64, "base64");
        const MAX_BYTES = 2 * 1024 * 1024;
        if(buf.length > MAX_BYTES){
          return res.status(400).json({ ok:false, message:"Attachment too large (max 2MB)." });
        }
        emailAttachments = [{ filename, content: buf, contentType }];
        attachmentNote = `Attachment: ${filename}`;
      }
    }

    const msgId = "MSG-" + Date.now();
    const entry = {
      id: msgId,
      name: name || "",
      email,
      phone: phone || "",
      message: messageForStorage,
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
          messageForStorage
        ]);
      }catch(sheetErr){
        console.error("Message sheet append failed", sheetErr);
      }
    }

    if(emailReady){
      const out = await sendEmailAny({
        from: getSenderAddress(),
        to: process.env.ORDER_TO,
        subject: "New Contact Message - Power Poly Supplies",
        html: `
          <h2>New Contact Message</h2>
          <p><b>Name:</b> ${name || ""}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Phone:</b> ${phone || ""}</p>
          ${orderTypeSafe ? `<p><b>Order type:</b> ${escapeHtml(orderTypeSafe)}</p>` : ""}
          ${attachmentNote ? `<p><b>${escapeHtml(attachmentNote)}</b></p>` : ""}
          <hr/>
          <p>${(messageForStorage || "").replace(/\n/g,"<br/>")}</p>
        `,
        attachments: emailAttachments
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
      const out = await sendEmailAny({
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
    await putVerificationCode(emailKey, { code, expiresAt });

    const emailConfigured = !!buildTransportConfig();

    if(emailConfigured){
      const out = await sendEmailAny({
        from: getSenderAddress(),
        to: email,
        subject: "Welcome to Power Poly Supplies - your verification code",
        html: buildVerificationHtml(name, code),
        text: buildVerificationText(name, code)
      });
      if(out.ok) res.json({ ok:true, emailSent:true, emailConfigured:true });
      else res.status(500).json({ ok:false, emailSent:false, emailConfigured:true, message:"Failed to send code. Check mail credentials." });
    }else{
      // Dev fallback: return code in response when email is not configured
      console.warn("Email not configured; returning code in response for dev use.");
      res.json({ ok:true, devMode:true, emailSent:false, emailConfigured:false, code, message:"Email not configured; using dev mode code." });
    }
  }catch(err){
    console.error("Send code failed", err);
    res.status(500).json({ ok:false, message:"Failed to send code. Check mail credentials." });
  }
});

// ---- Auth: check verification code ----
app.post("/api/auth/check-code", async (req,res)=>{
  const { email, code } = req.body;
  const emailKey = String(email || "").trim().toLowerCase();
  if(!emailKey || !code) return res.status(400).json({ ok:false, message:"Email and code required" });

  const entry = await getVerificationCode(emailKey);
  if(!entry) return res.status(400).json({ ok:false, message:"No code sent. Please request a code first." });
  if(Date.now() > entry.expiresAt){
    await deleteVerificationCode(emailKey);
    return res.status(400).json({ ok:false, message:"Code expired. Please request a new one." });
  }
  if(entry.code !== code){
    return res.status(400).json({ ok:false, message:"Invalid code." });
  }

  res.json({ ok:true, message:"Code verified." });
});

// ---- Auth: register ----
app.post("/api/auth/register", async (req,res)=>{
  const { email, code, password, name, recaptchaToken } = req.body;
  const emailKey = String(email || "").trim().toLowerCase();
  if(!emailKey || !code || !password) return res.status(400).json({ ok:false, message:"Email, code, and password required" });

  const recaptcha = await verifyRecaptcha(recaptchaToken);
  if(!recaptcha.ok){
    return res.status(400).json({ ok:false, message:"reCAPTCHA failed. Please try again." });
  }

  const entry = await getVerificationCode(emailKey);
  if(!entry) return res.status(400).json({ ok:false, message:"No code sent. Please request a code first." });
  if(Date.now() > entry.expiresAt){
    await deleteVerificationCode(emailKey);
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
  await deleteVerificationCode(emailKey);

  const session = createSession(lower);
  const emailConfigured = !!buildTransportConfig();
  const shouldSendWelcome = emailConfigured;

  let welcomeEmailSent = false;
  if(shouldSendWelcome){
    try{
      const out = await sendEmailAny({
        from: getSenderAddress(),
        to: lower,
        subject: "Welcome to Power Poly Supplies!",
        html: buildWelcomeHtml(user.name || "", new Date(now)),
        text: buildWelcomeText(user.name || "", new Date(now))
      });
      welcomeEmailSent = !!out.ok;
      if(out.ok){
        supabase.from("users")
          .update({ welcome_email_sent:true })
          .eq("email", lower)
          .then(({ error: updateErr })=>{
            if(updateErr) console.error("Supabase welcome email flag update failed", updateErr);
          });
      }else{
        console.error("Welcome email failed", out);
      }
    }catch(err){
      console.error("Welcome email failed", err);
    }
  }

  res.json({
    ok:true,
    token: session.token,
    email: lower,
    name: user.name || "",
    expiresAt: session.expiresAt,
    welcomeEmailSent,
    emailConfigured
  });
});

// ---- Auth: verify code (stub, no persistence) ----
app.post("/api/auth/verify-code", async (req,res)=>{
  const { email, code } = req.body;
  const emailKey = String(email || "").trim().toLowerCase();
  if(!emailKey || !code) return res.status(400).json({ ok:false, message:"Email and code required" });

  try{
    const entry = await getVerificationCode(emailKey);
    if(!entry) return res.status(400).json({ ok:false, message:"No code sent. Please request a code first." });
    if(Date.now() > entry.expiresAt){
      await deleteVerificationCode(emailKey);
      return res.status(400).json({ ok:false, message:"Code expired. Please request a new one." });
    }
    if(entry.code !== code){
      return res.status(400).json({ ok:false, message:"Invalid code." });
    }

    await deleteVerificationCode(emailKey);
    const session = createSession(emailKey);
    res.json({ ok:true, message:"Code verified.", token: session.token, email: emailKey, expiresAt: session.expiresAt });
  }catch(err){
    console.error("Verify code failed", err);
    res.status(500).json({ ok:false, message:"Unable to verify code." });
  }
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

// ---- OAuth status ----
app.get("/api/auth/oauth/status", (req,res)=>{
  const googleClientId = readEnvFirst("OAUTH_GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID");
  const googleClientSecret = readEnvFirst("OAUTH_GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET");
  const googleRedirectUri = readEnvFirst("OAUTH_GOOGLE_REDIRECT_URI", "GOOGLE_OAUTH_REDIRECT_URI")
    || (()=>{
      const backendBase = getBackendBase(req);
      return backendBase ? `${backendBase}/api/auth/oauth/google/callback` : "";
    })();

  const facebookAppId = readEnvFirst("OAUTH_FACEBOOK_APP_ID", "FACEBOOK_APP_ID", "FACEBOOK_OAUTH_APP_ID");
  const facebookAppSecret = readEnvFirst("OAUTH_FACEBOOK_APP_SECRET", "FACEBOOK_APP_SECRET", "FACEBOOK_OAUTH_APP_SECRET");
  const facebookRedirectUri = readEnvFirst("OAUTH_FACEBOOK_REDIRECT_URI", "FACEBOOK_OAUTH_REDIRECT_URI")
    || (()=>{
      const backendBase = getBackendBase(req);
      return backendBase ? `${backendBase}/api/auth/oauth/facebook/callback` : "";
    })();

  res.json({
    ok:true,
    providers:{
      google: { configured: !!(googleClientId && googleClientSecret && googleRedirectUri), clientId: googleClientId ? maskSecret(googleClientId) : "" },
      facebook: { configured: !!(facebookAppId && facebookAppSecret && facebookRedirectUri), appId: facebookAppId ? maskSecret(facebookAppId) : "" }
    }
  });
});

// ---- OAuth: Google ----
app.get("/api/auth/oauth/google/start", (req,res)=>{
  const clientId = readEnvFirst("OAUTH_GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = readEnvFirst("OAUTH_GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri = readEnvFirst("OAUTH_GOOGLE_REDIRECT_URI", "GOOGLE_OAUTH_REDIRECT_URI")
    || (()=>{
      const backendBase = getBackendBase(req);
      return backendBase ? `${backendBase}/api/auth/oauth/google/callback` : "";
    })();

  if(!clientId || !clientSecret || !redirectUri){
    return res.status(400).send("Google OAuth is not configured on the server.");
  }

  const frontendBase = getFrontendBase(req);
  const next = sanitizeNextUrl(req.query.next, frontendBase);
  const state = createOauthState({ provider:"google", nextUrl: next });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get("/api/auth/oauth/google/callback", async (req,res)=>{
  if(!requireSupabase(res)) return;
  const clientId = readEnvFirst("OAUTH_GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = readEnvFirst("OAUTH_GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri = readEnvFirst("OAUTH_GOOGLE_REDIRECT_URI", "GOOGLE_OAUTH_REDIRECT_URI")
    || (()=>{
      const backendBase = getBackendBase(req);
      return backendBase ? `${backendBase}/api/auth/oauth/google/callback` : "";
    })();

  const frontendBase = getFrontendBase(req);
  const stateValue = String(req.query.state || "").trim();
  const stored = consumeOauthState(stateValue);
  const next = sanitizeNextUrl(stored?.nextUrl, frontendBase);

  const redirectToFrontend = (paramsObj)=>{
    if(!frontendBase){
      return res.status(400).json({ ok:false, message:"SITE_URL not configured (set SITE_URL to your public frontend URL)." });
    }
    const params = new URLSearchParams(paramsObj);
    if(next) params.set("next", next);
    return res.redirect(`${frontendBase}/login.html?${params.toString()}`);
  };

  if(req.query.error){
    return redirectToFrontend({ pps_oauth:"1", provider:"google", ok:"0", message: String(req.query.error || "OAuth error") });
  }

  const code = String(req.query.code || "").trim();
  if(!clientId || !clientSecret || !redirectUri || !code || !stored){
    return redirectToFrontend({ pps_oauth:"1", provider:"google", ok:"0", message:"OAuth failed. Please try again." });
  }

  try{
    const tokenRes = await fetch("https://oauth2.googleapis.com/token",{
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });
    const tokenJson = await tokenRes.json().catch(()=> ({}));
    if(!tokenRes.ok || !tokenJson?.access_token){
      console.error("Google token exchange failed", tokenJson);
      return redirectToFrontend({ pps_oauth:"1", provider:"google", ok:"0", message:"Google sign-in failed." });
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{
      headers:{ Authorization: `Bearer ${tokenJson.access_token}` }
    });
    const userJson = await userRes.json().catch(()=> ({}));
    if(!userRes.ok || !userJson?.email){
      console.error("Google userinfo failed", userJson);
      return redirectToFrontend({ pps_oauth:"1", provider:"google", ok:"0", message:"Google sign-in failed (missing email)." });
    }

    const user = await upsertOauthUser({ email: userJson.email, name: userJson.name || "" });
    const session = createSession(user.email);
    return redirectToFrontend({
      pps_oauth:"1",
      provider:"google",
      ok:"1",
      token: session.token,
      email: user.email,
      name: user.name || "",
      expiresAt: String(session.expiresAt || "")
    });
  }catch(err){
    console.error("Google OAuth callback failed", err);
    return redirectToFrontend({ pps_oauth:"1", provider:"google", ok:"0", message:"Google sign-in failed. Please try again." });
  }
});

// ---- OAuth: Facebook ----
app.get("/api/auth/oauth/facebook/start", (req,res)=>{
  const appId = readEnvFirst("OAUTH_FACEBOOK_APP_ID", "FACEBOOK_APP_ID", "FACEBOOK_OAUTH_APP_ID");
  const appSecret = readEnvFirst("OAUTH_FACEBOOK_APP_SECRET", "FACEBOOK_APP_SECRET", "FACEBOOK_OAUTH_APP_SECRET");
  const redirectUri = readEnvFirst("OAUTH_FACEBOOK_REDIRECT_URI", "FACEBOOK_OAUTH_REDIRECT_URI")
    || (()=>{
      const backendBase = getBackendBase(req);
      return backendBase ? `${backendBase}/api/auth/oauth/facebook/callback` : "";
    })();

  if(!appId || !appSecret || !redirectUri){
    return res.status(400).send("Facebook OAuth is not configured on the server.");
  }

  const frontendBase = getFrontendBase(req);
  const next = sanitizeNextUrl(req.query.next, frontendBase);
  const state = createOauthState({ provider:"facebook", nextUrl: next });

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "email,public_profile",
    state
  });
  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
});

app.get("/api/auth/oauth/facebook/callback", async (req,res)=>{
  if(!requireSupabase(res)) return;
  const appId = readEnvFirst("OAUTH_FACEBOOK_APP_ID", "FACEBOOK_APP_ID", "FACEBOOK_OAUTH_APP_ID");
  const appSecret = readEnvFirst("OAUTH_FACEBOOK_APP_SECRET", "FACEBOOK_APP_SECRET", "FACEBOOK_OAUTH_APP_SECRET");
  const redirectUri = readEnvFirst("OAUTH_FACEBOOK_REDIRECT_URI", "FACEBOOK_OAUTH_REDIRECT_URI")
    || (()=>{
      const backendBase = getBackendBase(req);
      return backendBase ? `${backendBase}/api/auth/oauth/facebook/callback` : "";
    })();

  const frontendBase = getFrontendBase(req);
  const stateValue = String(req.query.state || "").trim();
  const stored = consumeOauthState(stateValue);
  const next = sanitizeNextUrl(stored?.nextUrl, frontendBase);

  const redirectToFrontend = (paramsObj)=>{
    if(!frontendBase){
      return res.status(400).json({ ok:false, message:"SITE_URL not configured (set SITE_URL to your public frontend URL)." });
    }
    const params = new URLSearchParams(paramsObj);
    if(next) params.set("next", next);
    return res.redirect(`${frontendBase}/login.html?${params.toString()}`);
  };

  if(req.query.error){
    return redirectToFrontend({ pps_oauth:"1", provider:"facebook", ok:"0", message: String(req.query.error || "OAuth error") });
  }

  const code = String(req.query.code || "").trim();
  if(!appId || !appSecret || !redirectUri || !code || !stored){
    return redirectToFrontend({ pps_oauth:"1", provider:"facebook", ok:"0", message:"OAuth failed. Please try again." });
  }

  try{
    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code
    });
    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
    const tokenJson = await tokenRes.json().catch(()=> ({}));
    if(!tokenRes.ok || !tokenJson?.access_token){
      console.error("Facebook token exchange failed", tokenJson);
      return redirectToFrontend({ pps_oauth:"1", provider:"facebook", ok:"0", message:"Facebook sign-in failed." });
    }

    const profileRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tokenJson.access_token)}`);
    const profileJson = await profileRes.json().catch(()=> ({}));
    if(!profileRes.ok || !profileJson?.email){
      console.error("Facebook profile failed", profileJson);
      return redirectToFrontend({ pps_oauth:"1", provider:"facebook", ok:"0", message:"Facebook sign-in failed (no email returned)." });
    }

    const user = await upsertOauthUser({ email: profileJson.email, name: profileJson.name || "" });
    const session = createSession(user.email);
    return redirectToFrontend({
      pps_oauth:"1",
      provider:"facebook",
      ok:"1",
      token: session.token,
      email: user.email,
      name: user.name || "",
      expiresAt: String(session.expiresAt || "")
    });
  }catch(err){
    console.error("Facebook OAuth callback failed", err);
    return redirectToFrontend({ pps_oauth:"1", provider:"facebook", ok:"0", message:"Facebook sign-in failed. Please try again." });
  }
});

// ---- Account helpers ----
app.get("/api/account/ip", (req, res) => {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").trim();
  const forwardedIp = forwardedFor ? String(forwardedFor.split(",")[0] || "").trim() : "";
  const ip = forwardedIp || String(req.ip || req.socket?.remoteAddress || "").trim();
  res.json({ ok: true, ip, forwardedFor });
});

// ---- Saved payment methods (Square cards on file) ----
const paymentMethodsByEmail = new Map(); // fallback when Supabase table isn't present
const squareCustomerByEmail = new Map(); // fallback mapping

function normalizePaymentMethodRow(row){
  if(!row) return row;
  return {
    ...row,
    createdAt: row.created_at ?? row.createdAt
  };
}

async function getOrCreateSquareCustomerId(email){
  const lower = String(email || "").trim().toLowerCase();
  if(!lower) return "";
  if(squareCustomerByEmail.has(lower)) return squareCustomerByEmail.get(lower) || "";

  try{
    const customerId = await withSquareClient(async ({ client })=>{
      const customersApi = client.customersApi;
      const { result: search } = await customersApi.searchCustomers({
        limit: BigInt(1),
        query: {
          filter: {
            emailAddress: { exact: lower }
          }
        }
      });
      const existing = Array.isArray(search?.customers) ? search.customers[0] : null;
      if(existing?.id) return existing.id;
      const { result: created } = await customersApi.createCustomer({ emailAddress: lower, referenceId: lower });
      return created?.customer?.id || "";
    });
    if(customerId) squareCustomerByEmail.set(lower, customerId);
    return customerId || "";
  }catch(err){
    // If Customers API isn't available or fails, fall back to empty (cards won't save).
    return "";
  }
}

async function listPaymentMethods(email){
  const lower = String(email || "").trim().toLowerCase();
  if(!lower) return [];
  if(supabase){
    try{
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("customer_email", lower)
        .order("created_at", { ascending: false });
      if(error) throw error;
      return (data || []).map(normalizePaymentMethodRow);
    }catch(err){
      // Table might not exist; fall back.
    }
  }
  const list = paymentMethodsByEmail.get(lower);
  return Array.isArray(list) ? list : [];
}

async function addPaymentMethod(email, sourceId){
  const lower = String(email || "").trim().toLowerCase();
  if(!lower) throw new Error("Missing email.");
  if(!sourceId) throw new Error("Missing card token.");

  if(!(squareClientSandbox || squareClientProduction)){
    const missing = [];
    if(!squareAccessTokenSandbox && !squareAccessTokenProduction) missing.push("SQUARE_ACCESS_TOKEN");
    const error = new Error(`Square not configured (missing ${missing.join(" + ") || "keys"}).`);
    error.statusCode = 400;
    throw error;
  }

  const customerId = await getOrCreateSquareCustomerId(lower);
  if(!customerId){
    const error = new Error("Unable to create or locate Square customer for this account.");
    error.statusCode = 400;
    throw error;
  }

  const out = await withSquareClient(async ({ client })=>{
    const cardsApi = client.cardsApi;
    const body = {
      idempotencyKey: crypto.randomUUID(),
      sourceId: String(sourceId),
      card: {
        customerId,
        referenceId: lower
      }
    };
    const { result } = await cardsApi.createCard(body);
    return result?.card || null;
  });

  if(!out?.id){
    const error = new Error("Failed to save card.");
    error.statusCode = 500;
    throw error;
  }

  const record = {
    id: String(out.id),
    customer_email: lower,
    square_customer_id: String(customerId),
    brand: String(out.cardBrand || out.card_brand || ""),
    last4: String(out.last4 || ""),
    expMonth: Number(out.expMonth ?? out.exp_month ?? 0) || 0,
    expYear: Number(out.expYear ?? out.exp_year ?? 0) || 0,
    created_at: new Date().toISOString()
  };

  if(supabase){
    try{
      const { error } = await supabase.from("payment_methods").insert(record);
      if(!error){
        return record;
      }
    }catch(err){
      // fall back
    }
  }

  const list = paymentMethodsByEmail.get(lower);
  const next = Array.isArray(list) ? [record, ...list] : [record];
  paymentMethodsByEmail.set(lower, next.slice(0, 50));
  return record;
}

async function removePaymentMethod(email, id){
  const lower = String(email || "").trim().toLowerCase();
  const cardId = String(id || "").trim();
  if(!lower || !cardId) return;

  // Disable card at Square when possible (safe even if already disabled).
  if((squareClientSandbox || squareClientProduction)){
    try{
      await withSquareClient(({ client })=> client.cardsApi.disableCard(cardId));
    }catch(err){
      // ignore; still remove from local records
    }
  }

  if(supabase){
    try{
      await supabase.from("payment_methods").delete().eq("customer_email", lower).eq("id", cardId);
      return;
    }catch(err){
      // fall back
    }
  }

  const list = paymentMethodsByEmail.get(lower);
  if(Array.isArray(list)){
    paymentMethodsByEmail.set(lower, list.filter(m=> String(m?.id || "") !== cardId));
  }
}

app.get("/api/account/payment-methods", async (req,res)=>{
  const session = getSessionFromRequest(req);
  if(!session) return res.status(401).json({ ok:false, message:"Unauthorized" });
  try{
    const methods = await listPaymentMethods(session.email);
    res.json({
      ok:true,
      methods: methods.map((m)=>({
        id: String(m.id || ""),
        brand: String(m.brand || ""),
        last4: String(m.last4 || ""),
        expMonth: Number(m.expMonth ?? m.exp_month ?? 0) || 0,
        expYear: Number(m.expYear ?? m.exp_year ?? 0) || 0,
        createdAt: m.createdAt || m.created_at || ""
      }))
    });
  }catch(err){
    res.status(500).json({ ok:false, message:"Unable to load payment methods." });
  }
});

app.post("/api/account/payment-methods", async (req,res)=>{
  const session = getSessionFromRequest(req);
  if(!session) return res.status(401).json({ ok:false, message:"Unauthorized" });
  try{
    const sourceId = String(req.body?.sourceId || "").trim();
    const record = await addPaymentMethod(session.email, sourceId);
    res.json({ ok:true, method: { id: record.id, brand: record.brand, last4: record.last4, expMonth: record.expMonth, expYear: record.expYear } });
  }catch(err){
    const status = getHttpStatus(err?.statusCode || err?.status || 0, 400);
    const summary = summarizeSquareError(err);
    res.status(status).json({ ok:false, message: String(err?.message || summary?.message || "Unable to save card.") });
  }
});

app.delete("/api/account/payment-methods/:id", async (req,res)=>{
  const session = getSessionFromRequest(req);
  if(!session) return res.status(401).json({ ok:false, message:"Unauthorized" });
  try{
    await removePaymentMethod(session.email, req.params.id);
    res.json({ ok:true });
  }catch(err){
    res.status(500).json({ ok:false, message:"Unable to remove card." });
  }
});

// ---- Square Checkout ----
async function createSquarePaymentAndOrder(body, opts = {}){
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

  const cartItems = (items || []).filter((i)=>{
    const id = String(i?.id || "").trim();
    if(!id) return false;
    const lower = id.toLowerCase();
    return !["tax","qst","shipping","discount","coupon","promo"].includes(lower);
  });
  if(cartItems.length === 0){
    const error = new Error("No valid products to pay for.");
    error.status = 400;
    throw error;
  }

  const productIds = cartItems.map(i=>String(i.id)).filter(Boolean);
  let productsById = new Map();
  try{
    const products = await fetchProductsByIds(productIds);
    productsById = new Map(products.map(p=>[p.id, p]));
  }catch(err){
    console.error("Supabase products fetch for square failed", err);
    const error = new Error("Unable to load products for checkout.");
    error.status = 500;
    throw error;
  }

  const missingIds = productIds.filter((id)=> !productsById.has(id));
  if(missingIds.length){
    const error = new Error("Some products are unavailable. Please refresh and try again.");
    error.status = 400;
    throw error;
  }

  const normalizedItems = cartItems.map((i)=>{
    const qty = Math.max(1, Number(i.qty || 1));
    const product = productsById.get(i.id);
    const unitAmount = getTieredPriceCents(product, qty);
    return {
      id: i.id || "",
      name: product?.name || i.name || "Item",
      qty,
      priceCents: Math.max(0, Math.round(unitAmount)),
      currency: currency,
      description: product?.description || i.description || "",
      description_fr: i.description_fr || product?.description_fr || "",
      description_ko: i.description_ko || product?.description_ko || "",
      description_hi: i.description_hi || product?.description_hi || "",
      description_ta: i.description_ta || product?.description_ta || "",
      description_es: i.description_es || product?.description_es || ""
    };
  });

  const subtotalCents = normalizedItems.reduce((sum, i)=> sum + (i.priceCents * i.qty), 0);
  const shippingInfo = getShippingForPostal(customer?.postal || customer?.postal_code || customer?.postalCode || "");
  const shippingCents = Math.max(0, Math.round(Number(shippingInfo?.amountCents || shippingInfo?.costCents || 0) || 0));
  const taxData = calculateTaxCents(subtotalCents, String(customer?.province || "").trim().toUpperCase());
  const taxCents = Math.max(0, Math.round(Number(taxData?.taxCents || 0) || 0));

  const computedLines = [];
  if(shippingCents > 0){
    computedLines.push({
      id:"shipping",
      name: String(shippingInfo?.label || "Shipping"),
      qty: 1,
      priceCents: shippingCents,
      currency
    });
  }
  if(taxCents > 0){
    if(Number(taxData?.qstAmount || 0) > 0){
      if(Number(taxData?.gstAmount || 0) > 0){
        computedLines.push({ id:"tax", name:"GST 5%", qty:1, priceCents: Math.round(Number(taxData.gstAmount)), currency });
      }
      computedLines.push({ id:"qst", name:"QST 9.975%", qty:1, priceCents: Math.round(Number(taxData.qstAmount)), currency });
    }else{
      const province = String(customer?.province || "").trim().toUpperCase();
      const label = `${PROVINCE_TAX_LABELS[province] || "Tax"}${province ? ` - ${province}` : ""}`;
      computedLines.push({ id:"tax", name: label, qty:1, priceCents: taxCents, currency });
    }
  }

  const orderId = `SQR-${Date.now()}`;
  const redirectBase = String(opts?.siteUrl || siteUrl).replace(/\/+$/,"");
  const redirectUrl = `${redirectBase}/thank-you.html?order_id=${encodeURIComponent(orderId)}`;
  const idempotencyKey = crypto.randomUUID();

  const storedItems = [...normalizedItems, ...computedLines];
  const lineItems = storedItems.map((i)=>({
    name: String(i.name || "Item"),
    quantity: String(Math.max(1, Number(i.qty || 1))),
    basePriceMoney: { amount: BigInt(Math.max(0, Math.round(Number(i.priceCents || 0)))), currency: i.currency || currency }
  }));

  let squareEnvUsed = "";
  const result = await withSquareClient(({ client, locationId, envLabel })=>{
    squareEnvUsed = envLabel || "";
    return client.checkout.paymentLinks.create({
      idempotencyKey,
      order: {
        locationId,
        referenceId: orderId,
        lineItems
      },
      checkoutOptions: {
        redirectUrl
      }
    });
  }, { requireLocationId: true });

  const paymentUrl = result?.paymentLink?.url;
  if(!paymentUrl){
    const error = new Error("Failed to create Square payment link.");
    error.status = 500;
    throw error;
  }

  const squarePaymentLinkId = result?.paymentLink?.id || "";
  const squareOrderId = result?.paymentLink?.orderId || result?.paymentLink?.order_id || "";

  const nowIso = new Date().toISOString();
  const totalCents = subtotalCents + shippingCents + taxCents;
  const customerEmail = (customer?.email || "").toLowerCase();
  const orderRow = {
    id: orderId,
    status: "pending",
    payment_method: "square_checkout",
    customer: customer || {},
    customer_email: customerEmail,
    shipping: { zone: String(shippingInfo?.zone || "Square"), label: String(shippingInfo?.label || "Square"), costCents: shippingCents },
    items: storedItems,
    total_cents: totalCents,
    currency,
    square_payment_link_id: squarePaymentLinkId,
    square_order_id: squareOrderId,
    language: ["en","fr","ko","hi","ta","es","zh"].includes(String(customer?.language || "").toLowerCase())
      ? String(customer.language).toLowerCase()
      : "en",
    created_at: nowIso
  };
  const { error: orderError } = await supabase.from("orders").insert(orderRow);
  if(orderError) console.error("Supabase square order insert failed", orderError);

  return { ok:true, url: paymentUrl, orderId, squarePaymentLinkId, squareOrderId, squareEnvUsed };
}

function normalizePublicSiteUrl(raw){
  const text = String(raw || "").trim();
  if(!text) return "";
  if(text === "null") return "";
  try{
    const url = new URL(text);
    if(url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  }catch{
    return "";
  }
}

function resolveSiteUrlForRequest(req){
  const configured = normalizePublicSiteUrl(siteUrl);
  if(configured) return configured;

  const originHeader = normalizePublicSiteUrl(req?.headers?.origin);
  if(originHeader) return originHeader;

  const referer = String(req?.headers?.referer || "").trim();
  if(referer){
    try{
      const url = new URL(referer);
      if(url.origin && url.origin !== "null") return url.origin;
    }catch{
      // ignore
    }
  }

  return "";
}

function requireSquareConfigured(req, res){
  const checkoutCandidates = getSquareClientCandidates({ requireLocationId: true });
  if(!checkoutCandidates.length){
    const missing = [];
    if(squareEnvMode === "production"){
      if(!squareAccessTokenProduction) missing.push("SQUARE_ACCESS_TOKEN_PROD (or SQUARE_ACCESS_TOKEN)");
      if(!squareLocationIdProduction) missing.push("SQUARE_LOCATION_ID_PROD (or SQUARE_LOCATION_ID)");
    }else if(squareEnvMode === "sandbox"){
      if(!squareAccessTokenSandbox) missing.push("SQUARE_ACCESS_TOKEN_SANDBOX (or SQUARE_ACCESS_TOKEN)");
      if(!squareLocationIdSandbox) missing.push("SQUARE_LOCATION_ID_SANDBOX (or SQUARE_LOCATION_ID)");
    }else{
      if(!squareAccessTokenSandbox && !squareAccessTokenProduction) missing.push("SQUARE_ACCESS_TOKEN");
      if(!squareLocationIdSandbox && !squareLocationIdProduction) missing.push("SQUARE_LOCATION_ID");
    }
    res.status(400).json({ ok:false, message:`Square not configured (missing ${missing.join(" + ") || "keys"}).` });
    return "";
  }
  const effectiveSiteUrl = resolveSiteUrlForRequest(req);
  if(!effectiveSiteUrl){
    res.status(400).json({ ok:false, message:"SITE_URL not configured (set SITE_URL to your public frontend URL), and no Origin/Referer was provided to infer it." });
    return "";
  }
  return effectiveSiteUrl;
}

function requireSquareClientConfigured(res){
  if(!(squareClientSandbox || squareClientProduction)){
    res.status(400).json({ ok:false, message:"Square not configured (missing SQUARE_ACCESS_TOKEN)." });
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
  const effectiveSiteUrl = requireSquareConfigured(req, res);
  if(!effectiveSiteUrl) return;
  if(!requireSupabase(res)) return;
  try{
    const out = await createSquarePaymentAndOrder(req.body || {}, { siteUrl: effectiveSiteUrl });
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

async function findOrderForSquareUpdate({ orderId, squareOrderId }){
  const id = String(orderId || "").trim();
  const sq = String(squareOrderId || "").trim();
  if(!supabase) return null;
  if(id){
    const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    if(error) throw error;
    return data || null;
  }
  if(sq){
    const { data, error } = await supabase.from("orders").select("*").eq("square_order_id", sq).maybeSingle();
    if(error) throw error;
    return data || null;
  }
  return null;
}

async function syncSquareOrderStatusForRow(orderRow){
  const orderId = String(orderRow?.id || "").trim();
  const squareOrderId = String(orderRow?.square_order_id || "").trim();
  if(!orderId) throw new Error("Missing order id.");
  if(!squareOrderId){
    return { orderId, squareOrderId: "", state: "", status: String(orderRow?.status || "pending"), statusWas: String(orderRow?.status || "pending") };
  }

  const result = await withSquareClient(({ client })=> client.orders.get({ orderId: squareOrderId }));
  const state = String(result?.order?.state || "").toUpperCase();

  let status = String(orderRow?.status || "pending");
  if(state === "COMPLETED") status = "paid";
  if(state === "CANCELED") status = "canceled";

  const statusWas = String(orderRow?.status || "pending");
  if(status !== (orderRow?.status || "")){
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);
    if(updateError) console.error("Supabase order status update failed", updateError);
  }

  return { orderId, squareOrderId, state, status, statusWas };
}

async function maybeSendPaidReceipt({ orderRow, orderId, status, statusWas }){
  if(status !== "paid" || statusWas === "paid") return;

  const emailConfigured = !!buildTransportConfig();
  const customerEmail = String(orderRow?.customer_email || orderRow?.customer?.email || "").trim();
  const adminEmail = String(process.env.ORDER_TO || "").trim();

  if(emailConfigured && (customerEmail || adminEmail)){
    const items = Array.isArray(orderRow?.items) ? orderRow.items : [];
    const currency = String(orderRow?.currency || "CAD").toUpperCase();
    const totalCents = Number(orderRow?.total_cents || 0);
    const taxItems = items.filter(i => String(i?.id || "").toLowerCase() === "tax");
    const taxCents = taxItems.reduce((sum, i)=> sum + (Number(i.priceCents || 0) * Number(i.qty || 1)), 0);
    const subtotalCents = Math.max(0, totalCents - taxCents);
    const taxLabel = String(taxItems[0]?.name || "Tax");

    const lang = String(orderRow?.language || orderRow?.customer?.language || "en").toLowerCase();
    const headerText = lang === "fr"
      ? "ReÃ§u"
      : lang === "es"
        ? "Recibo"
        : lang === "hi"
          ? "à¤°à¤¸à¥€à¤¦"
          : lang === "ta"
            ? "à®°à®šà¯€à®¤à¯"
            : "Receipt";
    const introText = lang === "fr"
      ? "Merci pour votre commande chez Power Poly Supplies. Nous la prÃ©parons avec soin. Voici votre reÃ§u."
      : lang === "es"
        ? "Gracias por tu pedido en Power Poly Supplies. Ya estamos preparando tu pedido. AquÃ­ estÃ¡ tu recibo."
        : lang === "hi"
          ? "Power Poly Supplies à¤®à¥‡à¤‚ à¤†à¤ªà¤•à¥‡ à¤‘à¤°à¥à¤¡à¤° à¤•à¥‡ à¤²à¤¿à¤ à¤§à¤¨à¥à¤¯à¤µà¤¾à¤¦à¥¤ à¤¹à¤® à¤†à¤ªà¤•à¤¾ à¤‘à¤°à¥à¤¡à¤° à¤¤à¥ˆà¤¯à¤¾à¤° à¤•à¤° à¤°à¤¹à¥‡ à¤¹à¥ˆà¤‚à¥¤ à¤¯à¤¹ à¤†à¤ªà¤•à¥€ à¤°à¤¸à¥€à¤¦ à¤¹à¥ˆà¥¤"
          : lang === "ta"
            ? "Power Poly Supplies-à®²à¯ à®‰à®™à¯à®•à®³à¯ à®†à®°à¯à®Ÿà®°à¯à®•à¯à®•à¯ à®¨à®©à¯à®±à®¿. à®‰à®™à¯à®•à®³à¯ à®†à®°à¯à®Ÿà®°à¯ˆ à®¤à®¯à®¾à®°à®¿à®¤à¯à®¤à¯ à®•à¯Šà®£à¯à®Ÿà®¿à®°à¯à®•à¯à®•à®¿à®±à¯‹à®®à¯. à®‡à®¤à¯‹ à®‰à®™à¯à®•à®³à¯ à®°à®šà¯€à®¤à¯."
            : "Thanks for choosing Power Poly Supplies. We are getting your order ready now. Here is your receipt.";

    const logoExists = fs.existsSync(COMPANY_LOGO_PATH);
    const attachments = logoExists ? [{
      filename: path.basename(COMPANY_LOGO_PATH),
      path: COMPANY_LOGO_PATH,
      cid: "pps-logo"
    }] : [];

    const receiptHtml = buildReceiptHtml({
      orderId,
      customer: orderRow?.customer || { email: customerEmail },
      items,
      subtotalCents,
      taxCents,
      totalCents,
      currency,
      taxLabel,
      headerText,
      introText,
      logoUrl: getPublicLogoUrl(),
      logoCid: "pps-logo",
      logoExists,
      language: lang
    });

    (async ()=>{
      if(customerEmail){
        const subject = lang === "fr"
          ? `Merci pour votre commande ! Power Poly Supplies - ${orderId}`
          : lang === "es"
            ? `Â¡Gracias por tu pedido! Recibo de Power Poly Supplies - ${orderId}`
            : lang === "hi"
              ? `à¤†à¤ªà¤•à¥‡ à¤‘à¤°à¥à¤¡à¤° à¤•à¥‡ à¤²à¤¿à¤ à¤§à¤¨à¥à¤¯à¤µà¤¾à¤¦! Power Poly Supplies à¤°à¤¸à¥€à¤¦ - ${orderId}`
              : lang === "ta"
                ? `à®‰à®™à¯à®•à®³à¯ à®†à®°à¯à®Ÿà®°à¯à®•à¯à®•à¯ à®¨à®©à¯à®±à®¿! Power Poly Supplies à®°à®šà¯€à®¤à¯ - ${orderId}`
                : `Thanks for your order! Power Poly Supplies receipt - ${orderId}`;
        await sendEmailAny({ from: getSenderAddress(), to: customerEmail, subject, html: receiptHtml, attachments });
      }
      if(adminEmail){
        await sendEmailAny({
          from: getSenderAddress(),
          to: adminEmail,
          subject: `New Order ${orderId} (square_checkout)`,
          html: receiptHtml,
          attachments
        });
      }
    })().catch((err)=> console.error("Square receipt email failed", err));
  }

  // Optional: sync to QuickBooks Online for invoicing/accounting.
  if(qboIsConfigured()){
    (async ()=>{
      try{
        await qboUpsertInvoiceForOrder({ ...orderRow, status });
      }catch(err){
        console.error("QBO sync paid order failed", err);
      }
    })();
  }
}

async function handlePaymentStatus(req,res){
  if(!requireSquareClientConfigured(res)) return;
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

    const { squareOrderId, state, status, statusWas } = await syncSquareOrderStatusForRow(orderRow);

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
          logoUrl: getPublicLogoUrl(),
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
            await sendEmailAny({ from: getSenderAddress(), to: customerEmail, subject, html: receiptHtml, attachments });
          }
          if(adminEmail){
            await sendEmailAny({
              from: getSenderAddress(),
              to: adminEmail,
              subject: `New Order ${orderId} (square_checkout)`,
              html: receiptHtml,
              attachments
            });
          }
        })().catch((err)=> console.error("Square receipt email failed", err));
      }

      // Optional: sync to QuickBooks Online for invoicing/accounting.
      if(qboIsConfigured()){
        (async ()=>{
          try{
            await qboUpsertInvoiceForOrder({ ...orderRow, status });
          }catch(err){
            console.error("QBO sync paid order failed", err);
          }
        })();
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
const createPaymentLimiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "pay:" });
app.post("/api/create-payment", createPaymentLimiter, handleCreatePayment);
app.post("/create-payment", createPaymentLimiter, handleCreatePayment);
app.post("/pi/create-payment", createPaymentLimiter, handleCreatePayment);
app.get("/api/create-payment", (req,res)=> res.status(405).json({ ok:false, message:"Use POST /api/create-payment" }));
app.get("/create-payment", (req,res)=> res.status(405).json({ ok:false, message:"Use POST /create-payment" }));
app.get("/pi/create-payment", (req,res)=> res.status(405).json({ ok:false, message:"Use POST /pi/create-payment" }));

app.post("/api/square/webhook", rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "sqwh:" }), async (req,res)=>{
  const verified = verifySquareWebhook(req);
  if(!verified.ok){
    const message = verified.reason === "missing_signature_key"
      ? "Webhook not configured (missing SQUARE_WEBHOOK_SIGNATURE_KEY)."
      : verified.reason === "missing_webhook_url"
        ? "Webhook not configured (missing SQUARE_WEBHOOK_URL)."
        : "Unauthorized";
    return res.status(verified.reason.startsWith("missing_") ? 400 : 401).json({ ok:false, message });
  }

  try{
    const event = req.body || {};
    const obj = event?.data?.object || {};
    const orderRef = String(
      obj?.order?.reference_id
      || obj?.order?.referenceId
      || obj?.payment?.reference_id
      || obj?.payment?.referenceId
      || ""
    ).trim();
    const squareOrderId = String(
      obj?.order?.order_id
      || obj?.order?.id
      || obj?.payment?.order_id
      || obj?.payment?.orderId
      || ""
    ).trim();

    if(!orderRef && !squareOrderId) return res.json({ ok:true });
    if(!requireSupabase(res)) return;

    const orderRow = await findOrderForSquareUpdate({ orderId: orderRef, squareOrderId });
    if(!orderRow) return res.json({ ok:true });

    const { status, statusWas } = await syncSquareOrderStatusForRow(orderRow);
    await maybeSendPaidReceipt({ orderRow, orderId: String(orderRow.id), status, statusWas });

    return res.json({ ok:true });
  }catch(err){
    console.error("Square webhook error", err);
    return res.status(500).json({ ok:false });
  }
});

app.get("/api/payment-status", handlePaymentStatus);
app.get("/payment-status", handlePaymentStatus);
app.get("/pi/payment-status", handlePaymentStatus);

// Backward-compat endpoint used by older frontend code
app.post("/api/square-checkout", async (req,res)=>{
  const effectiveSiteUrl = requireSquareConfigured(req, res);
  if(!effectiveSiteUrl) return;
  if(!requireSupabase(res)) return;
  try{
    const out = await createSquarePaymentAndOrder(req.body || {}, { siteUrl: effectiveSiteUrl });
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
