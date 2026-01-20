document.getElementById("y").textContent = new Date().getFullYear();
PPS.updateCartBadge();

function restoreCartFromQuery(){
  try{
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("cart");
    if(!raw) return;
    const current = PPS.getCart();
    if(Array.isArray(current) && current.length) return;
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
    const decoded = decodeURIComponent(escape(atob(base64 + pad)));
    const parsed = JSON.parse(decoded);
    if(!Array.isArray(parsed) || !parsed.length) return;
    const minimal = parsed
      .filter(entry => Array.isArray(entry) && entry[0])
      .map(([id, qty]) => ({ id: String(id), qty: Math.max(1, Number(qty) || 1) }));
    if(minimal.length) PPS.setCart(minimal);
  }catch(err){
    // ignore
  }
}

restoreCartFromQuery();

const cart = PPS.getCart();
let productMap = null;
const productsPromise = PPS.loadProducts().then((products)=>{
  productMap = new Map(products.map(p=>[p.id, p]));
});
const summary = document.getElementById("summary");
const subtotalEl = document.getElementById("subtotal");
const taxLabelEl = document.getElementById("taxLabel");
const taxAmountEl = document.getElementById("taxAmount");
const qstRowEl = document.getElementById("qstRow");
const qstLabelEl = document.getElementById("qstLabel");
const qstAmountEl = document.getElementById("qstAmount");
const shippingLabelEl = document.getElementById("shippingLabel");
const shippingAmountEl = document.getElementById("shippingAmount");
const totalEl = document.getElementById("total");
const savingsRowEl = document.getElementById("savingsRow");
const savingsAmountEl = document.getElementById("savingsAmount");
const msg = document.getElementById("msg");
const backendStatus = document.getElementById("backendStatus");
const payBtn = document.getElementById("payOnline");
const submitBtn = document.querySelector("#form button[type='submit']");
const formEl = document.getElementById("form");
const provinceSelect = document.getElementById("province");
const postalInput = document.getElementById("postal");

async function checkBackendHealth(){
  if(!backendStatus) return;
  const base = String(PPS.API_BASE || "").trim().replace(/\/+$/,"");
  if(!base) return;
  try{
    const controller = new AbortController();
    const timeoutId = setTimeout(()=> controller.abort(), 4500);
    const res = await fetch(`${base}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json().catch(()=> ({}));
    if(!res.ok || !data?.ok) throw new Error("Health check failed");

    const square = data.square || {};
    const email = data.email || {};
    const squareText = square.configured ? `Square: ready (${square.env || "unknown"})` : "Square: not configured";
    const emailText = email.configured ? "Email: ready" : "Email: not configured";
    backendStatus.textContent = `Backend: up | ${squareText} | ${emailText}`;
    backendStatus.style.display = "block";

    if(!square.configured && payBtn){
      setPending(payBtn, true);
    }
  }catch(err){
    // Keep hidden if backend is unreachable from this frontend.
    backendStatus.style.display = "none";
  }
}

checkBackendHealth();

function getUnitBasePrice(item){
  const product = productMap?.get(item.id);
  if(product){
    return PPS.getTieredPriceCents(product, item.qty);
  }
  return item.priceCentsBase ?? item.priceCents;
}

function getUnitCurrency(item){
  const product = productMap?.get(item.id);
  return product?.currency || item.currencyBase || item.currency || "CAD";
}

// Destination-based tax rules (GST/HST)
const PROVINCE_RATES = {
  ON: { rate: 0.13, label: "HST 13%" },
  NS: { rate: 0.15, label: "HST 15%" },
  NB: { rate: 0.15, label: "HST 15%" },
  NL: { rate: 0.15, label: "HST 15%" },
  PE: { rate: 0.15, label: "HST 15%" },
  AB: { rate: 0.05, label: "GST 5%" },
  BC: { rate: 0.05, label: "GST 5%" },
  SK: { rate: 0.05, label: "GST 5%" },
  MB: { rate: 0.05, label: "GST 5%" },
  QC: { rate: 0.05, label: "GST 5%", qstRate: 0.09975, qstLabel: "QST 9.975%" },
  YT: { rate: 0.05, label: "GST 5%" },
  NT: { rate: 0.05, label: "GST 5%" },
  NU: { rate: 0.05, label: "GST 5%" }
};

function provinceLabel(code){
  const lang = window.PPS_I18N?.getLang?.() || "en";
  const namesEn = {
    ON:"Ontario", NS:"Nova Scotia", NB:"New Brunswick", NL:"Newfoundland and Labrador", PE:"Prince Edward Island",
    AB:"Alberta", BC:"British Columbia", SK:"Saskatchewan", MB:"Manitoba", QC:"Quebec",
    YT:"Yukon", NT:"Northwest Territories", NU:"Nunavut"
  };
  const namesFr = {
    ON:"Ontario", NS:"Nouvelle-?cosse", NB:"Nouveau-Brunswick", NL:"Terre-Neuve-et-Labrador", PE:"?le-du-Prince-?douard",
    AB:"Alberta", BC:"Colombie-Britannique", SK:"Saskatchewan", MB:"Manitoba", QC:"Qu?bec",
    YT:"Yukon", NT:"Territoires du Nord-Ouest", NU:"Nunavut"
  };
  const map = lang === "fr" ? namesFr : namesEn;
  return map[code] || code || "";
}

function provinceName(code){
  const names = {
    ON:"Ontario", NS:"Nova Scotia", NB:"New Brunswick", NL:"Newfoundland and Labrador", PE:"Prince Edward Island",
    AB:"Alberta", BC:"British Columbia", SK:"Saskatchewan", MB:"Manitoba", QC:"Quebec",
    YT:"Yukon", NT:"Northwest Territories", NU:"Nunavut"
  };
  return provinceLabel(code) || code || "";
}

// Reusable tax calculator
function calculateTax(subtotalCents, provinceCode){
  const defaultLabel = window.PPS_I18N?.t("checkout.tax") || "Tax";
  const info = PROVINCE_RATES[provinceCode] || { rate: 0, label: defaultLabel };
  const gstAmount = Math.round(subtotalCents * info.rate);
  const qstAmount = info.qstRate ? Math.round(subtotalCents * info.qstRate) : 0;
  const taxAmount = gstAmount + qstAmount;
  return {
    taxRate: info.rate,
    taxLabel: info.label,
    taxAmount,
    gstAmount,
    qstAmount,
    qstLabel: info.qstLabel || "",
    total: subtotalCents + taxAmount
  };
}

function normalizePostal(value){
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getShippingForPostal(postal){
  const clean = normalizePostal(postal);
  const gtaLabel = window.PPS_I18N?.t("checkout.shipping.label.gta") || "Standard delivery (GTA)";
  const contactLabel = window.PPS_I18N?.t("checkout.shipping.label.contact") || "Delivery charges";
  const freeLabel = window.PPS_I18N?.t("checkout.shipping.free") || "Free";
  const contactValue = window.PPS_I18N?.t("checkout.shipping.contact") || "Contact us";
  if(!clean){
    return { zone: "Unknown", label: contactLabel, amountCents: 0, displayAmount: contactValue };
  }
  const prefix = clean[0];
  if(prefix === "M" || prefix === "L"){
    return { zone: "GTA", label: gtaLabel, amountCents: 0, displayAmount: freeLabel };
  }
  return { zone: "Canada", label: contactLabel, amountCents: 0, displayAmount: contactValue };
}

function applyProvinceLabels(){
  if(!provinceSelect) return;
  const lang = window.PPS_I18N?.getLang?.() || "en";
  const labels = {
    ON: lang === "fr" ? "Ontario" : "Ontario",
    NS: lang === "fr" ? "Nouvelle-?cosse" : "Nova Scotia",
    NB: lang === "fr" ? "Nouveau-Brunswick" : "New Brunswick",
    NL: lang === "fr" ? "Terre-Neuve-et-Labrador" : "Newfoundland and Labrador",
    PE: lang === "fr" ? "?le-du-Prince-?douard" : "Prince Edward Island",
    AB: lang === "fr" ? "Alberta" : "Alberta",
    BC: lang === "fr" ? "Colombie-Britannique" : "British Columbia",
    SK: lang === "fr" ? "Saskatchewan" : "Saskatchewan",
    MB: lang === "fr" ? "Manitoba" : "Manitoba",
    QC: lang === "fr" ? "Qu?bec" : "Quebec",
    YT: lang === "fr" ? "Yukon" : "Yukon",
    NT: lang === "fr" ? "Territoires du Nord-Ouest" : "Northwest Territories",
    NU: lang === "fr" ? "Nunavut" : "Nunavut"
  };
  Array.from(provinceSelect.options).forEach(option=>{
    const code = option.value;
    if(!code) return;
    option.textContent = labels[code] || option.textContent;
  });
}

function setPending(btn, pending, pendingLabel){
  if(!btn) return;
  if(pending){
    if(pendingLabel){
      if(!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
      btn.textContent = pendingLabel;
    }
  }else if(btn.dataset.originalText){
    btn.textContent = btn.dataset.originalText;
  }
  btn.disabled = pending;
}

function drawSummary(){
  const cart = PPS.getCart();
  if(cart.length === 0){
    const emptyMsg = window.PPS_I18N?.t("checkout.summary.empty") || "Your cart is empty.";
    summary.innerHTML = `<div style="color:var(--muted)">${emptyMsg}</div>`;
    subtotalEl.textContent = PPS.money(0);
    taxAmountEl.textContent = PPS.money(0);
    if(qstRowEl) qstRowEl.style.display = "none";
    if(shippingLabelEl) shippingLabelEl.textContent = "Shipping";
    if(shippingAmountEl) shippingAmountEl.textContent = PPS.money(0);
    totalEl.textContent = PPS.money(0);
    if(savingsRowEl) savingsRowEl.style.display = "none";
    setPending(payBtn, true);
    setPending(submitBtn, true);
    return;
  }

  const targetCurrency = PPS.getCurrency();
  const savingsCents = cart.reduce((sum, i)=>{
    const product = productMap?.get(i.id);
    const baseUnit = product?.priceCents ?? i.priceCentsBase ?? i.priceCents ?? 0;
    const unitCents = getUnitBasePrice(i);
    const baseCurrency = getUnitCurrency(i);
    const diff = Math.max(0, baseUnit - unitCents) * i.qty;
    return sum + PPS.convertCents(diff, baseCurrency, targetCurrency);
  }, 0);
  const subtotal = cart.reduce((sum,i)=>{
    const unitCents = getUnitBasePrice(i);
    const baseCents = unitCents * i.qty;
    const baseCurrency = getUnitCurrency(i);
    return sum + PPS.convertCents(baseCents, baseCurrency, targetCurrency);
  }, 0);
  const province = provinceSelect?.value || "";
  const taxData = calculateTax(subtotal, province);
  const shipping = getShippingForPostal(postalInput?.value);
  const shippingCents = PPS.convertCents(shipping.amountCents, "CAD", targetCurrency);

  summary.innerHTML = cart.map(i=>{
    const lang = window.PPS_I18N?.getLang?.() || "en";
    const product = productMap?.get(i.id);
    const desc = lang === "fr"
      ? (i.description_fr || i.description || product?.description_fr || product?.description || "")
      : lang === "ko"
        ? (i.description_ko || i.description || product?.description_ko || product?.description || "")
        : lang === "hi"
          ? (i.description_hi || i.description || product?.description_hi || product?.description || "")
          : lang === "ta"
            ? (i.description_ta || i.description || product?.description_ta || product?.description || "")
            : lang === "es"
              ? (window.PPS_I18N?.autoTranslate?.(i.description_es || i.description || product?.description_es || product?.description || "", "es") || (i.description_es || i.description || product?.description_es || product?.description || ""))
              : (i.description || i.description_fr || i.description_ko || i.description_hi || i.description_ta || i.description_es || product?.description || product?.description_fr || product?.description_ko || product?.description_hi || product?.description_ta || product?.description_es || "");
    const descHtml = desc
      ? `<div style="color:var(--muted); font-size:12px; margin-top:4px;">${desc}</div>`
      : "";
    const unitCents = getUnitBasePrice(i);
    const baseCents = unitCents * i.qty;
    const baseCurrency = getUnitCurrency(i);
    const lineTotal = PPS.convertCents(baseCents, baseCurrency, targetCurrency);
    const baseName = i.name || product?.name || "Item";
    const displayName = lang === "es"
      ? (window.PPS_I18N?.autoTranslate?.(baseName || "", "es") || baseName)
      : baseName;
    return `
      <div style="display:flex; justify-content:space-between; gap:10px;">
        <div>
          <div>${displayName} <span style="color:var(--muted)">x${i.qty}</span></div>
          ${descHtml}
        </div>
        <div style="font-weight:800">${PPS.money(lineTotal, targetCurrency, targetCurrency)}</div>
      </div>
    `;
  }).join("");

  subtotalEl.textContent = PPS.money(subtotal, targetCurrency, targetCurrency);
  if(province === "QC"){
    taxLabelEl.textContent = `${taxData.taxLabel} - ${provinceName(province)}`;
    taxAmountEl.textContent = PPS.money(taxData.gstAmount, targetCurrency, targetCurrency);
    if(qstRowEl){
      qstRowEl.style.display = "flex";
    }
    if(qstLabelEl){
      qstLabelEl.textContent = `${taxData.qstLabel} - ${provinceName(province)}`;
    }
    if(qstAmountEl){
      qstAmountEl.textContent = PPS.money(taxData.qstAmount, targetCurrency, targetCurrency);
    }
  }else{
    taxLabelEl.textContent = `${taxData.taxLabel}${province ? ` - ${provinceName(province)}` : ""}`;
    taxAmountEl.textContent = PPS.money(taxData.taxAmount, targetCurrency, targetCurrency);
    if(qstRowEl) qstRowEl.style.display = "none";
  }
  if(shippingLabelEl) shippingLabelEl.textContent = shipping.label;
  if(shippingAmountEl){
    shippingAmountEl.textContent = shipping.displayAmount
      ? shipping.displayAmount
      : PPS.money(shippingCents, targetCurrency, targetCurrency);
  }
  totalEl.textContent = PPS.money(taxData.total + shippingCents, targetCurrency, targetCurrency);
  if(savingsRowEl && savingsAmountEl){
    if(savingsCents > 0){
      savingsAmountEl.textContent = PPS.money(savingsCents, targetCurrency, targetCurrency);
      savingsRowEl.style.display = "flex";
    }else{
      savingsRowEl.style.display = "none";
    }
  }
  setPending(payBtn, false);
  setPending(submitBtn, false);
}

applyProvinceLabels();

drawSummary();
productsPromise.then(()=>{
  try{
    const cart = PPS.getCart();
    if(!cart.length || !productMap) return;
    let changed = false;
    const next = cart.map((item)=>{
      if(!item || !item.id) return item;
      const product = productMap.get(item.id);
      if(!product) return item;
      const out = { ...item };
      if(!out.name) { out.name = product.name || out.name; changed = true; }
      if(!Number(out.priceCents)) { out.priceCents = Number(product.priceCents || 0); changed = true; }
      if(!Number(out.priceCentsBase)) { out.priceCentsBase = Number(product.priceCents || 0); changed = true; }
      if(!out.currency) { out.currency = product.currency || "CAD"; changed = true; }
      if(!out.currencyBase) { out.currencyBase = product.currency || "CAD"; changed = true; }
      if(!out.description) { out.description = product.description || ""; changed = true; }
      if(!out.description_fr) { out.description_fr = product.description_fr || ""; changed = true; }
      if(!out.description_ko) { out.description_ko = product.description_ko || ""; changed = true; }
      if(!out.description_hi) { out.description_hi = product.description_hi || ""; changed = true; }
      if(!out.description_ta) { out.description_ta = product.description_ta || ""; changed = true; }
      if(!out.description_es) { out.description_es = product.description_es || ""; changed = true; }
      return out;
    });
    if(changed) PPS.setCart(next);
  }catch(err){
    // ignore
  }finally{
    drawSummary();
  }
});

function setStatus(el, text, type="muted"){
  if(!el) return;
  el.textContent = text || "";
  el.classList.remove("error","success","muted");
  el.classList.add(type || "muted","status");
}

async function checkBackend(){
  const ok = await PPS.pingBackend();
  if(ok){
    backendStatus.style.display = "none";
    setPending(payBtn, false);
    setPending(submitBtn, false);
  }else{
    backendStatus.style.display = "block";
    setStatus(backendStatus, window.PPS_I18N?.t("checkout.status.backend") || "Backend unreachable. Please try again.", "error");
    setPending(payBtn, true);
    setPending(submitBtn, true);
  }
}
checkBackend();
setInterval(checkBackend, 15000);

formEl.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const cart = PPS.getCart();
  if(cart.length === 0) return;
  if(!formEl.checkValidity()){
    formEl.reportValidity();
    setStatus(msg, window.PPS_I18N?.t("checkout.status.required") || "Please fill all required fields.", "error");
    return;
  }

  setStatus(msg, window.PPS_I18N?.t("checkout.status.submitting") || "Submitting order...", "muted");
  setPending(submitBtn, true, window.PPS_I18N?.t("checkout.status.submitting_btn") || "Submitting...");
  setPending(payBtn, true);

  const form = e.target;
  const customer = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    address1: form.address1.value.trim(),
    address2: form.address2.value.trim(),
    city: form.city.value.trim(),
    postal: form.postal?.value?.trim() || "",
    province: provinceSelect.value,
    deliveryNotes: form.deliveryNotes?.value?.trim() || "",
    language: window.PPS_I18N?.getLang?.() || "en"
  };

  const targetCurrency = PPS.getCurrency();
  const subtotal = cart.reduce((sum,i)=>{
    const unitCents = getUnitBasePrice(i);
    const baseCents = unitCents * i.qty;
    const baseCurrency = getUnitCurrency(i);
    return sum + PPS.convertCents(baseCents, baseCurrency, targetCurrency);
  }, 0);
  const taxData = calculateTax(subtotal, provinceSelect.value);
  const shipping = getShippingForPostal(postalInput?.value);
  const shippingCents = PPS.convertCents(shipping.amountCents, "CAD", targetCurrency);
  const totalCents = taxData.total + shippingCents;

  const enrichedCart = cart.map((item)=>{
    const product = productMap?.get(item.id);
    const unitCents = getUnitBasePrice(item);
    const baseCurrency = getUnitCurrency(item);
    return {
      ...item,
      description: item.description || product?.description || "",
      description_fr: item.description_fr || product?.description_fr || "",
      description_ko: item.description_ko || product?.description_ko || "",
      description_hi: item.description_hi || product?.description_hi || "",
      description_ta: item.description_ta || product?.description_ta || "",
      description_es: item.description_es || product?.description_es || "",
      priceCentsBase: unitCents,
      currencyBase: baseCurrency,
      priceCents: PPS.convertCents(unitCents, baseCurrency, targetCurrency),
      currency: targetCurrency
    };
  });

  try{
    const controller = new AbortController();
    const timeoutId = setTimeout(()=> controller.abort(), 15000);
    const res = await fetch(`${PPS.API_BASE}/api/order`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        customer,
        items: enrichedCart,
        totalCents,
        currency: targetCurrency,
        paymentMethod:"pay_later",
        shipping: {
          zone: shipping.zone,
          label: shipping.label,
          costCents: shippingCents
        }
      })
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(()=> ({}));
    if(!res.ok || !data.ok){
      setStatus(msg, data?.message || (window.PPS_I18N?.t("checkout.status.failed") || "Order failed. Check backend is running."), "error");
      return;
    }

    localStorage.removeItem("pps_cart");
    window.location.href = "./thank-you.html";
  }catch(err){
    if(err && err.name === "AbortError"){
      setStatus(msg, "Request timed out. Please try again.", "error");
    }else{
      setStatus(msg, window.PPS_I18N?.t("checkout.status.unreachable") || "Server unreachable. Please try again.", "error");
    }
  }finally{
    setPending(submitBtn, false);
    setPending(payBtn, false);
  }
});

document.getElementById("payOnline").addEventListener("click", async ()=>{
  const cart = PPS.getCart();
  if(cart.length === 0) return;
  if(!formEl.checkValidity()){
    formEl.reportValidity();
    setStatus(msg, window.PPS_I18N?.t("checkout.status.required_province") || "Please fill all required fields including province.", "error");
    return;
  }
  setStatus(msg, window.PPS_I18N?.t("checkout.status.redirect") || "Redirecting to Square...", "muted");
  setPending(payBtn, true, window.PPS_I18N?.t("checkout.status.redirect_btn") || "Redirecting...");
  setPending(submitBtn, true);

  try{
    const customer = {
      name: formEl.name.value.trim(),
      email: formEl.email.value.trim(),
      phone: formEl.phone.value.trim(),
      address1: formEl.address1.value.trim(),
      address2: formEl.address2.value.trim(),
      city: formEl.city.value.trim(),
      postal: formEl.postal?.value?.trim() || "",
      province: provinceSelect.value,
      deliveryNotes: formEl.deliveryNotes?.value?.trim() || "",
      language: window.PPS_I18N?.getLang?.() || "en"
    };
    const province = provinceSelect.value;
    const targetCurrency = PPS.getCurrency();
  const subtotal = cart.reduce((sum,i)=>{
    const unitCents = getUnitBasePrice(i);
    const baseCents = unitCents * i.qty;
    const baseCurrency = getUnitCurrency(i);
    return sum + PPS.convertCents(baseCents, baseCurrency, targetCurrency);
  }, 0);
  const taxData = calculateTax(subtotal, province);
  const shipping = getShippingForPostal(postalInput?.value);
  const shippingCents = PPS.convertCents(shipping.amountCents, "CAD", targetCurrency);
  const taxLine = taxData.taxAmount > 0 ? [{
    id:"tax",
    name:`${taxData.taxLabel} (${provinceName(province)})`,
    priceCents: taxData.taxAmount,
    currency: targetCurrency,
    qty:1
  }] : [];
  const shippingLine = shippingCents > 0 ? [{
    id:"shipping",
    name: shipping.label,
    priceCents: shippingCents,
    currency: targetCurrency,
    qty:1
  }] : [];
    const enrichedCart = cart.map((item)=>{
      const product = productMap?.get(item.id);
      const unitCents = getUnitBasePrice(item);
      const baseCurrency = getUnitCurrency(item);
      return {
        ...item,
        description: item.description || product?.description || "",
        description_fr: item.description_fr || product?.description_fr || "",
        description_ko: item.description_ko || product?.description_ko || "",
        description_hi: item.description_hi || product?.description_hi || "",
        description_ta: item.description_ta || product?.description_ta || "",
        description_es: item.description_es || product?.description_es || "",
        priceCentsBase: unitCents,
        currencyBase: baseCurrency,
        priceCents: PPS.convertCents(unitCents, baseCurrency, targetCurrency),
        currency: targetCurrency
      };
    });
    const itemsWithTax = [...enrichedCart, ...taxLine, ...shippingLine];

    function resolveApiBase(){
      const raw = String(window.API_BASE_URL || window.PPS_API_BASE || PPS.API_BASE || "").trim();
      const trimmed = raw.replace(/\/+$/,"").replace(/\/api$/i,"");
      return trimmed || String(PPS.API_BASE || "").trim().replace(/\/+$/,"").replace(/\/api$/i,"");
    }

    async function postCreatePayment(){
      const base = resolveApiBase();
      const endpoints = [
        `${base}/api/create-payment`,
        `${base}/create-payment`,
        `${base}/pi/create-payment`
      ];
      const payload = JSON.stringify({ items: itemsWithTax, customer });
      let lastError = null;
      for(const url of endpoints){
        try{
          const res = await fetch(url, {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: payload
          });
          // If the route exists but fails (400/500), return it so we can show message.
          if(res.status !== 404) return { res, url };
        }catch(err){
          lastError = err;
        }
      }
      if(lastError) throw lastError;
      const error = new Error("Payment service not found.");
      error.code = "PPS_NOT_FOUND";
      throw error;
    }

    const { res, url: usedUrl } = await postCreatePayment();

    const data = await res.json().catch(()=> ({}));
    if(res.ok && data?.url){
      window.location.href = data.url;
    }else{
      const endpointMissing = res.status === 404 || res.status === 405;
      const fallback = endpointMissing
        ? `Payment service not found. Check \`frontend/config.js\` API_BASE_URL points to your backend. Tried: ${usedUrl || ""}`
        : (window.PPS_I18N?.t("checkout.status.square") || "Square not configured.");
      setStatus(msg, data?.message || fallback, "error");
    }
  }catch(err){
    setStatus(msg, window.PPS_I18N?.t("checkout.status.unreachable") || "Server unreachable. Please try again.", "error");
  }finally{
    setPending(payBtn, false);
    setPending(submitBtn, false);
  }
});

if(provinceSelect){
  provinceSelect.addEventListener("change", drawSummary);
}
if(postalInput){
  postalInput.addEventListener("input", drawSummary);
  postalInput.addEventListener("change", drawSummary);
}
