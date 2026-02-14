document.getElementById("y").textContent = new Date().getFullYear();
PPS.updateCartBadge();

let productMap = null;
let productsList = [];

const goCheckout = document.getElementById("goCheckout");
const GO_CHECKOUT_DEFAULT = goCheckout ? {
  href: goCheckout.getAttribute("href") || "./checkout.html",
  i18n: goCheckout.getAttribute("data-i18n") || "cart.checkout",
  text: (goCheckout.textContent || "").trim()
} : null;

function setCheckoutCtaState(isEmpty){
  if(!goCheckout) return;
  if(isEmpty){
    goCheckout.dataset.checkoutEmpty = "1";
    goCheckout.dataset.i18n = "cart.empty.checkout_cta";
    goCheckout.setAttribute("href", "./products.html");
    goCheckout.textContent = window.PPS_I18N?.t("cart.empty.checkout_cta") || "Browse products";
    return;
  }
  delete goCheckout.dataset.checkoutEmpty;
  goCheckout.dataset.i18n = GO_CHECKOUT_DEFAULT?.i18n || "cart.checkout";
  goCheckout.setAttribute("href", GO_CHECKOUT_DEFAULT?.href || "./checkout.html");
  goCheckout.textContent = window.PPS_I18N?.t(GO_CHECKOUT_DEFAULT?.i18n || "cart.checkout") || GO_CHECKOUT_DEFAULT?.text || "Go to checkout";
}

const productsPromise = PPS.loadProducts().then((products)=>{
  productsList = Array.isArray(products) ? products : [];
  productMap = new Map(productsList.map(p=>[p.id, p]));
});

function addBusinessDays(date, days){
  const d = new Date(date.getTime());
  let left = Math.max(0, Number(days) || 0);
  while(left > 0){
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if(day !== 0 && day !== 6){
      left -= 1;
    }
  }
  return d;
}

function formatShortDate(d){
  try{
    return new Intl.DateTimeFormat(undefined, { month:"short", day:"numeric" }).format(d);
  }catch(_err){
    return d.toDateString();
  }
}

function getLastOrderKey(){
  const session = PPS.getSession?.();
  const email = String(session?.email || "").trim().toLowerCase();
  return email ? `pps_last_order_${email}` : "pps_last_order_guest";
}

function readLastOrder(){
  try{
    const raw = localStorage.getItem(getLastOrderKey());
    const parsed = JSON.parse(raw || "null");
    if(!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  }catch(_err){
    return null;
  }
}

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
  const estimateEl = document.getElementById("cartEstimate");
  const bulkSavingsRow = document.getElementById("bulkSavingsRow");
  const bulkSavingsAmount = document.getElementById("bulkSavingsAmount");
  const reorderBtn = document.getElementById("reorderBtn");
  const crossSellGrid = document.getElementById("crossSellGrid");
  const heroIllustration = document.querySelector(".cart-hero-illustration");
  const boxWrap = document.getElementById("cartLoadBoxes");

  function setHeroState(state){
    if(!heroIllustration) return;
    heroIllustration.setAttribute("data-cart-state", state);
    if(state === "empty" && boxWrap){
      boxWrap.innerHTML = "";
    }
  }

  function renderLoadBoxes(){
    if(!heroIllustration || !boxWrap) return;
    const totalQty = Array.isArray(cart)
      ? cart.reduce((sum, item)=> sum + (Number(item?.qty) || 0), 0)
      : 0;
    if(totalQty <= 0){
      setHeroState("empty");
      return;
    }
    setHeroState("filled");

    const count = Math.min(7, Math.max(2, Math.ceil(totalQty / 3)));
    boxWrap.innerHTML = Array.from({ length: count }).map((_, i)=>{
      const delay = (i * 0.32).toFixed(2);
      const left = 10 + (i % 3) * 6;
      const bottom = 22 + (i % 2) * 5;
      const w = 15 + (i % 2) * 2;
      const h = 11 + ((i + 1) % 2) * 2;
      return `<span class="cart-load-box" style="--d:${delay}s; left:${left}px; bottom:${bottom}px; width:${w}px; height:${h}px;"></span>`;
    }).join("");
  }

  // Always keep hero animation in sync with cart state.
  renderLoadBoxes();

  if(cart.length === 0){
    setCheckoutCtaState(true);
    const emptyMsg = window.PPS_I18N?.t("cart.empty") || "Your cart is empty.";
    const emptyTitle = window.PPS_I18N?.t("cart.empty.title") || emptyMsg;
    const emptyBody = window.PPS_I18N?.t("cart.empty.body") || "Browse products and build your next bulk order in minutes.";
    const emptyCta = window.PPS_I18N?.t("cart.empty.cta") || "Browse products";

    list.innerHTML = `
      <div class="card cart-empty fade-in">
        <div class="cart-empty-visual" aria-hidden="true">
          <svg class="cart-empty-cart" viewBox="0 0 260 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="ppsCartEmptyStroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="rgba(17,24,39,.22)"/>
                <stop offset="1" stop-color="rgba(17,24,39,.12)"/>
              </linearGradient>
              <linearGradient id="ppsCartEmptyAccent" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#ff7a1a"/>
                <stop offset="1" stop-color="#d94a1f"/>
              </linearGradient>
            </defs>

            <path d="M40 142c26 10 154 10 180 0" fill="none" stroke="rgba(17,24,39,.08)" stroke-width="12" stroke-linecap="round"/>
            <g class="thank-road" opacity=".9">
              <path d="M16 146H244" stroke="rgba(17,24,39,.10)" stroke-width="10" stroke-linecap="round"/>
              <g class="thank-road-track">
                <path d="M18 146h44" stroke="rgba(255,255,255,.70)" stroke-width="4" stroke-linecap="round"/>
                <path d="M74 146h44" stroke="rgba(255,255,255,.70)" stroke-width="4" stroke-linecap="round"/>
                <path d="M130 146h44" stroke="rgba(255,255,255,.70)" stroke-width="4" stroke-linecap="round"/>
                <path d="M186 146h44" stroke="rgba(255,255,255,.70)" stroke-width="4" stroke-linecap="round"/>
                <g transform="translate(260 0)">
                  <path d="M18 146h44" stroke="rgba(255,255,255,.70)" stroke-width="4" stroke-linecap="round"/>
                  <path d="M74 146h44" stroke="rgba(255,255,255,.70)" stroke-width="4" stroke-linecap="round"/>
                  <path d="M130 146h44" stroke="rgba(255,255,255,.70)" stroke-width="4" stroke-linecap="round"/>
                  <path d="M186 146h44" stroke="rgba(255,255,255,.70)" stroke-width="4" stroke-linecap="round"/>
                </g>
              </g>
            </g>

            <g class="thank-cart-float">
              <path d="M46 40h26" stroke="rgba(17,24,39,.26)" stroke-width="10" stroke-linecap="round"/>
              <path d="M62 40l10 60" stroke="rgba(17,24,39,.18)" stroke-width="8" stroke-linecap="round"/>

              <path d="M78 58h118l-10 48H92L78 58Z" fill="rgba(255,255,255,.78)" stroke="url(#ppsCartEmptyStroke)" stroke-width="3" />
              <path d="M86 64h100" stroke="rgba(17,24,39,.10)" stroke-width="3" stroke-linecap="round"/>
              <path d="M94 76h82" stroke="rgba(17,24,39,.08)" stroke-width="3" stroke-linecap="round"/>
              <path d="M102 90h64" stroke="rgba(17,24,39,.08)" stroke-width="3" stroke-linecap="round"/>

              <path d="M86 106h94" stroke="url(#ppsCartEmptyAccent)" stroke-width="8" stroke-linecap="round" opacity=".92"/>

              <g class="thank-wheel" transform="translate(106 132)">
                <g class="thank-wheel-spin">
                  <circle r="14" fill="#111827" opacity=".88"/>
                  <circle r="7" fill="rgba(255,255,255,.92)"/>
                  <path d="M0-10V10M-10 0H10M-7-7l14 14M-7 7l14-14" stroke="rgba(17,24,39,.35)" stroke-width="2" stroke-linecap="round"/>
                </g>
              </g>
              <g class="thank-wheel" transform="translate(176 132)">
                <g class="thank-wheel-spin">
                  <circle r="14" fill="#111827" opacity=".88"/>
                  <circle r="7" fill="rgba(255,255,255,.92)"/>
                  <path d="M0-10V10M-10 0H10M-7-7l14 14M-7 7l14-14" stroke="rgba(17,24,39,.35)" stroke-width="2" stroke-linecap="round"/>
                </g>
              </g>
            </g>
          </svg>
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
    if(estimateEl) estimateEl.textContent = "--";
    if(bulkSavingsRow) bulkSavingsRow.style.display = "none";
    if(reorderBtn) reorderBtn.style.display = "none";
    if(crossSellGrid) crossSellGrid.innerHTML = "";
    return;
  }

  setCheckoutCtaState(false);
  const targetCurrency = PPS.getCurrency();
  let bulkSavingsCents = 0;
  const total = cart.reduce((sum,i)=>{
    const product = productMap?.get(i.id);
    const baseUnitCents = product ? Number(product.priceCents || 0) : (i.priceCentsBase ?? i.priceCents);
    const unitCents = product ? PPS.getTieredPriceCents(product, i.qty) : baseUnitCents;
    if(product && baseUnitCents > unitCents){
      bulkSavingsCents += (baseUnitCents - unitCents) * i.qty;
    }
    const baseCents = unitCents * i.qty;
    const baseCurrency = product?.currency || i.currencyBase || i.currency || "CAD";
    return sum + PPS.convertCents(baseCents, baseCurrency, targetCurrency);
  }, 0);
  totalEl.textContent = PPS.money(total, targetCurrency, targetCurrency);
  if(bulkSavingsRow && bulkSavingsAmount){
    if(bulkSavingsCents > 0){
      bulkSavingsRow.style.display = "";
      bulkSavingsAmount.textContent = `- ${PPS.money(bulkSavingsCents, "CAD", targetCurrency)}`;
    }else{
      bulkSavingsRow.style.display = "none";
    }
  }
  if(estimateEl){
    const start = addBusinessDays(new Date(), 2);
    const end = addBusinessDays(new Date(), 5);
    estimateEl.textContent = `${formatShortDate(start)} - ${formatShortDate(end)}`;
  }

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
    const stockWarning = product && Number(product.stock) > 0 && Number(product.stock) <= 5
      ? `<div class="cart-stock-warning">Only ${product.stock} left - order soon.</div>`
      : "";
    const descHtml = desc
      ? `<div style="color:var(--muted); font-size:13px; margin-top:4px;">${desc}</div>`
      : "";
    const saveLabel = window.PPS_I18N?.t("cart.save") || "Save for later";
    const removeLabel = window.PPS_I18N?.t("cart.remove") || "Remove";
    return `
    <div class="card cart-item fade-in" data-cart-item-id="${String(i.id || "")}">
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
          ${stockWarning}
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

  if(crossSellGrid && productsList.length){
    const cartCats = new Set(cart.map(item=> productMap?.get(item.id)?.category).filter(Boolean));
    const picks = productsList
      .filter(p=> !cart.some(i=>i.id===p.id))
      .filter(p=> cartCats.size ? cartCats.has(p.category) : true)
      .slice(0, 4);
    crossSellGrid.innerHTML = picks.length
      ? picks.map(item=>`
        <div class="card">
          <a href="./product.html?slug=${encodeURIComponent(item.slug)}">
            <img src="${item.image}" alt="${item.name}" loading="lazy" decoding="async" width="320" height="170">
          </a>
          <div class="card-body">
            <a class="card-title" style="text-decoration:none; display:inline-block;" href="./product.html?slug=${encodeURIComponent(item.slug)}">${item.name}</a>
            <div class="member-pricing">
              <div>
                <div class="market-label">Market price</div>
                <span class="compare-price">${PPS.money((Number(item.priceCents) || 0) + 1000, item.currency)}</span>
              </div>
              <div>
                <div class="member-label">Power Poly Member Price</div>
                <span class="price">${PPS.money(Number(item.priceCents) || 0, item.currency)}</span>
              </div>
            </div>
            <div style="margin-top:10px;">
              <button class="btn btn-primary btn-sm" type="button" onclick="addCrossSell('${item.id}')">Add</button>
            </div>
          </div>
        </div>
      `).join("")
      : `<div style="color:var(--muted); font-size:13px;">No cross-sell picks yet.</div>`;
  }

  if(reorderBtn){
    const lastOrder = readLastOrder();
    const session = PPS.getSession?.();
    if(session && lastOrder?.items?.length){
      reorderBtn.style.display = "";
      reorderBtn.onclick = ()=>{
        PPS.setCart(lastOrder.items);
        render();
      };
    }else{
      reorderBtn.style.display = "none";
    }
  }
}

function cssEscape(value){
  try{
    if(window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
  }catch(_err){}
  return String(value).replace(/["\\]/g, "\\$&");
}

function pulseCartItem(id){
  const safe = cssEscape(id);
  const el = document.querySelector(`[data-cart-item-id="${safe}"]`);
  if(!el) return;
  el.classList.remove("cart-item-updated");
  void el.offsetWidth; // restart animation
  el.classList.add("cart-item-updated");
  setTimeout(()=> el.classList.remove("cart-item-updated"), 520);
}

function removeCartItemWithAnim(id, commit){
  const safe = cssEscape(id);
  const el = document.querySelector(`[data-cart-item-id="${safe}"]`);
  if(!el){
    commit();
    return;
  }
  el.classList.add("cart-item-removing");
  setTimeout(commit, 200);
}

window.inc = (id)=>{
  const cart = PPS.getCart();
  const item = cart.find(x=>x.id===id);
  if(!item) return;
  item.qty += 1;
  PPS.setCart(cart);
  render();
  pulseCartItem(id);
};

window.dec = (id)=>{
  const cart = PPS.getCart();
  const item = cart.find(x=>x.id===id);
  if(!item) return;
  const nextQty = (Number(item.qty) || 1) - 1;
  if(nextQty <= 0){
    removeCartItemWithAnim(id, ()=>{
      const next = cart.filter(x=>x.id!==id);
      PPS.setCart(next);
      render();
    });
    return;
  }
  item.qty = nextQty;
  PPS.setCart(cart);
  render();
  pulseCartItem(id);
};

window.removeItem = (id)=>{
  removeCartItemWithAnim(id, ()=>{
    const next = PPS.getCart().filter(x=>x.id!==id);
    PPS.setCart(next);
    render();
  });
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

window.addCrossSell = (id)=>{
  const product = productMap?.get(id);
  if(!product) return;
  PPS.addToCart(product, 1);
  render();
};

render();
productsPromise.then(()=> render());

if(goCheckout){
  goCheckout.addEventListener("click", (event)=>{
    try{
      const cart = PPS.getCart();
      if(!Array.isArray(cart) || cart.length === 0){
        event.preventDefault();
        const msg = window.PPS_I18N?.t("cart.empty.checkout_notice") || "Your cart is empty. Add products before checking out.";
        try{ window.alert(msg); }catch(_err){}
        window.location.href = "./products.html";
        return;
      }
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
