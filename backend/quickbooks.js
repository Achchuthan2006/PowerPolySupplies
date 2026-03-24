import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN_STORE_PATH = String(process.env.QBO_TOKEN_STORE_PATH || "").trim()
  ? String(process.env.QBO_TOKEN_STORE_PATH).trim()
  : path.join(__dirname, ".qbo_tokens.json");

const INTUIT_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const INTUIT_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

function base64url(input) {
  return Buffer.from(String(input), "utf8").toString("base64url");
}

function nowMs() {
  return Date.now();
}

function getEnv() {
  const v = String(process.env.QBO_ENV || "production").trim().toLowerCase();
  return v === "sandbox" ? "sandbox" : "production";
}

function getApiBase() {
  return getEnv() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
}

function getConfig() {
  const clientId = String(process.env.QBO_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.QBO_CLIENT_SECRET || "").trim();
  const redirectUri = String(process.env.QBO_REDIRECT_URI || "").trim();
  const stateSecret = String(process.env.QBO_STATE_SECRET || "").trim();
  const defaultItemId = String(process.env.QBO_DEFAULT_ITEM_ID || "").trim();
  const shippingItemId = String(process.env.QBO_SHIPPING_ITEM_ID || "").trim();
  const taxItemId = String(process.env.QBO_TAX_ITEM_ID || "").trim();
  const emailInvoice = String(process.env.QBO_EMAIL_INVOICE || "").trim().toLowerCase() === "true";
  const syncTaxMode = String(process.env.QBO_SYNC_TAX_MODE || "line").trim().toLowerCase(); // line | qbo | none
  const taxCodeId = String(process.env.QBO_TAX_CODE_ID || "").trim(); // optional, for syncTaxMode=qbo

  return {
    clientId,
    clientSecret,
    redirectUri,
    stateSecret,
    defaultItemId,
    shippingItemId,
    taxItemId,
    emailInvoice,
    syncTaxMode,
    taxCodeId
  };
}

export function qboIsConfigured() {
  const cfg = getConfig();
  return !!(cfg.clientId && cfg.clientSecret && cfg.redirectUri && cfg.stateSecret);
}

function readStore() {
  try {
    if (!fs.existsSync(TOKEN_STORE_PATH)) return null;
    const raw = fs.readFileSync(TOKEN_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_err) {
    return null;
  }
}

function writeStore(store) {
  fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function qboStatus() {
  const cfg = getConfig();
  const store = readStore();
  const tokens = store?.tokens || null;
  return {
    configured: qboIsConfigured(),
    env: getEnv(),
    hasTokens: !!(tokens?.access_token && tokens?.refresh_token),
    realmId: String(store?.realmId || ""),
    tokenExpiresAt: Number(tokens?.expires_at || 0) || 0,
    emailInvoice: !!cfg.emailInvoice,
    syncTaxMode: cfg.syncTaxMode,
    hasDefaultItem: !!cfg.defaultItemId
  };
}

function signState(payload, secret) {
  const h = crypto.createHmac("sha256", secret);
  h.update(payload, "utf8");
  return h.digest("base64url");
}

export function qboBuildAuthUrl() {
  const cfg = getConfig();
  if (!qboIsConfigured()) {
    const err = new Error("QuickBooks not configured. Set QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_STATE_SECRET.");
    err.code = "QBO_NOT_CONFIGURED";
    throw err;
  }

  const ts = nowMs();
  const nonce = crypto.randomUUID();
  const payload = `${ts}.${nonce}`;
  const sig = signState(payload, cfg.stateSecret);
  const state = base64url(`${payload}.${sig}`);

  const scope = encodeURIComponent("com.intuit.quickbooks.accounting");
  const url =
    `${INTUIT_AUTH_URL}?client_id=${encodeURIComponent(cfg.clientId)}` +
    `&redirect_uri=${encodeURIComponent(cfg.redirectUri)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&state=${encodeURIComponent(state)}`;

  return { url, state };
}

function verifyState(state) {
  const cfg = getConfig();
  const decoded = Buffer.from(String(state || ""), "base64url").toString("utf8");
  const parts = decoded.split(".");
  if (parts.length !== 3) return { ok: false, reason: "bad_state_format" };
  const [tsRaw, nonce, sig] = parts;
  const ts = Number(tsRaw || 0);
  if (!ts || !nonce || !sig) return { ok: false, reason: "missing_state_fields" };
  if (Math.abs(nowMs() - ts) > 1000 * 60 * 30) return { ok: false, reason: "state_expired" };
  const expected = signState(`${ts}.${nonce}`, cfg.stateSecret);
  if (sig !== expected) return { ok: false, reason: "state_invalid" };
  return { ok: true };
}

async function tokenRequest(params) {
  const cfg = getConfig();
  const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`, "utf8").toString("base64");
  const body = new URLSearchParams(params);
  const res = await fetch(INTUIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error_description || data?.error || "QuickBooks token request failed.");
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

export async function qboHandleCallback({ code, realmId, state }) {
  if (!qboIsConfigured()) {
    const err = new Error("QuickBooks not configured.");
    err.code = "QBO_NOT_CONFIGURED";
    throw err;
  }

  const stateCheck = verifyState(state);
  if (!stateCheck.ok) {
    const err = new Error("Invalid state. Please restart the QuickBooks connection flow.");
    err.code = "QBO_BAD_STATE";
    err.reason = stateCheck.reason;
    throw err;
  }

  const tokenData = await tokenRequest({
    grant_type: "authorization_code",
    code: String(code || "").trim(),
    redirect_uri: getConfig().redirectUri
  });

  const expiresInSec = Number(tokenData?.expires_in || 0) || 0;
  const store = {
    realmId: String(realmId || "").trim(),
    env: getEnv(),
    tokens: {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: nowMs() + Math.max(0, expiresInSec - 60) * 1000
    },
    updated_at: new Date().toISOString()
  };
  writeStore(store);
  return { ok: true, realmId: store.realmId, env: store.env };
}

async function refreshIfNeeded(store) {
  if (!store?.tokens?.refresh_token) {
    const err = new Error("QuickBooks not connected. Missing refresh token.");
    err.code = "QBO_NOT_CONNECTED";
    throw err;
  }
  const expiresAt = Number(store.tokens.expires_at || 0) || 0;
  if (expiresAt && expiresAt > nowMs() + 15_000) return store;

  const tokenData = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: store.tokens.refresh_token
  });

  const expiresInSec = Number(tokenData?.expires_in || 0) || 0;
  const next = {
    ...store,
    tokens: {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || store.tokens.refresh_token,
      expires_at: nowMs() + Math.max(0, expiresInSec - 60) * 1000
    },
    updated_at: new Date().toISOString()
  };
  writeStore(next);
  return next;
}

async function qboFetch(pathname, { method = "GET", headers = {}, body } = {}) {
  const store = await refreshIfNeeded(readStore());
  const realmId = String(store?.realmId || "").trim();
  if (!realmId) {
    const err = new Error("QuickBooks realmId missing. Reconnect QuickBooks.");
    err.code = "QBO_NO_REALM";
    throw err;
  }

  const url = `${getApiBase()}/v3/company/${encodeURIComponent(realmId)}${pathname}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${store.tokens.access_token}`,
      "Accept": "application/json",
      ...headers
    },
    body
  });

  if (res.status === 401 || res.status === 403) {
    const refreshed = await refreshIfNeeded(readStore());
    const retry = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${refreshed.tokens.access_token}`,
        "Accept": "application/json",
        ...headers
      },
      body
    });
    return retry;
  }

  return res;
}

export async function qboQuery(query) {
  const q = String(query || "").trim();
  const res = await qboFetch(`/query?minorversion=65&query=${encodeURIComponent(q)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.Fault?.Error?.[0]?.Message || "QuickBooks query failed.");
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

function qboSqlString(value) {
  return String(value || "").replace(/'/g, "''");
}

async function findOrCreateCustomer({ name, email, phone, billAddr }) {
  const emailSafe = String(email || "").trim();
  const nameSafe = String(name || "").trim() || emailSafe || "Customer";
  if (!emailSafe) {
    const err = new Error("Customer email required for QuickBooks sync.");
    err.code = "QBO_MISSING_EMAIL";
    throw err;
  }

  const query = `select Id, DisplayName, PrimaryEmailAddr from Customer where PrimaryEmailAddr = '${qboSqlString(emailSafe)}'`;
  const existing = await qboQuery(query);
  const found = existing?.QueryResponse?.Customer?.[0];
  if (found?.Id) return String(found.Id);

  const payload = {
    DisplayName: nameSafe.length > 100 ? nameSafe.slice(0, 100) : nameSafe,
    PrimaryEmailAddr: { Address: emailSafe }
  };
  if (phone) payload.PrimaryPhone = { FreeFormNumber: String(phone) };
  if (billAddr) payload.BillAddr = billAddr;

  const res = await qboFetch(`/customer?minorversion=65`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.Fault?.Error?.[0]?.Message || "QuickBooks customer create failed.");
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return String(data?.Customer?.Id || "");
}

function centsToAmount(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

function buildBillAddr(customer) {
  if (!customer || typeof customer !== "object") return null;
  const line1 = String(customer.address1 || "").trim();
  const city = String(customer.city || "").trim();
  const province = String(customer.province || "").trim();
  const postal = String(customer.postal || "").trim();
  if (!line1 && !city && !province && !postal) return null;
  const out = {};
  if (line1) out.Line1 = line1;
  const line2 = String(customer.address2 || "").trim();
  if (line2) out.Line2 = line2;
  if (city) out.City = city;
  if (province) out.CountrySubDivisionCode = province;
  if (postal) out.PostalCode = postal;
  out.Country = String(customer.country || "Canada");
  return out;
}

function splitOrderLines(orderRow) {
  const items = Array.isArray(orderRow?.items) ? orderRow.items : [];
  const productLines = [];
  let shippingLine = null;
  let taxLine = null;

  for (const it of items) {
    if (!it) continue;
    const id = String(it.id || "").toLowerCase();
    const name = String(it.name || "").toLowerCase();
    if (id === "shipping" || name.includes("shipping")) {
      shippingLine = it;
      continue;
    }
    if (id === "tax" || name.startsWith("tax") || name.includes(" gst") || name.includes("hst") || name.includes("qst")) {
      taxLine = it;
      continue;
    }
    productLines.push(it);
  }

  // Pay-later orders store shipping separately; include it if present.
  if (!shippingLine && orderRow?.shipping?.costCents) {
    shippingLine = {
      id: "shipping",
      name: String(orderRow.shipping.label || "Shipping"),
      qty: 1,
      priceCents: Number(orderRow.shipping.costCents || 0)
    };
  }

  return { productLines, shippingLine, taxLine };
}

export async function qboUpsertInvoiceForOrder(orderRow, { sendEmail } = {}) {
  const cfg = getConfig();
  if (!qboIsConfigured()) {
    const err = new Error("QuickBooks not configured.");
    err.code = "QBO_NOT_CONFIGURED";
    throw err;
  }
  if (!cfg.defaultItemId) {
    const err = new Error("QuickBooks default item not configured. Set QBO_DEFAULT_ITEM_ID.");
    err.code = "QBO_NO_DEFAULT_ITEM";
    throw err;
  }

  const orderId = String(orderRow?.id || "").trim();
  if (!orderId) {
    const err = new Error("order.id required for QuickBooks sync.");
    err.code = "QBO_BAD_ORDER";
    throw err;
  }

  const customer = orderRow?.customer || {};
  const customerEmail = String(orderRow?.customer_email || customer?.email || "").trim().toLowerCase();
  const customerName = String(customer?.name || "").trim() || customerEmail || "Customer";
  const customerPhone = String(customer?.phone || "").trim();

  const billAddr = buildBillAddr(customer);
  const customerId = await findOrCreateCustomer({
    name: customerName,
    email: customerEmail,
    phone: customerPhone,
    billAddr
  });

  // Idempotency: check by DocNumber (order id).
  const existing = await qboQuery(`select Id, DocNumber from Invoice where DocNumber = '${qboSqlString(orderId)}'`);
  const existingInvoice = existing?.QueryResponse?.Invoice?.[0];
  const existingId = existingInvoice?.Id ? String(existingInvoice.Id) : "";
  if (existingId) {
    if (sendEmail ?? cfg.emailInvoice) {
      await qboSendInvoice(existingId, customerEmail).catch(() => {});
    }
    return { ok: true, invoiceId: existingId, reused: true };
  }

  const { productLines, shippingLine, taxLine } = splitOrderLines(orderRow);
  const lines = [];

  function pushSalesLine({ name, qty, unitCents, itemRef }) {
    const q = Math.max(1, Number(qty || 1));
    const unit = Math.max(0, Number(unitCents || 0));
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: centsToAmount(unit * q),
      Description: String(name || "Item"),
      SalesItemLineDetail: {
        ItemRef: { value: String(itemRef || cfg.defaultItemId) },
        Qty: q,
        UnitPrice: centsToAmount(unit)
      }
    });
  }

  for (const it of productLines) {
    pushSalesLine({
      name: it.name || "Item",
      qty: it.qty,
      unitCents: it.priceCents,
      itemRef: cfg.defaultItemId
    });
  }

  if (shippingLine && Number(shippingLine.priceCents || 0) > 0) {
    pushSalesLine({
      name: shippingLine.name || "Shipping",
      qty: 1,
      unitCents: shippingLine.priceCents,
      itemRef: cfg.shippingItemId || cfg.defaultItemId
    });
  }

  // Tax strategy:
  // - line (default): include tax as its own line so totals match without requiring QBO tax configuration.
  // - qbo: set TaxCodeRef on lines and do NOT include a manual tax line (requires QBO_TAX_CODE_ID).
  // - none: do not include tax.
  const taxMode = cfg.syncTaxMode;
  if (taxMode === "qbo" && cfg.taxCodeId) {
    for (const l of lines) {
      if (l?.SalesItemLineDetail) {
        l.SalesItemLineDetail.TaxCodeRef = { value: cfg.taxCodeId };
      }
    }
  } else if (taxMode === "line" && taxLine && Number(taxLine.priceCents || 0) > 0) {
    pushSalesLine({
      name: taxLine.name || "Tax",
      qty: 1,
      unitCents: taxLine.priceCents,
      itemRef: cfg.taxItemId || cfg.defaultItemId
    });
  }

  const payload = {
    DocNumber: orderId,
    CustomerRef: { value: customerId },
    BillEmail: { Address: customerEmail },
    PrivateNote: `Power Poly Supplies order ${orderId}`,
    Line: lines,
    CurrencyRef: { value: String(orderRow?.currency || "CAD").toUpperCase() }
  };
  if (billAddr) payload.BillAddr = billAddr;

  const res = await qboFetch(`/invoice?minorversion=65`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.Fault?.Error?.[0]?.Message || "QuickBooks invoice create failed.");
    err.status = res.status;
    err.details = data;
    throw err;
  }

  const invoiceId = String(data?.Invoice?.Id || "");
  if ((sendEmail ?? cfg.emailInvoice) && invoiceId) {
    await qboSendInvoice(invoiceId, customerEmail).catch(() => {});
  }
  return { ok: true, invoiceId, reused: false };
}

export async function qboSendInvoice(invoiceId, sendTo) {
  const id = String(invoiceId || "").trim();
  if (!id) return { ok: false, message: "invoiceId required" };

  const qs = sendTo
    ? `?sendTo=${encodeURIComponent(String(sendTo).trim())}&minorversion=65`
    : `?minorversion=65`;
  const res = await qboFetch(`/invoice/${encodeURIComponent(id)}/send${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.Fault?.Error?.[0]?.Message || "QuickBooks invoice send failed.");
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return { ok: true };
}

export async function qboDownloadInvoicePdf(invoiceId) {
  const id = String(invoiceId || "").trim();
  if (!id) {
    const err = new Error("invoiceId required");
    err.code = "QBO_MISSING_INVOICE_ID";
    throw err;
  }
  const res = await qboFetch(`/invoice/${encodeURIComponent(id)}/pdf?minorversion=65`, {
    method: "GET",
    headers: { "Accept": "application/pdf" }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error("QuickBooks invoice PDF download failed.");
    err.status = res.status;
    err.details = text;
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}
