// Backend base URL selection with overrides:
// 1) window.PPS_API_BASE (set in a config.js or before store.js loads)
// 2) ?api= query param
// 3) localStorage override "pps_api_base" (handy for production hardcoding)
// 4) same-origin for deployed setups
// 5) localhost:5000 for local dev
const DEFAULT_API_BASE = "http://127.0.0.1:5000";
const DEFAULT_CAD_TO_USD = 0.74;
const FAVORITES_KEY = "pps_favorites";

function inferApiBase(){
  if(window.PPS_API_BASE) return window.PPS_API_BASE;

  const apiFromQuery = new URLSearchParams(window.location.search).get("api");
  if(apiFromQuery) return apiFromQuery;

  const apiFromStorage = localStorage.getItem("pps_api_base");
  if(apiFromStorage) return apiFromStorage;

  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol && window.location.protocol.startsWith("http")
    ? window.location.protocol
    : "http:";

  if(host === "localhost" || host === "127.0.0.1"){
    return `${protocol}//127.0.0.1:5000`;
  }

  if(window.location.origin && window.location.origin !== "null"){
    return window.location.origin;
  }

  return DEFAULT_API_BASE;
}

const API_BASE = inferApiBase();

function getCadUsdRate(){
  const stored = Number(localStorage.getItem("pps_cad_usd_rate"));
  if(Number.isFinite(stored) && stored > 0) return stored;
  const fromWindow = Number(window.PPS_CAD_USD_RATE);
  if(Number.isFinite(fromWindow) && fromWindow > 0) return fromWindow;
  return DEFAULT_CAD_TO_USD;
}

function getCurrency(){
  const saved = localStorage.getItem("pps_currency");
  return saved === "USD" ? "USD" : "CAD";
}

function setCurrency(currency){
  const next = currency === "USD" ? "USD" : "CAD";
  const current = getCurrency();
  localStorage.setItem("pps_currency", next);
  if(current !== next){
    window.dispatchEvent(new CustomEvent("pps:currency", { detail:{ currency: next } }));
    window.location.reload();
  }
}

function convertCents(cents, fromCurrency="CAD", toCurrency){
  const from = String(fromCurrency || "CAD").toUpperCase();
  const target = String(toCurrency || getCurrency()).toUpperCase();
  const value = Math.round(Number(cents) || 0);
  if(from === target) return value;
  const rate = getCadUsdRate();
  if(from === "CAD" && target === "USD") return Math.round(value * rate);
  if(from === "USD" && target === "CAD") return Math.round(value / rate);
  return value;
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

function money(cents, currency="CAD", targetCurrency){
  const target = String(targetCurrency || getCurrency()).toUpperCase();
  const base = String(currency || "CAD").toUpperCase();
  const converted = convertCents(Number(cents) || 0, base, target);
  const locale = target === "USD" ? "en-US" : "en-CA";
  return new Intl.NumberFormat(locale,{style:"currency",currency: target}).format(converted/100);
}

async function pingBackend(){
  try{
    const res = await fetch(`${API_BASE}/api/health`, { cache:"no-store" });
    return res.ok;
  }catch(err){
    return false;
  }
}

async function loadProducts(){
  // Prefer backend (real stock). Fallback to local JSON if backend not running.
  try{
    const res = await fetch(`${API_BASE}/api/products`);
    if(res.ok){
      const data = await res.json();
      if(data?.ok && Array.isArray(data.products)) {
        window._products = data.products;
        return data.products;
      }
    }
  }catch(e){ /* ignore */ }

  const res2 = await fetch("./data/products.json");
  const json = await res2.json();
  window._products = json;
  return json;
}

async function fetchReviews(productId){
  const url = `${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews`;
  const res = await fetch(url);
  if(!res.ok) throw new Error("Failed to load reviews");
  return res.json();
}

async function submitReview(productId, payload){
  const url = `${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews`;
  const res = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok || !data.ok) throw new Error(data?.message || "Failed to submit review");
  return data;
}

function getCart(){
  const raw = JSON.parse(localStorage.getItem("pps_cart") || "[]");
  return raw.map((item)=>({
    ...item,
    priceCentsBase: Number(item.priceCentsBase ?? item.priceCents ?? 0),
    currencyBase: (item.currencyBase || item.currency || "CAD").toUpperCase()
  }));
}

function setCart(cart){
  localStorage.setItem("pps_cart", JSON.stringify(cart));
  updateCartBadge();
}

function getFavorites(){
  try{
    const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  }catch(err){
    return [];
  }
}

function setFavorites(list){
  const unique = Array.from(new Set((list || []).filter(Boolean)));
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(unique));
  window.dispatchEvent(new CustomEvent("pps:favorites", { detail:{ favorites: unique } }));
}

function isFavorite(productId){
  return getFavorites().includes(productId);
}

function toggleFavorite(productId){
  if(!productId) return getFavorites();
  const list = getFavorites();
  const idx = list.indexOf(productId);
  if(idx >= 0){
    list.splice(idx, 1);
  }else{
    list.push(productId);
  }
  setFavorites(list);
  return list;
}

function updateCartBadge(){
  const badge = document.querySelector("[data-cart-badge]");
  if(!badge) return;
  const cart = getCart();
  const count = cart.reduce((sum,i)=>sum+i.qty,0);
  badge.textContent = count;
}

function addToCart(product, qty=1){
  const safeQty = Math.max(1, Number(qty) || 1);
  const cart = getCart();
  const existing = cart.find(i=>i.id===product.id);
  if(existing){
    existing.qty += safeQty;
    existing.description = product.description || existing.description || "";
    existing.description_fr = product.description_fr || existing.description_fr || "";
    existing.description_ko = product.description_ko || existing.description_ko || "";
    existing.description_hi = product.description_hi || existing.description_hi || "";
    existing.description_ta = product.description_ta || existing.description_ta || "";
    existing.priceCentsBase = existing.priceCentsBase ?? product.priceCents;
    existing.currencyBase = existing.currencyBase || product.currency || "CAD";
  }else{
    cart.push({
      id:product.id,
      name:product.name,
      priceCents:product.priceCents,
      currency:product.currency,
      qty:safeQty,
      description: product.description || "",
      description_fr: product.description_fr || "",
      description_ko: product.description_ko || "",
      description_hi: product.description_hi || "",
      description_ta: product.description_ta || "",
      priceCentsBase: product.priceCents,
      currencyBase: product.currency || "CAD"
    });
  }
  setCart(cart);
}

function setApiBaseOverride(url){
  if(url){
    localStorage.setItem("pps_api_base", url);
    window.location.reload();
  }
}


function getSession(){
  try{
    const raw = localStorage.getItem("pps_session");
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(!data?.token || !data?.email) return null;
    if(data.expiresAt && Date.now() > data.expiresAt){
      localStorage.removeItem("pps_session");
      return null;
    }
    return data;
  }catch(err){
    return null;
  }
}

function setSession(session){
  if(!session || !session.token || !session.email) return;
  localStorage.setItem("pps_session", JSON.stringify(session));
}

function clearSession(){
  localStorage.removeItem("pps_session");
}

function addItemsToCart(items){
  if(!Array.isArray(items)) return;
  items.forEach((item)=>{
    if(!item) return;
    const qty = Number(item.qty) || 1;
    const basePrice = Number(item.priceCentsBase ?? item.priceCents ?? 0);
    const baseCurrency = item.currencyBase || item.currency || "CAD";
    addToCart({
      id: item.id,
      name: item.name,
      priceCents: basePrice,
      currency: baseCurrency,
      description: item.description || "",
      description_fr: item.description_fr || "",
      description_ko: item.description_ko || "",
      description_hi: item.description_hi || "",
      description_ta: item.description_ta || ""
    }, qty);
  });
}

window.PPS = { API_BASE, money, convertCents, getTieredPriceCents, getCurrency, setCurrency, pingBackend, loadProducts, fetchReviews, submitReview, getCart, setCart, updateCartBadge, addToCart, addItemsToCart, getFavorites, isFavorite, toggleFavorite, getSession, setSession, clearSession, setApiBaseOverride };
