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
    const emptyTitle = window.PPS_I18N?.t("cart.empty.title") || emptyMsg;
    const emptyBody = window.PPS_I18N?.t("cart.empty.body") || "Browse products and build your next bulk order in minutes.";
    const emptyCta = window.PPS_I18N?.t("cart.empty.cta") || "Browse products";

    list.innerHTML = `
      <div class="card cart-empty fade-in">
        <div class="cart-empty-visual" aria-hidden="true">
          <img src="./assets/order-checkout.svg" alt="" loading="lazy" decoding="async">
        </div>
        <div class="cart-empty-body">
          <div class="cart-empty-title">${emptyTitle}</div>
          <div class="cart-empty-desc">${emptyBody}</div>
          <div class="cart-empty-actions">
            <a class="btn btn-primary" href="./products.html">${emptyCta}</a>
            <a class="btn btn-outline" href="./resources.html">${window.PPS_I18N?.t("nav.resources") || "Resources"}</a>
          </div>
        </div>
      </div>
    `;
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
    const image = product?.image || i.image || "./assets/poly%20logo%20without%20background.png";
    const unitCents = product ? PPS.getTieredPriceCents(product, i.qty) : (i.priceCentsBase ?? i.priceCents);
    const baseCurrency = product?.currency || i.currencyBase || i.currency || "CAD";
    const lineCents = unitCents * i.qty;
    const lineTotal = PPS.money(PPS.convertCents(lineCents, baseCurrency, targetCurrency), targetCurrency, targetCurrency);
    const descHtml = desc
      ? `<div style="color:var(--muted); font-size:13px; margin-top:4px;">${desc}</div>`
      : "";
    const saveLabel = window.PPS_I18N?.t("cart.save") || "Save for later";
    const removeLabel = window.PPS_I18N?.t("cart.remove") || "Remove";
    return `
    <div class="card cart-item fade-in">
      <div class="cart-item-main">
        <div class="cart-item-thumb" aria-hidden="true">
          <img src="${image}" alt="" loading="lazy" decoding="async">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-title">${displayName || ""}</div>
          <div class="cart-item-prices">
            <span class="cart-item-unit">${PPS.money(unitCents, baseCurrency)}</span>
            <span class="cart-item-sep">·</span>
            <span class="cart-item-line">${lineTotal}</span>
          </div>
          ${descHtml}
        </div>
      </div>

      <div class="cart-item-actions">
        <div class="cart-qty" role="group" aria-label="Quantity">
          <button class="btn btn-sm cart-qty-btn" type="button" onclick="dec('${i.id}')" aria-label="Decrease quantity">−</button>
          <div class="cart-qty-value" aria-label="Quantity">${i.qty}</div>
          <button class="btn btn-sm cart-qty-btn" type="button" onclick="inc('${i.id}')" aria-label="Increase quantity">+</button>
        </div>
        <div class="cart-item-links">
          <button class="btn btn-outline btn-sm" type="button" onclick="saveForLater('${i.id}')">${saveLabel}</button>
          <button class="btn btn-outline btn-sm" type="button" onclick="removeItem('${i.id}')">${removeLabel}</button>
        </div>
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

window.saveForLater = (id)=>{
  const session = PPS.getSession?.();
  if(!session){
    window.location.href = "./login.html";
    return;
  }
  PPS.addToWishlist?.(id);
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
      const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(minimal))));
      const encoded = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      const url = new URL(goCheckout.href, window.location.href);
      url.searchParams.set("cart", encoded);
      event.preventDefault();
      window.location.href = url.toString();
    }catch(err){
      // If anything fails, fall back to normal navigation.
    }
  });
}
