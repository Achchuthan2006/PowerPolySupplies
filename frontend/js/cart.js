document.getElementById("y").textContent = new Date().getFullYear();
PPS.updateCartBadge();

let productMap = null;
const productsPromise = PPS.loadProducts().then((products)=>{
  productMap = new Map(products.map(p=>[p.id, p]));
});

function getItemDescription(item){
  const lang = window.PPS_I18N?.getLang?.() || "en";
  const stored = lang === "fr"
    ? (item.description_fr || item.description || "")
    : lang === "ko"
      ? (item.description_ko || item.description || "")
      : lang === "hi"
        ? (item.description_hi || item.description || "")
        : lang === "ta"
          ? (item.description_ta || item.description || "")
          : lang === "es"
            ? (window.PPS_I18N?.autoTranslate?.(item.description_es || item.description || "", "es") || (item.description_es || item.description || ""))
            : (item.description || item.description_fr || item.description_ko || item.description_hi || item.description_ta || item.description_es || "");
  if(stored) return stored;
  if(!productMap) return "";
  const product = productMap.get(item.id);
  if(!product) return "";
  return lang === "fr"
    ? (product.description_fr || product.description || "")
    : lang === "ko"
      ? (product.description_ko || product.description || "")
      : lang === "hi"
        ? (product.description_hi || product.description || "")
        : lang === "ta"
          ? (product.description_ta || product.description || "")
          : lang === "es"
            ? (window.PPS_I18N?.autoTranslate?.(product.description_es || product.description || "", "es") || (product.description_es || product.description || ""))
            : (product.description || product.description_fr || product.description_ko || product.description_hi || product.description_ta || product.description_es || "");
}

function render(){
  const cart = PPS.getCart();
  const list = document.getElementById("cartList");
  const totalEl = document.getElementById("total");

  if(cart.length === 0){
    const emptyMsg = window.PPS_I18N?.t("cart.empty") || "Your cart is empty.";
    list.innerHTML = `<div class="card" style="padding:16px;">${emptyMsg}</div>`;
    totalEl.textContent = PPS.money(0);
    return;
  }

  const targetCurrency = PPS.getCurrency();
  const total = cart.reduce((sum,i)=>{
    const product = productMap?.get(i.id);
    const unitCents = product ? PPS.getTieredPriceCents(product, i.qty) : (i.priceCentsBase ?? i.priceCents);
    const baseCents = unitCents * i.qty;
    const baseCurrency = product?.currency || i.currencyBase || i.currency || "CAD";
    return sum + PPS.convertCents(baseCents, baseCurrency, targetCurrency);
  }, 0);
  totalEl.textContent = PPS.money(total, targetCurrency, targetCurrency);

  list.innerHTML = cart.map(i=>{
    const lang = window.PPS_I18N?.getLang?.() || "en";
    const displayName = lang === "es"
      ? (window.PPS_I18N?.autoTranslate?.(i.name || "", "es") || i.name)
      : i.name;
    const desc = getItemDescription(i);
    const product = productMap?.get(i.id);
    const unitCents = product ? PPS.getTieredPriceCents(product, i.qty) : (i.priceCentsBase ?? i.priceCents);
    const baseCurrency = product?.currency || i.currencyBase || i.currency || "CAD";
    const descHtml = desc
      ? `<div style="color:var(--muted); font-size:13px; margin-top:4px;">${desc}</div>`
      : "";
    return `
    <div class="card fade-in" style="padding:14px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <div>
        <div style="font-weight:800;">${displayName}</div>
        <div style="color:var(--muted); font-size:13px;">${PPS.money(unitCents, baseCurrency)}</div>
        ${descHtml}
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn" onclick="dec('${i.id}')">-</button>
        <div style="min-width:30px; text-align:center; font-weight:800;">${i.qty}</div>
        <button class="btn" onclick="inc('${i.id}')">+</button>
        <button class="btn btn-outline" onclick="removeItem('${i.id}')">${window.PPS_I18N?.t("cart.remove") || "Remove"}</button>
      </div>
    </div>
  `}).join("");

  // trigger fade-in
  document.querySelectorAll(".fade-in").forEach(el => el.classList.add("show"));
}

window.inc = (id)=>{
  const cart = PPS.getCart();
  const item = cart.find(x=>x.id===id);
  if(!item) return;
  item.qty += 1;
  PPS.setCart(cart);
  render();
};

window.dec = (id)=>{
  const cart = PPS.getCart();
  const item = cart.find(x=>x.id===id);
  if(!item) return;
  item.qty -= 1;
  const next = cart.filter(x=>x.qty>0);
  PPS.setCart(next);
  render();
};

window.removeItem = (id)=>{
  const next = PPS.getCart().filter(x=>x.id!==id);
  PPS.setCart(next);
  render();
};

render();
productsPromise.then(()=> render());

const goCheckout = document.getElementById("goCheckout");
if(goCheckout){
  goCheckout.addEventListener("click", (event)=>{
    try{
      const cart = PPS.getCart();
      if(!Array.isArray(cart) || cart.length === 0) return;
      const minimal = cart
        .filter(item => item && item.id && Number(item.qty) > 0)
        .map(item => [String(item.id), Math.max(1, Number(item.qty) || 1)]);
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(minimal))));
      const url = new URL(goCheckout.href, window.location.href);
      url.searchParams.set("cart", encoded);
      event.preventDefault();
      window.location.href = url.toString();
    }catch(err){
      // If anything fails, fall back to normal navigation.
    }
  });
}
