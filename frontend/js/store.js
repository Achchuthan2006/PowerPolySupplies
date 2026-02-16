// Backend base URL selection with overrides:
// 1) window.API_BASE_URL (set in config.js or before store.js loads)
// 2) window.PPS_API_BASE (backwards-compat)
// 2) ?api= query param
// 3) localStorage override "pps_api_base" (handy for production hardcoding)
// 4) same-origin for deployed setups
// 5) localhost:5000 for local dev
const DEFAULT_API_BASE = "http://127.0.0.1:5000";
const DEFAULT_CAD_TO_USD = 0.74;
const FAVORITES_KEY = "pps_favorites";
const CART_KEY = "pps_cart";
const CART_COOKIE = "pps_cart";
const CAPED_WE_LOVE_IMAGE = "./assets/welovecaped%20hanger.webp";
const CLEAR_POLYBAG_IMAGE = "./assets/polybag%20clear.webp";
const GARMENT_BAGS_IMAGE = "./assets/polybag%20clear.webp";
const SHIRT_HANGER_ID = "hanger-shirt-18-plain";
const SHIRT_HANGER_MEMBER_CENTS = 3259;
const SHIRT_HANGER_COMPARE_CENTS = 4259;
const PRODUCTS_CACHE_KEY = "pps_products_cache_v2";
const PRODUCTS_FAST_MS = 400;
const WISHLISTS_SUFFIX = "wishlists_v1";

function normalizeImagePath(value){
  if(!value) return value;
  return String(value).replace(/ /g, "%20");
}

function isShirtHangerPlain(product){
  const id = String(product?.id || "").trim().toLowerCase();
  const slug = String(product?.slug || "").trim().toLowerCase();
  const name = String(product?.name || "").trim().toLowerCase();
  if(id === SHIRT_HANGER_ID) return true;
  if(slug === "shirt-hangers-18-plain") return true;
  return /shirt\s*hangers?\s*plain\s*\(18/.test(name);
}

function normalizeProductImage(product){
  if(!product) return product;
  const image = normalizeImagePath(product.image);
  const images = Array.isArray(product.images)
    ? product.images.map(normalizeImagePath).filter(Boolean)
    : [];
  if(isShirtHangerPlain(product)){
    return {
      ...product,
      image,
      images,
      priceCents: SHIRT_HANGER_MEMBER_CENTS,
      comparePriceCents: SHIRT_HANGER_COMPARE_CENTS
    };
  }
  if(product.id === "hanger-caped-16-we-love"){
    if(!image || /welovefinal|caped%20we%20love\.png/i.test(image)){
      return { ...product, image: CAPED_WE_LOVE_IMAGE, images };
    }
  }
  const category = String(product.category || "").trim();
  const name = String(product.name || "").trim();
  const slug = String(product.slug || "").trim();
  if(category === "Polybags" && /clear poly bags/i.test(name || slug)){
    return { ...product, image: CLEAR_POLYBAG_IMAGE, images };
  }
  if(
    category === "Garment Bags" &&
    (
      !image ||
      /clear%20poly%20bags\.webp|clear poly bags\.webp/i.test(image)
    )
  ){
    return { ...product, image: GARMENT_BAGS_IMAGE, images };
  }
  return { ...product, image, images };
}

function readCachedProducts(){
  if(Array.isArray(window._products) && window._products.length){
    return window._products;
  }
  try{
    const raw = sessionStorage.getItem(PRODUCTS_CACHE_KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    if(Array.isArray(parsed) && parsed.length){
      window._products = parsed;
      return parsed;
    }
  }catch(err){
    // ignore
  }
  return null;
}

function cacheProducts(products){
  if(!Array.isArray(products) || !products.length) return;
  window._products = products;
  try{
    sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
  }catch(err){
    // ignore
  }
}

function wrapProducts(products){
  return Array.isArray(products) ? products.map(normalizeProductImage) : null;
}

function fastTimeout(ms){
  return new Promise((resolve)=> setTimeout(()=> resolve({ source:"timeout", data:null }), ms));
}

async function fetchBackendProducts(){
  try{
    const res = await fetch(`${API_BASE}/api/products`, { cache:"no-store" });
    if(!res.ok) return null;
    const data = await res.json();
    if(data?.ok && Array.isArray(data.products)) {
      return wrapProducts(data.products);
    }
  }catch(err){
    // ignore
  }
  return null;
}

async function fetchLocalProducts(){
  try{
    const res = await fetch("./data/products.json", { cache:"force-cache" });
    if(!res.ok) return null;
    const json = await res.json();
    return wrapProducts(json || []);
  }catch(err){
    // ignore
  }
  return null;
}

function inferApiBase(){
  function normalizeApiBase(value){
    const raw = String(value || "").trim();
    if(!raw) return "";
    let out = raw.replace(/\/+$/,"");
    // If someone sets API_BASE_URL to ".../api", avoid double "/api/api/...".
    out = out.replace(/\/api$/i, "");
    return out;
  }

  if(window.API_BASE_URL) return normalizeApiBase(window.API_BASE_URL);
  if(window.PPS_API_BASE) return normalizeApiBase(window.PPS_API_BASE);

  const apiFromQuery = new URLSearchParams(window.location.search).get("api");
  if(apiFromQuery) return normalizeApiBase(apiFromQuery);

  const apiFromStorage = localStorage.getItem("pps_api_base");
  if(apiFromStorage) return normalizeApiBase(apiFromStorage);

  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol && window.location.protocol.startsWith("http")
    ? window.location.protocol
    : "http:";

  if(host === "localhost" || host === "127.0.0.1"){
    return `${protocol}//127.0.0.1:5000`;
  }

  if(window.location.origin && window.location.origin !== "null"){
    return normalizeApiBase(window.location.origin);
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
  try{
    const fromQuery = new URLSearchParams(window.location.search).get("currency");
    if(fromQuery) return fromQuery === "USD" ? "USD" : "CAD";
  }catch(err){
    // ignore
  }
  try{
    const saved = localStorage.getItem("pps_currency");
    if(saved) return saved === "USD" ? "USD" : "CAD";
  }catch(err){
    // ignore
  }
  const match = document.cookie.match(/(?:^|; )pps_currency=([^;]*)/);
  const saved = match ? decodeURIComponent(match[1]) : "";
  return saved === "USD" ? "USD" : "CAD";
}

function setCurrency(currency){
  const next = currency === "USD" ? "USD" : "CAD";
  const current = getCurrency();
  try{
    localStorage.setItem("pps_currency", next);
  }catch(err){
    // ignore
  }
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `pps_currency=${encodeURIComponent(next)}; max-age=${maxAge}; path=/; samesite=lax`;
  try{
    const url = new URL(window.location.href);
    url.searchParams.set("currency", next);
    window.history.replaceState({}, "", url.toString());
  }catch(err){
    // ignore
  }
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
  if(isShirtHangerPlain(product)){
    const count = Math.max(0, Number(qty) || 0);
    if(count >= 20) return 2959;
    if(count >= 15) return 3059;
    if(count >= 10) return 3159;
    return SHIRT_HANGER_MEMBER_CENTS;
  }
  if((product.category || "") === "Garment Bags"){
    const count = Math.max(0, Number(qty) || 0);
    if(count >= 20) return 3699;
    if(count >= 15) return 3799;
    if(count >= 10) return 3899;
  }
  return base;
}

function getComparePriceCents(product){
  if(!product) return 0;
  if(isShirtHangerPlain(product)){
    return SHIRT_HANGER_COMPARE_CENTS;
  }
  const compare = Math.round(Number(product.comparePriceCents));
  if(Number.isFinite(compare) && compare > 0) return compare;
  return (Math.round(Number(product.priceCents) || 0) + 1000);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(()=> controller.abort(), 8000);
    const res = await fetch(`${API_BASE}/api/health`, { cache:"no-store", signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  }catch(err){
    return false;
  }
}

async function loadProducts(){
  const cached = readCachedProducts();
  if(cached){
    try{
      const session = window.PPS?.getSession?.();
      if(session?.email && window.PPS_NOTIFS?.refreshFromAccount){
        const favorites = window.PPS?.getFavorites?.() || [];
        window.PPS_NOTIFS.refreshFromAccount({ session, orders: [], products: cached, favorites, frequent: [] });
      }
    }catch(_err){
      // ignore
    }
    return cached;
  }

  const backendPromise = fetchBackendProducts();
  const localPromise = fetchLocalProducts();

  const fast = await Promise.race([
    backendPromise.then((data)=>({ source:"backend", data })),
    localPromise.then((data)=>({ source:"local", data })),
    fastTimeout(PRODUCTS_FAST_MS)
  ]);

  if(fast.source !== "timeout" && Array.isArray(fast.data)){
    cacheProducts(fast.data);
    try{
      const session = window.PPS?.getSession?.();
      if(session?.email && window.PPS_NOTIFS?.refreshFromAccount){
        const favorites = window.PPS?.getFavorites?.() || [];
        window.PPS_NOTIFS.refreshFromAccount({ session, orders: [], products: fast.data, favorites, frequent: [] });
      }
    }catch(_err){
      // ignore
    }
    return fast.data;
  }

  const [backend, local] = await Promise.all([backendPromise, localPromise]);
  const chosen = Array.isArray(backend) ? backend : (Array.isArray(local) ? local : []);
  cacheProducts(chosen);
  try{
    const session = window.PPS?.getSession?.();
    if(session?.email && window.PPS_NOTIFS?.refreshFromAccount){
      const favorites = window.PPS?.getFavorites?.() || [];
      window.PPS_NOTIFS.refreshFromAccount({ session, orders: [], products: chosen, favorites, frequent: [] });
    }
  }catch(_err){
    // ignore
  }
  return chosen;
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

function readCookie(name){
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function writeCookie(name, value, days = 30){
  const maxAge = 60 * 60 * 24 * days;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=lax`;
}

function serializeCartForCookie(cart){
  if(!Array.isArray(cart) || !cart.length) return "[]";
  const minimal = cart
    .filter(item => item && item.id && Number(item.qty) > 0)
    .map(item => [String(item.id), Math.max(1, Number(item.qty) || 1)]);
  return JSON.stringify(minimal);
}

function readCartFromCookie(){
  try{
    const raw = readCookie(CART_COOKIE);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    return parsed
      .filter(entry => Array.isArray(entry) && entry[0])
      .map(([id, qty]) => ({ id: String(id), qty: Math.max(1, Number(qty) || 1) }));
  }catch(err){
    return [];
  }
}

function normalizeCartItems(items){
  return (items || []).map((item)=>({
    ...item,
    qty: Math.max(1, Number(item.qty) || 1),
    priceCentsBase: Number(item.priceCentsBase ?? item.priceCents ?? 0),
    currencyBase: (item.currencyBase || item.currency || "CAD").toUpperCase()
  }));
}

function readCartFromQuery(){
  try{
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("cart");
    if(!raw) return [];
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
    const decoded = decodeURIComponent(escape(atob(base64 + pad)));
    const parsed = JSON.parse(decoded);
    if(!Array.isArray(parsed) || !parsed.length) return [];
    return parsed
      .filter(entry => Array.isArray(entry) && entry[0])
      .map(([id, qty]) => ({ id: String(id), qty: Math.max(1, Number(qty) || 1) }));
  }catch(err){
    return [];
  }
}

function getCart(){
  try{
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if(Array.isArray(raw) && raw.length){
      const normalized = normalizeCartItems(raw);
      writeCookie(CART_COOKIE, serializeCartForCookie(normalized));
      return normalized;
    }
  }catch(err){
    // ignore and fall back to cookie
  }

  const fromQuery = readCartFromQuery();
  if(fromQuery.length){
    try{
      localStorage.setItem(CART_KEY, JSON.stringify(fromQuery));
    }catch(err){
      // ignore
    }
    writeCookie(CART_COOKIE, JSON.stringify(fromQuery));
    return normalizeCartItems(fromQuery);
  }

  const fromCookie = readCartFromCookie();
  if(!fromCookie.length) return [];

  const cachedProducts = readCachedProducts() || [];
  const productsById = new Map(cachedProducts.map(p => [p.id, p]));
  const hydrated = fromCookie.map(({ id, qty })=>{
    const product = productsById.get(id);
    const currency = (product?.currency || "CAD").toUpperCase();
    return normalizeCartItems([{
      id,
      qty,
      name: product?.name || "Item",
      priceCents: Number(product?.priceCents || 0),
      currency,
      priceCentsBase: Number(product?.priceCents || 0),
      currencyBase: currency,
      description: product?.description || "",
      description_fr: product?.description_fr || "",
      description_ko: product?.description_ko || "",
      description_hi: product?.description_hi || "",
      description_ta: product?.description_ta || "",
      description_es: product?.description_es || ""
    }])[0];
  });

  try{
    localStorage.setItem(CART_KEY, JSON.stringify(hydrated));
  }catch(err){
    // ignore
  }
  return hydrated;
}

function setCart(cart){
  const safe = normalizeCartItems(cart);
  try{
    localStorage.setItem(CART_KEY, JSON.stringify(safe));
  }catch(err){
    // ignore
  }
  writeCookie(CART_COOKIE, serializeCartForCookie(safe));
  updateCartBadge();
  try{
    const count = safe.reduce((sum, item)=> sum + (Number(item?.qty) || 0), 0);
    window.dispatchEvent(new CustomEvent("pps:cart", { detail:{ cart: safe, count } }));
    window.PPS_ANALYTICS?.record?.("cart_update", { count });
  }catch(err){
    // ignore
  }
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
  const badges = document.querySelectorAll("[data-cart-badge]");
  if(!badges.length) return;
  const cart = getCart();
  const count = cart.reduce((sum,i)=>sum+i.qty,0);
  badges.forEach(b=>{ b.textContent = count; });
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
    existing.description_es = product.description_es || existing.description_es || "";
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
      description_es: product.description_es || "",
      priceCentsBase: product.priceCents,
      currencyBase: product.currency || "CAD"
    });
  }
  setCart(cart);
  try{
    window.PPS_ANALYTICS?.record?.("add_to_cart", { id: product.id, qty: safeQty, name: product.name });
  }catch(err){
    // ignore
  }
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

function getAccountEmail(){
  const session = getSession();
  const email = String(session?.email || "").trim().toLowerCase();
  return email || "";
}

function accountKey(email, suffix){
  const e = String(email || "").trim().toLowerCase();
  if(!e) return "";
  return `pps_account_${e}_${suffix}`;
}

function readJson(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch(err){
    return fallback;
  }
}

function writeJson(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  }catch(err){
    return false;
  }
}

function normalizeWishlists(data){
  const lists = Array.isArray(data?.lists) ? data.lists : [];
  const normalized = lists.map((l)=>({
    id: String(l?.id || ""),
    name: String(l?.name || "Wishlist").trim() || "Wishlist",
    createdAt: String(l?.createdAt || ""),
    items: Array.isArray(l?.items)
      ? l.items.map((it)=>({
          productId: String(it?.productId || it?.id || ""),
          addedAt: String(it?.addedAt || "")
        })).filter(it=>it.productId)
      : []
  })).filter(l=>l.id);

  if(!normalized.length){
    return {
      lists: [{
        id: `wl_${Date.now()}`,
        name: "Wishlist",
        createdAt: new Date().toISOString(),
        items: []
      }]
    };
  }
  return { lists: normalized };
}

function getWishlists(){
  const email = getAccountEmail();
  if(!email) return null;
  const key = accountKey(email, WISHLISTS_SUFFIX);
  const data = normalizeWishlists(readJson(key, null));
  writeJson(key, data);
  return data;
}

function setWishlists(next){
  const email = getAccountEmail();
  if(!email) return null;
  const key = accountKey(email, WISHLISTS_SUFFIX);
  const data = normalizeWishlists(next);
  writeJson(key, data);
  window.dispatchEvent(new CustomEvent("pps:wishlists", { detail:{ email, wishlists: data } }));
  return data;
}

function createWishlist(name){
  const data = getWishlists();
  if(!data) return null;
  const clean = String(name || "").trim() || "Wishlist";
  const id = `wl_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return setWishlists({ lists: [{ id, name: clean, createdAt: new Date().toISOString(), items: [] }, ...data.lists] });
}

function renameWishlist(listId, name){
  const data = getWishlists();
  if(!data) return null;
  const clean = String(name || "").trim();
  if(!clean) return data;
  return setWishlists({
    lists: data.lists.map(l=> l.id === String(listId) ? { ...l, name: clean } : l)
  });
}

function deleteWishlist(listId){
  const data = getWishlists();
  if(!data) return null;
  const id = String(listId || "");
  const remaining = data.lists.filter(l=>l.id !== id);
  return setWishlists({ lists: remaining });
}

function addToWishlist(productId, listId){
  const data = getWishlists();
  if(!data) return null;
  const pid = String(productId || "").trim();
  if(!pid) return data;
  const targetId = String(listId || data.lists[0]?.id || "");
  return setWishlists({
    lists: data.lists.map((l)=>{
      if(l.id !== targetId) return l;
      const exists = l.items.some(it=>it.productId === pid);
      if(exists) return l;
      return { ...l, items: [{ productId: pid, addedAt: new Date().toISOString() }, ...l.items] };
    })
  });
}

function removeFromWishlist(productId, listId){
  const data = getWishlists();
  if(!data) return null;
  const pid = String(productId || "").trim();
  if(!pid) return data;
  const id = String(listId || "");
  return setWishlists({
    lists: data.lists.map((l)=>{
      if(id && l.id !== id) return l;
      return { ...l, items: l.items.filter(it=>it.productId !== pid) };
    })
  });
}

function isInAnyWishlist(productId){
  const data = getWishlists();
  if(!data) return false;
  const pid = String(productId || "").trim();
  if(!pid) return false;
  return data.lists.some(l=> l.items.some(it=>it.productId === pid));
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
      description_ta: item.description_ta || "",
      description_es: item.description_es || ""
    }, qty);
  });
}

window.PPS = { API_BASE, money, convertCents, getTieredPriceCents, getComparePriceCents, getCurrency, setCurrency, pingBackend, loadProducts, fetchReviews, submitReview, getCart, setCart, updateCartBadge, addToCart, addItemsToCart, getFavorites, isFavorite, toggleFavorite, getSession, setSession, clearSession, setApiBaseOverride, getWishlists, createWishlist, renameWishlist, deleteWishlist, addToWishlist, removeFromWishlist, isInAnyWishlist };
