function setupNavbar(){
  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");
  const dropdowns = Array.from(document.querySelectorAll(".dropdown"));

  if(menuBtn && navLinks){
    menuBtn.addEventListener("click", ()=>{
      navLinks.classList.toggle("open");
    });
  }
  if(navLinks){
    navLinks.addEventListener("click", (event)=>{
      const link = event.target.closest("a");
      if(link && navLinks.classList.contains("open")){
        navLinks.classList.remove("open");
      }
    });
  }

  if(menuBtn && navLinks){
    document.addEventListener("click", (event)=>{
      if(!navLinks.classList.contains("open")) return;
      const target = event.target;
      if(!(target instanceof Node)) return;
      if(navLinks.contains(target) || menuBtn.contains(target)) return;
      navLinks.classList.remove("open");
      dropdowns.forEach(d=> d.classList.remove("open"));
    });
  }

  // Mobile dropdown toggle (supports multiple dropdowns)
  dropdowns.forEach((dropdown)=>{
    const dropBtn = dropdown.querySelector(".dropbtn");
    if(!dropBtn) return;
    dropBtn.addEventListener("click", (event)=>{
      // If the dropdown trigger is a link (ex: About Us), let clicking the label navigate.
      // Only toggle when clicking the caret.
      const isLink = String(dropBtn?.tagName || "").toUpperCase() === "A" && !!dropBtn.getAttribute("href");
      const caretClicked = !!event.target?.closest?.(".caret-toggle");
      if(isLink && !caretClicked) return;
      event.preventDefault();
      dropdown.classList.toggle("open");
    });
  });
}

function decoratePromoTagline(){
  const el = document.querySelector(".promo-strip [data-i18n='brand.tagline']");
  if(!el) return;
  if(el.parentElement?.querySelector?.(".promo-bolt")) return;
  const bolt = document.createElement("span");
  bolt.className = "promo-bolt";
  bolt.setAttribute("aria-hidden", "true");
  bolt.textContent = " ⚡";
  el.insertAdjacentElement("afterend", bolt);
}

function setupFadeIn(){
  const els = document.querySelectorAll(".fade-in");
  if(!els.length) return;
  if(typeof IntersectionObserver === "undefined"){
    els.forEach(el=>{
      el.classList.add("show");
      el.removeAttribute("data-fade");
    });
    return;
  }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting) e.target.classList.add("show");
    });
  }, { threshold: 0.12 });

  const vh = Math.max(1, window.innerHeight || 1);
  els.forEach(el=>{
    const rect = el.getBoundingClientRect();
    const inInitialView = rect.top < vh * 0.95;
    if(inInitialView){
      el.classList.add("show");
      el.removeAttribute("data-fade");
      return;
    }
    el.setAttribute("data-fade", "1");
    io.observe(el);
  });
}

function setupStickyHeader(){
  const header = document.querySelector(".site-header");
  if(!header) return;
  let ticking = false;
  const onScroll = ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      header.classList.toggle("scrolled", window.scrollY > 8);
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll();
}

function syncAccountLink(){
  const accountLink = document.querySelector('a[href="./login.html"]');
  if(!accountLink || !window.PPS?.getSession) return;
  const session = window.PPS.getSession();
  if(!session) return;
  accountLink.href = "./account.html";
  const icon = accountLink.querySelector(".nav-icon");
  const label = accountLink.querySelector("span:not(.nav-icon)");
  const firstName = String(session.name || "").trim().split(/\s+/)[0] || "";
  const greeting = window.PPS_I18N?.t("nav.greeting") || "Hi, {{name}}";
  const accountText = firstName
    ? greeting.replace("{{name}}", firstName)
    : (window.PPS_I18N?.t("nav.my_account") || "My Account");
  if(label){
    label.textContent = accountText;
  }else if(icon && icon.nextSibling){
    icon.nextSibling.nodeValue = accountText;
  }else{
    accountLink.textContent = accountText;
  }
}

function getNavTools(navLinks){
  let tools = navLinks.querySelector('.nav-tools');
  if(!tools){
    tools = document.createElement('div');
    tools.className = 'nav-tools';
    navLinks.appendChild(tools);
  }
  return tools;
}

function injectLangSwitcher(){
  const navLinks = document.getElementById("navLinks");
  if(!navLinks) return;
  if(navLinks.querySelector(".lang-switcher")) return;

  const tools = getNavTools(navLinks);
  const langOptions = (document.documentElement?.dataset?.langOptions || "en,fr,es,ko,hi,ta,zh")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const langLabels = {
    en: "English",
    fr: "French",
    es: "Spanish",
    ko: "Korean",
    hi: "Hindi",
    ta: "Tamil",
    zh: "Mandarin"
  };
  const wrap = document.createElement("div");
  wrap.className = "lang-switcher";
  wrap.innerHTML = `
    <select id="langSelect" class="lang-select" aria-label="Language">
      ${langOptions.map(code => `<option value="${code}">${langLabels[code] || code}</option>`).join("")}
    </select>
  `;
  tools.appendChild(wrap);

  const select = wrap.querySelector("#langSelect");
  if(select){
    const current = window.PPS_I18N?.getLang?.() || "en";
    select.value = current;
    select.addEventListener("change", (event)=>{
      window.PPS_I18N?.setLang?.(event.target.value);
    });
  }
}

function shouldPromptForLanguage(){
  try{
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if(urlLang) return false;
  }catch(err){
    // ignore
  }
  try{
    if(localStorage.getItem("pps_lang")) return false;
    if(localStorage.getItem("pps_lang_prompt_dismissed")) return false;
  }catch(err){
    // ignore
  }
  // Cookie is set when a language has been chosen.
  if(document.cookie && document.cookie.includes("pps_lang=")) return false;
  return true;
}

function showLanguageModal(){
  const existing = document.getElementById("ppsLangModal");
  if(existing) return;

  const overlay = document.createElement("div");
  overlay.className = "pps-modal-overlay";
  overlay.id = "ppsLangModal";
  overlay.innerHTML = `
    <div class="pps-modal" role="dialog" aria-modal="true" aria-labelledby="ppsLangTitle">
      <div class="pps-modal-header">
        <div>
          <h2 class="pps-modal-title" id="ppsLangTitle">${window.PPS_I18N?.t("lang.prompt.title") || "Choose your language"}</h2>
          <p class="pps-modal-subtitle">${window.PPS_I18N?.t("lang.prompt.subtitle") || "Select the language that’s easiest for you. You can change it anytime from the top menu."}</p>
        </div>
        <button class="pps-modal-close" type="button" aria-label="${window.PPS_I18N?.t("lang.prompt.close") || "Close"}">×</button>
      </div>
      <div class="pps-modal-body">
        <div class="pps-modal-row">
          <select class="input" id="ppsLangModalSelect" aria-label="${window.PPS_I18N?.t("lang.label") || "Language"}" style="flex:1; min-width:220px;">
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="ko">Korean</option>
            <option value="hi">Hindi</option>
            <option value="ta">Tamil</option>
            <option value="zh">Mandarin</option>
          </select>
        </div>
        <div class="pps-modal-actions">
          <button class="btn btn-outline" type="button" id="ppsLangModalLater">${window.PPS_I18N?.t("lang.prompt.later") || "Not now"}</button>
          <button class="btn btn-primary" type="button" id="ppsLangModalContinue">${window.PPS_I18N?.t("lang.prompt.continue") || "Continue"}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = ()=>{
    try{ localStorage.setItem("pps_lang_prompt_dismissed", "1"); }catch(err){}
    overlay.classList.remove("open");
    setTimeout(()=> overlay.remove(), 180);
  };

  const modal = overlay.querySelector(".pps-modal");
  const closeBtn = overlay.querySelector(".pps-modal-close");
  const laterBtn = overlay.querySelector("#ppsLangModalLater");
  const continueBtn = overlay.querySelector("#ppsLangModalContinue");
  const select = overlay.querySelector("#ppsLangModalSelect");

  const current = window.PPS_I18N?.getLang?.() || "en";
  if(select) select.value = current;

  overlay.addEventListener("click", (e)=>{
    if(!(e.target instanceof Node)) return;
    if(modal && modal.contains(e.target)) return;
    close();
  });
  closeBtn?.addEventListener("click", close);
  laterBtn?.addEventListener("click", close);
  continueBtn?.addEventListener("click", ()=>{
    const raw = String(select?.value || "").trim().toLowerCase();
    const allowed = new Set(["en", "fr", "es", "ko", "hi", "ta", "zh"]);
    const lang = allowed.has(raw) ? raw : "en";
    try{ localStorage.setItem("pps_lang_prompt_dismissed", "1"); }catch(err){}
    try{
      if(window.PPS_I18N?.setLang){
        window.PPS_I18N.setLang(lang);
      }else{
        try{ localStorage.setItem("pps_lang", lang); }catch(_err){}
        try{ document.cookie = `pps_lang=${encodeURIComponent(lang)}; max-age=${60*60*24*365}; path=/; samesite=lax`; }catch(_err){}
        try{
          const url = new URL(window.location.href);
          url.searchParams.set("lang", lang);
          window.history.replaceState({}, "", url.toString());
        }catch(_err){}
        document.documentElement.lang = lang;
      }
    }catch(err){
      /* ignore */
    }
    close();
  });

  // basic focus
  overlay.classList.add("open");
  setTimeout(()=> select?.focus?.(), 50);
};

function scheduleLanguagePrompt(){
  if(!shouldPromptForLanguage()) return;
  // Give the page a second to render so it feels smooth.
  setTimeout(()=>{
    if(!shouldPromptForLanguage()) return;
    showLanguageModal();
  }, 2500);
}

function injectCurrencySwitcher(){
  const navLinks = document.getElementById("navLinks");
  if(!navLinks || !window.PPS?.getCurrency) return;
  if(navLinks.querySelector(".currency-switcher")) return;

  const tools = getNavTools(navLinks);
  const wrap = document.createElement("div");
  wrap.className = "currency-switcher";
  wrap.innerHTML = `
    <span class="currency-symbol" aria-hidden="true">$</span>
    <select id="currencySelect" class="currency-select" aria-label="Currency">
      <option value="CAD">CAD</option>
      <option value="USD">USD</option>
    </select>
  `;
  tools.appendChild(wrap);

  const select = wrap.querySelector("#currencySelect");
  if(select){
    select.value = window.PPS.getCurrency();
    select.addEventListener("change", (event)=>{
      window.PPS.setCurrency(event.target.value);
    });
  }
}

function injectResourcesDropdown(){
  const navLinks = document.getElementById("navLinks");
  if(!navLinks) return;
  if(navLinks.querySelector(".dropdown.resources-dropdown")) return;

  // Remove older standalone links / dropdowns if present (keeps the top nav clean).
  navLinks.querySelector(".dropdown.industry-dropdown")?.remove?.();
  navLinks.querySelector('a[href="./industries.html"]')?.remove?.();
  navLinks.querySelector('a[href="./industry-commercial-laundry.html"]')?.remove?.();
  navLinks.querySelector('a[href="./industry-healthcare.html"]')?.remove?.();
  navLinks.querySelector('a[href="./blog.html"]')?.remove?.();

  const resourcesLink = navLinks.querySelector('a[href="./resources.html"]');

  const wrap = document.createElement("div");
  wrap.className = "dropdown resources-dropdown";
  wrap.innerHTML = `
    <a class="dropbtn" href="./resources.html"><span data-i18n="nav.resources">Resources</span> <span class="caret caret-toggle" aria-hidden="true"></span></a>
    <div class="dropdown-menu">
      <a href="./resources.html" data-i18n="nav.resources.guides">Guides</a>
      <a href="./industries.html" data-i18n="nav.industry.overview">Industries</a>
      <a href="./industry-commercial-laundry.html" data-i18n="nav.industry.laundry">Commercial laundry</a>
      <a href="./industry-healthcare.html" data-i18n="nav.industry.healthcare">Healthcare</a>
      <a href="./blog.html" data-i18n="nav.industry.blog">Blog</a>
    </div>
  `;

  if(resourcesLink && resourcesLink.parentElement === navLinks){
    resourcesLink.replaceWith(wrap);
  }else{
    const anchorAfter = navLinks.querySelector('a[href="./specials.html"]');
    if(anchorAfter && anchorAfter.parentElement === navLinks){
      anchorAfter.insertAdjacentElement("afterend", wrap);
    }else{
      navLinks.appendChild(wrap);
    }
  }

  try{ window.PPS_I18N?.applyTranslations?.(); }catch{}
}

function injectAboutDropdown(){
  const navLinks = document.getElementById("navLinks");
  if(!navLinks) return;
  if(navLinks.querySelector(".dropdown.about-dropdown")) return;

  const aboutLink = navLinks.querySelector('a[href="./about.html"]');
  if(!aboutLink) return;

  const wrap = document.createElement("div");
  wrap.className = "dropdown about-dropdown";
  wrap.innerHTML = `
    <a class="dropbtn" href="./about.html"><span data-i18n="nav.about">About Us</span> <span class="caret caret-toggle" aria-hidden="true"></span></a>
    <div class="dropdown-menu">
      <a href="./about.html" data-i18n="nav.about_overview">About Power Poly Supplies</a>
      <a href="./about.html#why" data-i18n="nav.about_why">Why Power Poly</a>
      <a href="./about.html#sectors" data-i18n="nav.about_sectors">Sectors we serve</a>
      <a href="./about.html#quality" data-i18n="nav.about_quality">Quality promise</a>
    </div>
  `;

  aboutLink.replaceWith(wrap);

  try{
    window.PPS_I18N?.applyTranslations?.();
  }catch{
    // ignore
  }
}

function getNotifUnreadCount(){
  try{
    const session = window.PPS?.getSession?.();
    const email = String(session?.email || "").trim().toLowerCase();
    if(!email) return 0;
    const key = `pps_account_${email}_notifications_v1`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    if(!Array.isArray(list)) return 0;
    return list.reduce((sum, n)=> sum + (!n?.readAt ? 1 : 0), 0);
  }catch(_err){
    return 0;
  }
}

// Run immediately on load when possible (ui.js is usually loaded at the end of <body>).
try{ decoratePromoTagline(); }catch{ /* ignore */ }

function updateNotifBadges(){
  const count = getNotifUnreadCount();
  document.querySelectorAll("[data-notif-badge]").forEach((el)=>{
    el.textContent = String(count);
    el.style.display = count ? "" : "none";
  });
}

function injectNotificationsBell(){
  const navLinks = document.getElementById("navLinks");
  if(!navLinks || !window.PPS?.getSession) return;
  if(navLinks.querySelector(".notif-bell")) return;
  const session = window.PPS.getSession();
  if(!session) return;

  const tools = getNavTools(navLinks);
  const link = document.createElement("a");
  link.className = "notif-bell";
  link.href = "./account.html#notifications";
  link.setAttribute("aria-label", "Notifications");
  link.innerHTML = `
    <span class="nav-icon bell-icon" aria-hidden="true"></span>
    <span class="badge" data-notif-badge style="display:none;">0</span>
  `;
  tools.appendChild(link);

  updateNotifBadges();
  window.addEventListener("storage", (e)=>{
    if(String(e?.key || "").includes("_notifications_v1")) updateNotifBadges();
  });
  window.addEventListener("pps:notifs", updateNotifBadges);
}

function injectMiniCartPreview(){
  const cartLink = document.querySelector('a[href="./cart.html"]');
  if(!cartLink || cartLink.dataset.miniCartReady) return;
  cartLink.dataset.miniCartReady = "1";
  cartLink.classList.add("mini-cart-anchor");

  const popover = document.createElement("div");
  popover.className = "mini-cart-popover";
  popover.innerHTML = `
    <div class="mini-cart-head">
      <strong>Cart preview</strong>
      <a href="./cart.html">View cart</a>
    </div>
    <div class="mini-cart-body" id="miniCartBody"></div>
  `;
  cartLink.appendChild(popover);

  let hideTimer = 0;
  const show = ()=>{
    clearTimeout(hideTimer);
    popover.classList.add("open");
    renderMiniCart();
  };
  const hide = ()=>{
    clearTimeout(hideTimer);
    hideTimer = setTimeout(()=> popover.classList.remove("open"), 140);
  };

  cartLink.addEventListener("mouseenter", show);
  cartLink.addEventListener("mouseleave", hide);
  popover.addEventListener("mouseenter", show);
  popover.addEventListener("mouseleave", hide);

  async function renderMiniCart(){
    const body = document.getElementById("miniCartBody");
    if(!body || !window.PPS?.loadProducts) return;
    const cart = PPS.getCart?.() || [];
    let products = [];
    try{
      products = await PPS.loadProducts();
    }catch(_err){
      products = [];
    }
    if(!cart.length){
      body.innerHTML = `<div class="mini-cart-empty">Your cart is empty.</div>`;
      return;
    }
    const items = cart.slice(0, 4).map(item=>{
      const product = products.find(p=>p.id === item.id);
      return {
        name: product?.name || item.name || "Item",
        image: product?.image || "./assets/poly%20logo%20without%20background.png",
        qty: item.qty
      };
    });
    body.innerHTML = `
      <div class="mini-cart-items">
        ${items.map(item=>`
          <div class="mini-cart-item">
            <img src="${item.image}" alt="">
            <div>
              <div class="mini-cart-name">${item.name}</div>
              <div class="mini-cart-qty">Qty: ${item.qty}</div>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="mini-cart-actions">
        <a class="btn btn-primary btn-sm" href="./checkout.html">Checkout</a>
        <a class="btn btn-outline btn-sm" href="./products.html">Continue shopping</a>
      </div>
    `;
  }

  window.addEventListener("pps:cart", renderMiniCart);
}

function injectCartSidebar(){
  if(document.getElementById("cartSidebar")) return;
  const sidebar = document.createElement("aside");
  sidebar.className = "cart-sidebar";
  sidebar.id = "cartSidebar";
  sidebar.innerHTML = `
    <div class="cart-sidebar-card">
      <div class="cart-sidebar-title">Saved for later</div>
      <div class="cart-sidebar-list" id="cartSidebarSaved"></div>
      <a class="btn btn-outline btn-sm" href="./account.html#wishlists">Manage saved items</a>
    </div>
  `;
  document.body.appendChild(sidebar);

  async function renderSaved(){
    const list = document.getElementById("cartSidebarSaved");
    if(!list || !window.PPS?.loadProducts) return;
    const session = PPS.getSession?.();
    if(!session){
      list.innerHTML = `<div class="cart-sidebar-empty">Sign in to see saved items.</div>`;
      return;
    }
    let products = [];
    try{
      products = await PPS.loadProducts();
    }catch(_err){
      products = [];
    }
    const wishlists = PPS.getWishlists?.();
    const ids = wishlists?.lists?.[0]?.items?.map(it=>it.productId) || [];
    const picks = ids.map(id=> products.find(p=>p.id === id)).filter(Boolean).slice(0, 3);
    if(!picks.length){
      list.innerHTML = `<div class="cart-sidebar-empty">Save items to build your list.</div>`;
      return;
    }
    list.innerHTML = picks.map(item=>`
      <a class="cart-sidebar-item" href="./product.html?slug=${encodeURIComponent(item.slug)}">
        <img src="${item.image}" alt="${item.name}" loading="lazy" decoding="async">
        <span>${item.name}</span>
      </a>
    `).join("");
  }

  renderSaved();
  window.addEventListener("pps:wishlists", renderSaved);
}

function injectFooter(){
  const footer = document.querySelector(".footer");
  if(!footer) return;
  const year = new Date().getFullYear();
  const newFooter = document.createElement("footer");
  newFooter.className = "footer dark-footer";
  newFooter.innerHTML = `
      <div class="footer-inner">
        <div class="footer-brand">
          <span data-i18n="brand.name">Power Poly Supplies</span>
          <span style="color:#ffb25c; font-size:12px;" data-i18n="brand.tagline">Power your packaging</span>
          <div class="footer-meta" data-i18n="footer.meta">Bulk-ready stock | Fast response | Canada-wide supply</div>
        </div>
        <div>
          <h4 data-i18n="footer.shop">Shop</h4>
          <ul>
            <li><a href="./products.html" data-i18n="footer.all_products">All products</a></li>
            <li><a href="./specials.html" data-i18n="footer.special_offers">Special offers</a></li>
            <li><a href="./about.html" data-i18n="footer.about">About us</a></li>
            <li><a href="./contact.html" data-i18n="footer.contact">Contact</a></li>
            <li><a href="./feedback.html" data-i18n="footer.feedback">Feedback</a></li>
          </ul>
        </div>
        <div class="footer-contact">
          <h4 data-i18n="footer.support">Support</h4>
          <div data-i18n="footer.help_line">Help line:</div>
          <div class="footer-contact-row">
            <span class="footer-inline-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6.6 2.9c.6-.6 1.6-.7 2.3-.2l3 2a1.8 1.8 0 0 1 .6 2.3l-1.1 2.2a1 1 0 0 0 .2 1.2l2.8 2.8a1 1 0 0 0 1.2.2l2.2-1.1a1.8 1.8 0 0 1 2.3.6l2 3a1.8 1.8 0 0 1-.2 2.3l-1.3 1.3c-.8.8-2 1.2-3.1 1-3.1-.5-6.2-2.2-9.1-5.1S2.3 9.7 1.8 6.6c-.2-1.1.2-2.3 1-3.1z"/></svg>
            </span>
            Angel <a href="tel:+16475238645">647-523-8645</a>
          </div>
          <div class="footer-contact-row">
            <span class="footer-inline-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6.6 2.9c.6-.6 1.6-.7 2.3-.2l3 2a1.8 1.8 0 0 1 .6 2.3l-1.1 2.2a1 1 0 0 0 .2 1.2l2.8 2.8a1 1 0 0 0 1.2.2l2.2-1.1a1.8 1.8 0 0 1 2.3.6l2 3a1.8 1.8 0 0 1-.2 2.3l-1.3 1.3c-.8.8-2 1.2-3.1 1-3.1-.5-6.2-2.2-9.1-5.1S2.3 9.7 1.8 6.6c-.2-1.1.2-2.3 1-3.1z"/></svg>
            </span>
            Andrew <a href="tel:+14374256638">437-425-6638</a>
          </div>
          <div class="footer-contact-row">
            <span class="footer-inline-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6.6 2.9c.6-.6 1.6-.7 2.3-.2l3 2a1.8 1.8 0 0 1 .6 2.3l-1.1 2.2a1 1 0 0 0 .2 1.2l2.8 2.8a1 1 0 0 0 1.2.2l2.2-1.1a1.8 1.8 0 0 1 2.3.6l2 3a1.8 1.8 0 0 1-.2 2.3l-1.3 1.3c-.8.8-2 1.2-3.1 1-3.1-.5-6.2-2.2-9.1-5.1S2.3 9.7 1.8 6.6c-.2-1.1.2-2.3 1-3.1z"/></svg>
            </span>
            Achchu <a href="tel:+16475704878">647-570-4878</a>
          </div>
          <div class="footer-contact-row">
            <span class="footer-inline-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 2.2V17h16V8.2l-7.6 4.53a1.5 1.5 0 0 1-1.54 0zM19.2 7H4.8l7.2 4.28z"/></svg>
            </span>
            <span data-i18n="footer.email">Email:</span> <a href="mailto:powerpolysupplies@gmail.com">powerpolysupplies@gmail.com</a>
          </div>
          <div class="footer-contact-row footer-address">
            <span class="footer-inline-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
            </span>
            <span data-i18n="footer.address">Address:</span> 15725 Weston Rd, Kettleby, ON L7B 0L4
          </div>
        </div>
        <div>
          <h4 data-i18n="footer.connect">Connect</h4>
          <div class="footer-social">
            <a class="footer-icon" aria-label="Instagram" href="https://www.instagram.com/powerpolysupplies/" title="Instagram" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-5 3.5A4.5 4.5 0 1 1 7.5 13 4.5 4.5 0 0 1 12 8.5zm0 2A2.5 2.5 0 1 0 14.5 13 2.5 2.5 0 0 0 12 10.5zm4.75-4.25a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/></svg>
            </a>
            <a class="footer-icon" aria-label="Facebook" href="#" title="Facebook">
              <svg viewBox="0 0 24 24"><path d="M13 10.5V8.75c0-.66.44-1 .98-1H15V5h-2c-2 0-3 1.4-3 3.1V10.5H8v2.5h2v6h3v-6h2.1l.4-2.5H13z"/></svg>
            </a>
            <a class="footer-icon" aria-label="Email" href="mailto:powerpolysupplies@gmail.com" title="Email">
              <svg viewBox="0 0 24 24"><path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 2.2V17h16V8.2l-7.6 4.53a1.5 1.5 0 0 1-1.54 0zM19.2 7H4.8l7.2 4.28z"/></svg>
            </a>
            <a class="footer-icon" aria-label="Threads" href="https://www.threads.com/@powerpolysupplies?xmt=AQF0fdKod0xz4ngLncLsvNOIzYM0YhviIUzqV5AnbhzgHkA" title="Threads" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24"><path d="M12.06 2c-5.05 0-9.06 4.01-9.06 9.06s4.01 9.06 9.06 9.06 9.06-4.01 9.06-9.06S17.11 2 12.06 2zm4.27 11.03c-.1-.04-.2-.08-.3-.12-.23 1.1-.72 1.89-1.47 2.35-.9.55-1.96.57-2.54.48-.88-.15-1.62-.7-1.99-1.47-.24-.51-.36-1.12-.36-1.82 0-.16.01-.33.03-.5.82.75 1.93 1.1 2.97.93 1.22-.2 2.2-1.15 2.43-2.38.28-1.41-.48-2.8-1.91-3.33-.82-.31-1.69-.32-2.64-.32h-.07c-.34 0-.69.01-1.05.01l-.13.01V6.6c.27-.02.55-.03.83-.04.35-.01.71-.02 1.06-.02 1.16 0 2.36.01 3.36.39 1.84.69 2.9 2.39 2.52 4.33-.06.32-.15.63-.26.94zm-2.39-2.11c-.12.6-.62 1.08-1.22 1.18-.63.11-1.3-.2-1.63-.76l-.2-.35-.05.4c-.08.63-.1 1.62.31 2.5.24.51.61.8 1.15.89.52.08 1.17 0 1.57-.25.49-.3.82-.93.94-1.78l.04-.26-.25-.1c-.21-.08-.42-.16-.63-.25l-.03-.01z"/></svg>
            </a>
            <a class="footer-icon" aria-label="WhatsApp" href="https://chat.whatsapp.com/LVaouedAZVIEcgrD6nj2hC" title="WhatsApp" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24"><path d="M12.04 2a9.94 9.94 0 0 0-8.52 15.05L2 22l5.1-1.33A9.95 9.95 0 1 0 12.04 2zm5.78 14.4c-.24.68-1.38 1.31-1.9 1.38-.5.07-1.14.1-1.84-.11-.42-.14-.95-.3-1.64-.6-2.9-1.26-4.78-4.16-4.92-4.36-.14-.2-1.18-1.57-1.18-3 0-1.43.75-2.13 1.01-2.42.25-.28.56-.35.74-.35h.53c.17 0 .4-.06.62.47.24.56.8 1.94.87 2.08.07.14.12.3.02.48-.1.18-.16.3-.31.46-.16.16-.33.35-.47.47-.16.16-.34.34-.15.65.2.31.9 1.47 1.93 2.38 1.33 1.17 2.44 1.53 2.8 1.7.36.17.57.14.78-.09.21-.23.9-1.05 1.14-1.41.24-.36.48-.3.8-.18.33.12 2.08.98 2.44 1.16.36.18.6.27.69.42.09.15.09.87-.15 1.55z"/></svg>
            </a>
          </div>
        </div>
        <div>
          <h4 data-i18n="footer.legal">Legal</h4>
          <ul>
            <li><a href="./legal-shipping.html" data-i18n="footer.shipping">Shipping & Returns</a></li>
            <li><a href="./legal-privacy.html" data-i18n="footer.privacy">Privacy Policy</a></li>
            <li><a href="./legal-terms.html" data-i18n="footer.terms">Terms & Conditions</a></li>
          </ul>
        </div>
        <div class="footer-recent">
          <div class="footer-recent-title">Recently viewed</div>
          <div class="footer-recent-grid" id="footerRecentGrid"></div>
        </div>
        <div class="footer-bottom">
          <span data-i18n="footer.rights">(C) {{year}} Power Poly Supplies. All rights reserved.</span>
          <span class="footer-trust">
            <span class="guarantee-badge" title="Satisfaction guarantee">Money-back guarantee</span>
            <span class="payment-icons" aria-label="Payment methods">
              <span class="pay-badge" aria-hidden="true">VISA</span>
              <span class="pay-badge" aria-hidden="true">Mastercard</span>
              <span class="pay-badge" aria-hidden="true">Square</span>
            </span>
          </span>
        </div>
      </div>
  `;
  footer.remove();
  document.body.appendChild(newFooter);
  window.PPS_I18N?.applyTranslations?.();
  renderFooterRecentProducts();

  // Reveal animation when footer comes into view
  const io = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting) newFooter.classList.add("reveal");
    });
  }, { threshold: 0.2 });
  io.observe(newFooter);
}

async function renderFooterRecentProducts(){
  const grid = document.getElementById("footerRecentGrid");
  if(!grid || !window.PPS?.loadProducts) return;
  let products = [];
  try{
    products = await window.PPS.loadProducts();
  }catch(_err){
    return;
  }
  let recent = [];
  try{
    const raw = localStorage.getItem("pps_recently_viewed_v1");
    const arr = JSON.parse(raw || "[]");
    recent = Array.isArray(arr) ? arr : [];
  }catch(_err){
    recent = [];
  }
  const picks = recent
    .map(slug => products.find(p=>String(p.slug) === String(slug)))
    .filter(Boolean)
    .slice(0, 3);
  if(!picks.length){
    grid.innerHTML = `<div class="footer-recent-empty">Browse products to see your recently viewed items.</div>`;
    return;
  }
  grid.innerHTML = picks.map(item=>`
    <a class="footer-recent-card" href="./product.html?slug=${encodeURIComponent(item.slug)}">
      <img src="${item.image}" alt="${item.name}" loading="lazy" decoding="async">
      <span>${item.name}</span>
    </a>
  `).join("");
  try{ window.PPS_I18N?.applyTranslations?.(); }catch(_err){}
}

function normalizeSearchText(value){
  return String(value || "")
    .toLowerCase()
    .replace(/["'()]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function setupSearch(){
  const forms = document.querySelectorAll("form.search-bar");
  if(!forms.length) return;

  const params = new URLSearchParams(window.location.search);
  const currentQ = params.get("q");
  forms.forEach(form=>{
    const input = form.querySelector('input[type="search"]');
    if(input && currentQ && !input.value){
      input.value = currentQ;
    }
  });

  let cachedProducts = null;
  let cachedIndex = null;
  const ensureProducts = async ()=>{
    if(cachedProducts && cachedProducts.length){
      return cachedProducts;
    }
    if(window.PPS?.loadProducts){
      cachedProducts = await window.PPS.loadProducts();
      return cachedProducts;
    }
    return [];
  };

  const ensureIndex = async ()=>{
    if(cachedIndex && cachedIndex.length){
      return cachedIndex;
    }
    const products = await ensureProducts();
    cachedIndex = (Array.isArray(products) ? products : []).map((p)=>{
      const name = normalizeSearchText(p?.name);
      const slug = normalizeSearchText(p?.slug);
      const category = normalizeSearchText(p?.category);
      return { p, name, slug, category };
    });
    return cachedIndex;
  };

  forms.forEach(form=>{
    const input = form.querySelector('input[type="search"]');
    if(!input) return;
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "none");
    input.setAttribute("spellcheck", "false");

    let box = form.querySelector(".search-suggestions");
    if(!box){
      box = document.createElement("div");
      box.className = "search-suggestions";
      box.hidden = true;
      form.appendChild(box);
    }

    const hideBox = ()=>{
      box.hidden = true;
      box.innerHTML = "";
    };

    let activeIndex = -1;
    const setActiveIndex = (next)=>{
      const buttons = Array.from(box.querySelectorAll("button"));
      if(!buttons.length){
        activeIndex = -1;
        return;
      }
      const max = buttons.length - 1;
      const idx = Math.min(max, Math.max(0, Number(next) || 0));
      activeIndex = idx;
      buttons.forEach((b, i)=>{
        b.classList.toggle("active", i === activeIndex);
        b.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
      });
      try{ buttons[activeIndex]?.scrollIntoView?.({ block:"nearest" }); }catch(_err){}
    };

    const getActiveButton = ()=>{
      const buttons = Array.from(box.querySelectorAll("button"));
      if(!buttons.length) return null;
      if(activeIndex < 0 || activeIndex >= buttons.length) return null;
      return buttons[activeIndex] || null;
    };

    const renderSuggestions = (items)=>{
      if(!items.length){
        hideBox();
        return;
      }
      box.innerHTML = items.map(item=>{
        if(item.type === "category"){
          return `<button type="button" data-cat="${item.value}" class="suggestion suggestion-category">
            <span class="suggestion-text">
              <span class="suggestion-title">${item.label}</span>
              <span class="suggestion-meta">${window.PPS_I18N?.t("search.suggestion.category") || "Category"}</span>
            </span>
          </button>`;
        }
        const img = item.image ? `<img class="suggestion-thumb" src="${item.image}" alt="" loading="lazy" decoding="async" width="44" height="34">` : "";
        const meta = [item.category, item.price, item.stockLabel].filter(Boolean).join(" | ");
        return `<button type="button" data-slug="${item.value}" class="suggestion suggestion-product">
          ${img}
          <span class="suggestion-text">
            <span class="suggestion-title">${item.label}</span>
            <span class="suggestion-meta">${meta}</span>
          </span>
        </button>`;
      }).join("");
      box.hidden = false;
      activeIndex = -1;
    };

    const buildQueryTokens = (query)=>{
      let text = normalizeSearchText(query);
      const replacements = [
        ["poly bag", "polybag"],
        ["poly bags", "polybag"],
        ["garment bag", "garment"],
        ["garment bags", "garment"],
        ["struct", "strut"],
        ["struc", "strut"]
      ];
      replacements.forEach(([from, to])=>{
        const rx = new RegExp(`\\b${from}\\b`, "g");
        text = text.replace(rx, to);
      });
      const tokens = text.split(" ").filter(t=>t.length >= 2);
      const expanded = new Set(tokens);
      tokens.forEach(t=>{
        if(t.endsWith("s") && t.length > 3) expanded.add(t.slice(0, -1));
      });
      return Array.from(expanded);
    };

    let inputTimer = 0;
    input.addEventListener("input", ()=>{
      clearTimeout(inputTimer);
      inputTimer = window.setTimeout(async ()=>{
        const raw = String(input.value || "");
        const query = normalizeSearchText(raw);
        if(!query){
          hideBox();
          return;
        }

        const index = await ensureIndex();
        const tokens = buildQueryTokens(raw);
        const scoreMatch = (item)=>{
          const name = item.name;
          const slug = item.slug;
          const cat = item.category;
          if(!name && !slug && !cat) return 0;
          let score = 0;
          if(query && (query === name || query === slug)) score += 18;
          if(query && (name.startsWith(query) || slug.startsWith(query))) score += 10;
          if(query && (name.includes(query) || slug.includes(query))) score += 6;
          if(query && cat.includes(query)) score += 4;
          for(const t of tokens){
            if(!t) continue;
            if(name.includes(t) || slug.includes(t)) score += 2;
            if(cat.includes(t)) score += 1;
          }
          return score;
        };

        const ranked = index
          .map((x)=> ({ x, score: scoreMatch(x) }))
          .filter(r=> r.score > 0)
          .sort((a,b)=> b.score - a.score)
          .slice(0, 8)
          .map(r=> r.x.p);

        const productItems = ranked.map(p=>({
          type: "product",
          value: p.slug,
          label: p.name,
          image: p.image,
          category: p.category,
          price: window.PPS?.money ? PPS.money(PPS.getTieredPriceCents?.(p, 1) ?? p.priceCents, p.currency) : "",
          stockLabel: p.stock <= 0 ? (window.PPS_I18N?.t("products.stock.out") || "Out of stock") : p.stock <= 10 ? (window.PPS_I18N?.t("products.stock.low") || "Almost out") : (window.PPS_I18N?.t("products.stock.in") || "In stock")
        }));

        const products = await ensureProducts();
        const categories = Array.from(new Set((Array.isArray(products) ? products : []).map(p=>p.category).filter(Boolean)));
        const categoryItems = categories
          .filter(cat=>normalizeSearchText(cat).includes(query))
          .slice(0, 3)
          .map(cat=>({
            type: "category",
            value: cat,
            label: cat
          }));

        renderSuggestions([...productItems, ...categoryItems]);
      }, 120);
    });

    input.addEventListener("keydown", (event)=>{
      if(box.hidden) return;
      const key = event.key;
      if(key === "Escape"){
        hideBox();
        event.preventDefault();
        return;
      }
      if(key === "ArrowDown"){
        const buttons = box.querySelectorAll("button");
        if(!buttons.length) return;
        setActiveIndex(activeIndex < 0 ? 0 : activeIndex + 1);
        event.preventDefault();
        return;
      }
      if(key === "ArrowUp"){
        const buttons = box.querySelectorAll("button");
        if(!buttons.length) return;
        setActiveIndex(activeIndex <= 0 ? 0 : activeIndex - 1);
        event.preventDefault();
        return;
      }
      if(key === "Enter"){
        const btn = getActiveButton();
        if(!btn) return;
        event.preventDefault();
        btn.click();
      }
    });

    input.addEventListener("focus", ()=>{
      if(box.innerHTML){
        box.hidden = false;
      }
    });
    input.addEventListener("blur", ()=>{
      setTimeout(hideBox, 120);
    });

    box.addEventListener("mousedown", (event)=>{
      const target = event.target;
      if(!(target instanceof HTMLElement)) return;
      const btn = target.closest("button[data-slug], button[data-cat]");
      if(!btn) return;
      if(btn.matches("button[data-slug]")){
        const slug = btn.getAttribute("data-slug");
        if(slug){
          window.location.href = `./product.html?slug=${encodeURIComponent(slug)}`;
        }
      }else if(btn.matches("button[data-cat]")){
        const cat = btn.getAttribute("data-cat");
        if(cat){
          window.location.href = `./products.html?cat=${encodeURIComponent(cat)}`;
        }
      }
    });

    form.addEventListener("submit", async (event)=>{
      const query = String(input.value || "").trim();
      if(!query) return;
      event.preventDefault();

      const products = await ensureProducts();
      if(!products.length){
        window.location.href = `./products.html?q=${encodeURIComponent(query)}`;
        return;
      }

      const normQuery = normalizeSearchText(query);
      const exact = products.find(p=>{
        const name = normalizeSearchText(p.name);
        const slug = normalizeSearchText(p.slug);
        return normQuery && (normQuery === name || normQuery === slug);
      });

      if(exact){
        window.location.href = `./product.html?slug=${encodeURIComponent(exact.slug)}`;
        return;
      }

      window.location.href = `./products.html?q=${encodeURIComponent(query)}`;
    });
  });
}

function setupCountUp(){
  const els = document.querySelectorAll("[data-count-up]");
  if(!els.length) return;

  const prefersReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const format = (n)=> String(Math.round(n));

  const animate = (el)=>{
    const raw = el.getAttribute("data-count-up");
    const suffix = el.getAttribute("data-count-suffix") || "";
    const target = Number(raw);
    if(!Number.isFinite(target)) return;
    if(prefersReduce){
      el.textContent = format(target) + suffix;
      return;
    }
    const start = performance.now();
    const duration = 900;
    const from = 0;
    const step = (now)=>{
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + (target - from) * eased;
      el.textContent = format(val) + suffix;
      if(t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      const el = e.target;
      if(el.dataset.counted === "1") return;
      el.dataset.counted = "1";
      animate(el);
    });
  }, { threshold: 0.35 });

  els.forEach(el=> io.observe(el));
}

function injectBottomNav(){
  if(document.querySelector(".bottom-nav")) return;
  const isMobile = window.matchMedia?.("(max-width: 860px)")?.matches;
  if(!isMobile) return;

  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Quick navigation");
  nav.innerHTML = `
    <a class="bottom-nav-item" href="./products.html">
      <span class="bicon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </span>
      <span data-i18n="bottom.categories">Categories</span>
    </a>
    <a class="bottom-nav-item" href="#pps-search" data-bottom-search>
      <span class="bicon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 15l1.8 1.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </span>
      <span data-i18n="bottom.search">Search</span>
    </a>
    <a class="bottom-nav-item" href="./cart.html">
      <span class="bicon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M6 6h14.2l-1.2 6H8.1L7.2 6H4V4h2a1 1 0 0 1 .99.86L7.8 6h12.42a1 1 0 0 1 .98 1.2l-1.4 7a1 1 0 0 1-.98.8H8a1 1 0 0 1-.99-.87L5.8 7H4V5h1.2L6 6zm2.5 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" fill="currentColor"/></svg>
      </span>
      <span data-i18n="nav.cart">Cart</span>
      <span class="bottom-badge" data-cart-badge>0</span>
    </a>
  `;
  document.body.appendChild(nav);
  window.PPS?.updateCartBadge?.();
  window.PPS_I18N?.applyTranslations?.();
}

function focusSmartSearch(){
  const navLinks = document.getElementById("navLinks");
  const dropdown = document.querySelector(".dropdown");
  if(navLinks){
    navLinks.classList.add("open");
  }
  dropdown?.classList.remove("open");

  const input =
    (navLinks ? navLinks.querySelector('form.search-bar input[type="search"]') : null) ||
    document.querySelector('form.search-bar input[type="search"]');

  if(!input) return false;

  try{
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }catch(_err){
    // ignore
  }
  try{
    input.focus();
    input.select?.();
  }catch(_err){
    // ignore
  }
  return true;
}

function setupBottomNavSearch(){
  if(window.__ppsBottomNavSearchBound) return;
  window.__ppsBottomNavSearchBound = true;

  // Support deep links like /products.html#pps-search
  if(window.location.hash === "#pps-search"){
    setTimeout(()=>{
      const focused = focusSmartSearch();
      if(focused){
        try{
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }catch(_err){
          // ignore
        }
      }
    }, 0);
  }

  document.addEventListener("click", (e)=>{
    const a = e.target?.closest?.("a[data-bottom-search]");
    if(!a) return;
    e.preventDefault();
    e.stopPropagation();

    const focused = focusSmartSearch();
    if(!focused){
      window.location.href = "./products.html#pps-search";
    }
  });
}

function setupInteractiveTools(){
  if(window.__ppsInteractiveToolsBound) return;
  window.__ppsInteractiveToolsBound = true;

  const toNum = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const fmtNumber = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
  const fmtWhole = (n) => new Intl.NumberFormat(undefined).format(Math.round(n));
  const fmtCurrency = (n) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);

  document.addEventListener("click", (event)=>{
    const btn = event.target?.closest?.("[data-open-help]");
    if(!btn) return;
    event.preventDefault();
    const fab = document.getElementById("helpFab");
    const panel = document.getElementById("helpPanel");
    if(!fab || !panel) return;
    const isOpen = fab.getAttribute("aria-expanded") === "true";
    if(!isOpen){
      fab.click();
    }
    setTimeout(()=>{
      const input = document.getElementById("helpChatInput");
      input?.focus?.();
    }, 0);
  });

  const configuratorForm = document.getElementById("configuratorForm");
  const configuratorOutput = document.getElementById("configuratorOutput");
  if(configuratorForm && configuratorOutput){
    const update = ()=>{
      const category = configuratorForm.category?.value || "Garment Bags";
      const thickness = configuratorForm.thickness?.value || "Standard";
      const width = fmtNumber(clamp(toNum(configuratorForm.width?.value, 24), 6, 120));
      const length = fmtNumber(clamp(toNum(configuratorForm.length?.value, 54), 12, 120));
      const closure = configuratorForm.closure?.value || "Open bottom";
      configuratorOutput.textContent = `Recommendation: ${width}" x ${length}" ${thickness.toLowerCase()} ${category.toLowerCase()} with ${closure.toLowerCase()}.`;
    };
    ["input", "change"].forEach((evt)=> configuratorForm.addEventListener(evt, update));
    update();
  }

  const arBtn = document.getElementById("arLaunchBtn");
  const arPreview = document.getElementById("arPreview");
  if(arBtn && arPreview){
    arBtn.addEventListener("click", ()=>{
      arPreview.classList.add("active");
      const title = arPreview.querySelector(".tool-preview-title");
      const desc = arPreview.querySelector(".tool-preview-desc");
      if(title) title.textContent = "AR session started";
      if(desc){
        desc.textContent = window.innerWidth < 768
          ? "Move your phone around to place the bag outline."
          : "AR works best on mobile. Open this page on your phone to view.";
      }
    });
  }

  const sizeCalcForm = document.getElementById("sizeCalcForm");
  const sizeCalcOutput = document.getElementById("sizeCalcOutput");
  if(sizeCalcForm && sizeCalcOutput){
    const update = ()=>{
      const width = clamp(toNum(sizeCalcForm.garmentWidth?.value, 18), 10, 80);
      const length = clamp(toNum(sizeCalcForm.garmentLength?.value, 40), 24, 90);
      const bagWidth = fmtNumber(width + 6);
      const bagLength = fmtNumber(length + 8);
      sizeCalcOutput.textContent = `Suggested bag size: ${bagWidth}" W x ${bagLength}" L.`;
    };
    ["input", "change"].forEach((evt)=> sizeCalcForm.addEventListener(evt, update));
    update();
  }

  const usageCalcForm = document.getElementById("usageCalcForm");
  const usageCalcOutput = document.getElementById("usageCalcOutput");
  if(usageCalcForm && usageCalcOutput){
    const update = ()=>{
      const gpd = clamp(toNum(usageCalcForm.gpd?.value, 0), 0, 100000);
      const days = clamp(toNum(usageCalcForm.days?.value, 0), 0, 31);
      const buffer = clamp(toNum(usageCalcForm.buffer?.value, 0), 0, 50);
      const monthly = gpd * days;
      const orderQty = monthly * (1 + buffer / 100);
      usageCalcOutput.textContent = `Estimated monthly usage: ${fmtWhole(monthly)}. Order qty with buffer: ${fmtWhole(orderQty)}.`;
    };
    ["input", "change"].forEach((evt)=> usageCalcForm.addEventListener(evt, update));
    update();
  }

  const roiCalcForm = document.getElementById("roiCalcForm");
  const roiCalcOutput = document.getElementById("roiCalcOutput");
  if(roiCalcForm && roiCalcOutput){
    const update = ()=>{
      const volume = clamp(toNum(roiCalcForm.volume?.value, 0), 0, 1000000);
      const currentCost = clamp(toNum(roiCalcForm.currentCost?.value, 0), 0, 100);
      const newCost = clamp(toNum(roiCalcForm.newCost?.value, 0), 0, 100);
      const minutesSaved = clamp(toNum(roiCalcForm.minutesSaved?.value, 0), 0, 30);
      const hourlyRate = clamp(toNum(roiCalcForm.hourlyRate?.value, 0), 0, 200);
      const materialSavings = Math.max(0, (currentCost - newCost) * volume);
      const laborSavings = Math.max(0, (minutesSaved / 60) * hourlyRate * volume);
      roiCalcOutput.textContent = `Estimated monthly savings: ${fmtCurrency(materialSavings)} (materials) + ${fmtCurrency(laborSavings)} (labor).`;
    };
    ["input", "change"].forEach((evt)=> roiCalcForm.addEventListener(evt, update));
    update();
  }

  const sampleForm = document.getElementById("sampleRequestForm");
  const sampleSteps = document.getElementById("sampleSteps");
  const sampleNote = document.getElementById("sampleRequestNote");
  if(sampleForm && sampleSteps){
    sampleForm.addEventListener("submit", (event)=>{
      event.preventDefault();
      const steps = Array.from(sampleSteps.querySelectorAll(".tool-step"));
      steps.forEach((step, idx)=>{
        step.classList.toggle("done", idx === 0);
        step.classList.toggle("active", idx === 1);
      });
      if(sampleNote){
        sampleNote.textContent = "Request logged. Sample packed in 1 business day.";
      }
      sampleForm.reset();
    });
  }

  const quoteForm = document.getElementById("quoteCompareForm");
  const quoteOutput = document.getElementById("quoteCompareOutput");
  if(quoteForm && quoteOutput){
    const update = ()=>{
      const vendorA = quoteForm.vendorA?.value || "Vendor A";
      const vendorB = quoteForm.vendorB?.value || "Vendor B";
      const priceA = clamp(toNum(quoteForm.priceA?.value, 0), 0, 100000);
      const priceB = clamp(toNum(quoteForm.priceB?.value, 0), 0, 100000);
      const leadA = clamp(toNum(quoteForm.leadA?.value, 0), 0, 365);
      const leadB = clamp(toNum(quoteForm.leadB?.value, 0), 0, 365);
      const bestPrice = priceA === priceB ? `${vendorA} + ${vendorB}` : (priceA < priceB ? vendorA : vendorB);
      const fastest = leadA === leadB ? `${vendorA} + ${vendorB}` : (leadA < leadB ? vendorA : vendorB);
      quoteOutput.textContent = `Best price: ${bestPrice}. Fastest delivery: ${fastest}.`;
    };
    ["input", "change"].forEach((evt)=> quoteForm.addEventListener(evt, update));
    update();
  }

  const bulkForm = document.getElementById("bulkEstimatorForm");
  const bulkOutput = document.getElementById("bulkEstimatorOutput");
  if(bulkForm && bulkOutput){
    const update = ()=>{
      const cases = clamp(toNum(bulkForm.cases?.value, 1), 1, 100000);
      const price = clamp(toNum(bulkForm.casePrice?.value, 0), 0, 100000);
      let discountPct = 0;
      if(cases >= 250) discountPct = 12;
      else if(cases >= 100) discountPct = 8;
      else if(cases >= 50) discountPct = 5;
      const subtotal = cases * price;
      const total = subtotal * (1 - discountPct / 100);
      bulkOutput.textContent = `Bulk price: ${fmtCurrency(total)} with ${discountPct}% discount.`;
    };
    ["input", "change"].forEach((evt)=> bulkForm.addEventListener(evt, update));
    update();
  }
}

function setupAnalytics(){
  if(window.PPS_ANALYTICS) return;
  const queueKey = "pps_analytics_queue";
  const sessionId = (()=> {
    const key = "pps_analytics_session";
    const existing = localStorage.getItem(key);
    if(existing) return existing;
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    localStorage.setItem(key, id);
    return id;
  })();

  const readQueue = () => {
    try{
      const raw = localStorage.getItem(queueKey);
      const list = JSON.parse(raw || "[]");
      return Array.isArray(list) ? list : [];
    }catch(_err){
      return [];
    }
  };
  const writeQueue = (list) => {
    try{ localStorage.setItem(queueKey, JSON.stringify(list.slice(-500))); }catch(_err){}
  };

  const record = (event, data={}) => {
    const payload = {
      event,
      data,
      ts: Date.now(),
      path: window.location.pathname,
      sessionId
    };
    const list = readQueue();
    list.push(payload);
    writeQueue(list);
    window.dispatchEvent(new CustomEvent("pps:analytics", { detail: payload }));
  };

  const assignVariant = (key, variants=["A","B"]) => {
    const storeKey = `pps_ab_${key}`;
    const existing = localStorage.getItem(storeKey);
    if(existing) return existing;
    const idx = Math.floor(Math.random() * variants.length);
    const choice = variants[idx];
    localStorage.setItem(storeKey, choice);
    record("ab_assign", { key, variant: choice });
    return choice;
  };

  window.PPS_ANALYTICS = {
    record,
    assignVariant,
    getQueue: readQueue
  };

  // Page view + funnel step
  record("page_view", { title: document.title });
  if(/product\.html$/i.test(window.location.pathname)) record("funnel_view_product");
  if(/cart\.html$/i.test(window.location.pathname)) record("funnel_view_cart");
  if(/checkout\.html$/i.test(window.location.pathname)) record("funnel_view_checkout");

  // Heatmap click capture
  document.addEventListener("click", (e)=>{
    const target = e.target;
    const rect = document.documentElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(1, rect.width);
    const y = (e.clientY - rect.top) / Math.max(1, rect.height);
    record("heatmap_click", { x, y, tag: target?.tagName, id: target?.id || "", cls: target?.className || "" });
  }, { passive:true });

  // Scroll depth
  let maxScroll = 0;
  window.addEventListener("scroll", ()=>{
    const doc = document.documentElement;
    const total = Math.max(1, doc.scrollHeight - doc.clientHeight);
    const ratio = Math.min(1, Math.max(0, doc.scrollTop / total));
    if(ratio > maxScroll + 0.05){
      maxScroll = ratio;
      record("scroll_depth", { depth: Math.round(maxScroll * 100) });
    }
  }, { passive:true });
}

function setupJourneyTracking(){
  if(window.__ppsJourneyBound) return;
  window.__ppsJourneyBound = true;
  const key = "pps_journey_v1";
  const recordStep = (step, meta={}) => {
    try{
      const raw = localStorage.getItem(key);
      const list = Array.isArray(JSON.parse(raw || "[]")) ? JSON.parse(raw || "[]") : [];
      list.push({ step, meta, ts: Date.now(), path: window.location.pathname });
      localStorage.setItem(key, JSON.stringify(list.slice(-200)));
    }catch(_err){}
  };
  window.addEventListener("pps:analytics", (e)=>{
    const ev = e.detail;
    recordStep(ev.event, ev.data || {});
  });
}

function injectHelpWidget(){
  if(document.getElementById("helpWidget")) return;
  const wrap = document.createElement("div");
  wrap.id = "helpWidget";
  wrap.className = "help-widget";
  wrap.innerHTML = `
    <button class="help-fab" type="button" id="helpFab" aria-expanded="false" aria-controls="helpPanel">
      <span class="help-fab-icon" aria-hidden="true">?</span>
      <span data-i18n="help.fab">Help</span>
    </button>
    <div class="help-panel" id="helpPanel" aria-hidden="true">
      <div class="help-panel-header">
        <div data-i18n="help.title">Live customer support</div>
        <button class="help-close" type="button" id="helpClose" aria-label="Close" data-i18n-aria-label="help.close">X</button>
      </div>
      <div class="help-panel-body">
        <div class="help-tabs" role="tablist" aria-label="Help options" data-i18n-aria-label="help.tabs_aria">
          <button class="help-tab active" type="button" role="tab" aria-selected="true" data-help-tab="faq" data-i18n="help.tab.quick">Quick answers</button>
          <button class="help-tab" type="button" role="tab" aria-selected="false" data-help-tab="message" data-i18n="help.tab.message">Message us</button>
        </div>

        <div class="help-tab-panels">
          <div class="help-tab-panel open" data-help-panel="faq" role="tabpanel">
            <div class="help-chat">
              <div class="help-chat-log" id="helpChatLog" aria-live="polite"></div>
              <div class="help-suggestions" id="helpChatSuggestions" aria-label="Suggested questions" data-i18n-aria-label="help.chat.suggestions_aria"></div>
              <form class="help-chat-input" id="helpChatForm">
                <input class="input" id="helpChatInput" placeholder="Ask a question (shipping, sizes, thickness...)" data-i18n-placeholder="help.chat.placeholder" autocomplete="off">
                <button class="btn btn-primary" type="submit" data-i18n="help.chat.send">Send</button>
              </form>
              <div class="help-chat-footer">
                <a class="btn btn-outline btn-sm" href="https://chat.whatsapp.com/LVaouedAZVIEcgrD6nj2hC" target="_blank" rel="noopener">WhatsApp</a>
                <a class="btn btn-outline btn-sm" href="./resources.html" data-i18n="help.link.resources">Resources</a>
                <a class="btn btn-outline btn-sm" href="./contact.html" data-i18n="help.link.contact">Contact</a>
              </div>
            </div>
          </div>

          <div class="help-tab-panel" data-help-panel="message" role="tabpanel">
            <p data-i18n="help.subtitle">We're offline right now. Leave a message and we'll get back to you.</p>
            <form id="helpForm" class="help-form">
              <label>
                <span data-i18n="help.name">Name</span>
                <input class="input" name="name" required>
              </label>
              <label>
                <span data-i18n="help.email">Email</span>
                <input class="input" type="email" name="email" required>
              </label>
              <label>
                <span data-i18n="help.message">Message</span>
                <textarea class="input" name="message" rows="4" required></textarea>
              </label>
              <button class="btn btn-primary" type="submit" data-i18n="help.send">Send message</button>
              <div class="help-status" id="helpStatus"></div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  window.PPS_I18N?.applyTranslations?.();

  const helpTextNodes = {
    fab: wrap.querySelector('[data-i18n="help.fab"]'),
    title: wrap.querySelector('[data-i18n="help.title"]'),
    subtitle: wrap.querySelector('[data-i18n="help.subtitle"]'),
    name: wrap.querySelector('[data-i18n="help.name"]'),
    email: wrap.querySelector('[data-i18n="help.email"]'),
    message: wrap.querySelector('[data-i18n="help.message"]'),
    send: wrap.querySelector('[data-i18n="help.send"]')
  };

  function getHelpCopy(lang){
    const localized = {
      ko: {
        fab: "\ub3c4\uc6c0",
        title: "\uc2e4\uc2dc\uac04 \uace0\uac1d \uc9c0\uc6d0",
        subtitle: "\ud604\uc7ac \uc624\ud504\ub77c\uc778\uc785\ub2c8\ub2e4. \uba54\uc2dc\uc9c0\ub97c \ub0a8\uaca8\uc8fc\uc2dc\uba74 \uc5f0\ub77d\ub4dc\ub9ac\uaca0\uc2b5\ub2c8\ub2e4.",
        name: "\uc774\ub984",
        email: "\uc774\uba54\uc77c",
        message: "\uba54\uc2dc\uc9c0",
        send: "\uba54\uc2dc\uc9c0 \ubcf4\ub0b4\uae30",
        sending: "\uc81c\ucd9c \uc911...",
        sent: "\uac10\uc0ac\ud569\ub2c8\ub2e4! \uacf5\uac04 \uc5f0\ub77d\ub4dc\ub9ac\uaca0\uc2b5\ub2c8\ub2e4.",
        error: "\ud604\uc7ac \ubc1c\uc1a1\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694."
      },
      hi: {
        fab: "\u092e\u0926\u0926",
        title: "\u0932\u093e\u0907\u0935 \u0917\u094d\u0930\u093e\u0939\u0915 \u0938\u0939\u093e\u092f\u0924\u093e",
        subtitle: "\u0939\u092e \u0905\u092d\u0940 \u0911\u092b\u093c\u0932\u093e\u0907\u0928 \u0939\u0948\u0902\u0964 \u0938\u0902\u0926\u0947\u0936 \u091b\u094b\u0921\u093c\u0947\u0902, \u0939\u092e \u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0930\u0947\u0902\u0917\u0947\u0964",
        name: "\u0928\u093e\u092e",
        email: "\u0908\u092e\u0947\u0932",
        message: "\u0938\u0902\u0926\u0947\u0936",
        send: "\u0938\u0902\u0926\u0947\u0936 \u092d\u0947\u091c\u0947\u0902",
        sending: "\u092d\u0947\u091c \u0930\u0939\u0947 \u0939\u0948\u0902...",
        sent: "\u0927\u0928\u094d\u092f\u0935\u093e\u0926! \u0939\u092e \u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0930\u0947\u0902\u0917\u0947\u0964",
        error: "\u0905\u092d\u0940 \u092d\u0947\u091c\u0928\u0947 \u092e\u0947\u0902 \u0938\u092e\u0938\u094d\u092f\u093e \u0939\u0948\u0964 \u0915\u0943\u092a\u092f\u093e \u0926\u094b\u092c\u093e\u0930\u093e \u0915\u094b\u0936\u093f\u0936 \u0915\u0930\u0947\u0902\u0964"
      },
      ta: {
        fab: "\u0b89\u0ba4\u0bb5\u0bbf",
        title: "\u0ba8\u0bc7\u0bb0\u0b9f\u0bbf \u0bb5\u0bbe\u0b9f\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bbe\u0bb3\u0bb0\u0bcd \u0b86\u0ba4\u0bb0\u0bb5\u0bc1",
        subtitle: "\u0ba4\u0bb1\u0bcd\u0baa\u0bcb\u0ba4\u0bc1 \u0b86\u0ba9\u0bcd\u0bb2\u0bc8\u0ba9\u0bbf\u0bb2\u0bcd \u0b87\u0bb2\u0bcd\u0bb2\u0bc8. \u0b92\u0bb0\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd\u0ba4\u0bbf \u0bb5\u0bbf\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd, \u0ba8\u0bbe\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0ba4\u0bca\u0b9f\u0bb0\u0bcd\u0baa\u0bc1 \u0b95\u0bca\u0bb3\u0bcd\u0bb5\u0bcb\u0bae\u0bcd.",
        name: "\u0baa\u0bc6\u0baf\u0bb0\u0bcd",
        email: "\u0bae\u0bbf\u0ba9\u0bcd\u0ba9\u0b9e\u0bcd\u0b9a\u0bb2\u0bcd",
        message: "\u0b9a\u0bc6\u0baf\u0bcd\u0ba4\u0bbf",
        send: "\u0b9a\u0bc6\u0baf\u0bcd\u0ba4\u0bbf\u0baf\u0bc8 \u0b85\u0ba9\u0bc1\u0baa\u0bcd\u0baa\u0bc1",
        sending: "\u0b85\u0ba9\u0bc1\u0baa\u0bcd\u0baa\u0bc1\u0b95\u0bbf\u0bb1\u0b9f\u0bc1...",
        sent: "\u0ba8\u0ba9\u0bcd\u0bb1\u0bbf! \u0ba8\u0bbe\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0ba4\u0bca\u0b9f\u0bb0\u0bcd\u0baa\u0bc1 \u0b95\u0bca\u0bb3\u0bcd\u0bb5\u0bcb\u0bae\u0bcd.",
        error: "\u0ba4\u0bb1\u0bcd\u0baa\u0bcb\u0ba4\u0bc1 \u0b85\u0ba9\u0bc1\u0baa\u0bcd\u0baa \u0bae\u0bc1\u0b9f\u0bbf\u0baf\u0bb5\u0bbf\u0bb2\u0bcd\u0bb2\u0bc8. \u0ba4\u0baf\u0bb5\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd\u0b95."
      },
      es: {
        fab: "Ayuda",
        title: "Soporte al cliente en vivo",
        subtitle: "Ahora mismo estamos fuera de línea. Deja un mensaje y nos pondremos en contacto.",
        name: "Nombre",
        email: "Correo",
        message: "Mensaje",
        send: "Enviar mensaje",
        sending: "Enviando...",
        sent: "¡Gracias! Nos pondremos en contacto.",
        error: "No se pudo enviar en este momento. Inténtalo de nuevo."
      }
    };
    return localized[lang] || null;
  }

  function applyHelpCopy(){
    const lang = window.PPS_I18N?.getLang?.() || "en";
    const copy = getHelpCopy(lang);
    if(!copy) return;
    if(helpTextNodes.fab) helpTextNodes.fab.textContent = copy.fab;
    if(helpTextNodes.title) helpTextNodes.title.textContent = copy.title;
    if(helpTextNodes.subtitle) helpTextNodes.subtitle.textContent = copy.subtitle;
    if(helpTextNodes.name) helpTextNodes.name.textContent = copy.name;
    if(helpTextNodes.email) helpTextNodes.email.textContent = copy.email;
    if(helpTextNodes.message) helpTextNodes.message.textContent = copy.message;
    if(helpTextNodes.send) helpTextNodes.send.textContent = copy.send;
  }

  applyHelpCopy();

  const fab = document.getElementById("helpFab");
  const panel = document.getElementById("helpPanel");
  const closeBtn = document.getElementById("helpClose");
  const form = document.getElementById("helpForm");
  const status = document.getElementById("helpStatus");
  const tabButtons = Array.from(wrap.querySelectorAll("[data-help-tab]"));
  const tabPanels = Array.from(wrap.querySelectorAll("[data-help-panel]"));
  const chatLog = document.getElementById("helpChatLog");
  const chatSuggestions = document.getElementById("helpChatSuggestions");
  const chatForm = document.getElementById("helpChatForm");
  const chatInput = document.getElementById("helpChatInput");
  const aiState = {
    messages: []
  };

  const aiEndpoint = (()=> {
    if(window.PPS_AI_CHAT_ENDPOINT) return String(window.PPS_AI_CHAT_ENDPOINT);
    const apiBase = window.PPS?.API_BASE || window.PPS_API_BASE || "";
    return apiBase ? `${apiBase}/api/ai-chat` : "";
  })();

  function buildAiMessages(userText){
    const system = {
      role: "system",
      content: "You are Power Poly Supplies' helpful support assistant. Answer concisely about product sizing, thickness, shipping, payments, bulk orders, and account features. If unsure, recommend contacting support."
    };
    const history = aiState.messages.slice(-6);
    return [system, ...history, { role:"user", content: userText }];
  }

  async function askAi(userText){
    if(!aiEndpoint) return null;
    const typing = appendTyping();
    try{
      const res = await fetch(aiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: buildAiMessages(userText),
          meta: { path: window.location.pathname }
        })
      });
      const data = await res.json().catch(()=> ({}));
      if(!res.ok) throw new Error(data?.error || "AI request failed");
      const reply = data.reply || data.message || data.output_text || data.text;
      if(!reply) throw new Error("Missing reply");
      aiState.messages.push({ role:"user", content: userText });
      aiState.messages.push({ role:"assistant", content: reply });
      try{ typing?.remove?.(); }catch(_err){}
      appendMessage({ role:"bot", text: String(reply) });
      renderSuggestions();
      return reply;
    }catch(_err){
      try{ typing?.remove?.(); }catch(_err){}
      return null;
    }
  }

  function setOpen(open){
    if(!fab || !panel) return;
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    panel.classList.toggle("open", open);
  }

  function setActiveTab(tab){
    const next = tab === "message" ? "message" : "faq";
    tabButtons.forEach((btn)=>{
      const isActive = btn.getAttribute("data-help-tab") === next;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    tabPanels.forEach((p)=>{
      const isActive = p.getAttribute("data-help-panel") === next;
      p.classList.toggle("open", isActive);
    });
  }

  if(fab){
    fab.addEventListener("click", ()=> setOpen(!panel.classList.contains("open")));
  }
  if(closeBtn){
    closeBtn.addEventListener("click", ()=> setOpen(false));
  }

  tabButtons.forEach((btn)=>{
    btn.addEventListener("click", ()=> setActiveTab(btn.getAttribute("data-help-tab")));
  });

  // ---- Simple FAQ chatbot (rule-based, local) ----
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

  const normalizeText = (value) => {
    const raw = String(value || "");
    try{
      return raw
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF\u0900-\u097F\u0B80-\u0BFF\u1100-\u11FF\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }catch(_err){
      return raw.toLowerCase().trim();
    }
  };

  function appendMessage({ role, text, html }){
    if(!chatLog) return;
    const bubble = document.createElement("div");
    bubble.className = `help-chat-msg ${role === "user" ? "user" : "bot"}`;
    const inner = document.createElement("div");
    inner.className = "help-chat-bubble";
    if(html){
      inner.innerHTML = html;
    }else{
      inner.textContent = String(text || "");
    }
    bubble.appendChild(inner);
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  const helpT = (key, fallback = "") => {
    const value = window.PPS_I18N?.t?.(key);
    return value || fallback || "";
  };

  const faqTitle = (faq) => helpT(faq?.titleKey, faq?.title || "");
  const faqAnswer = (faq) => helpT(faq?.answerKey, typeof faq?.answer === "function" ? faq.answer() : "");

  const FAQ = [
    {
      id: "shipping",
      titleKey: "help.chat.topic.shipping",
      title: "Shipping / delivery",
      keywords: ["ship","shipping","deliver","delivery","gta","outside","charge","charges","cost"],
      followups: [
        { id:"shipping_fees", labelKey:"help.chat.followup.shipping_fees", label:"Do you charge outside GTA?" },
        { id:"shipping_time", labelKey:"help.chat.followup.shipping_time", label:"How fast is delivery?" }
      ],
      match: (q)=> /ship|shipping|deliver|delivery|gta|outside|charge|charges|cost|pickup|courier/i.test(q),
      answerKey: "help.chat.answer.shipping",
      answer: () => `Standard GTA delivery is free. Express and non‑GTA delivery charges are confirmed by our team after we review the order and address.<br><a href="./legal-shipping.html">Read Shipping & Returns</a>`
    },
    {
      id: "sizes",
      titleKey: "help.chat.topic.sizes",
      title: "Garment bag sizes",
      keywords: ["size","sizing","garment bag","cover bag","length","width","measure","measurement","gusset","coat","dress","tailles","mesure","medida","talla","사이즈","측정","माप","आकार","लंबाई","चौड़ाई","அளவு","நீளம்","அகலம்"],
      followups: [
        { id:"sizes_shirts", labelKey:"help.chat.followup.sizes_shirts", label:"What size for shirts?" },
        { id:"sizes_coats", labelKey:"help.chat.followup.sizes_coats", label:"What size for coats?" }
      ],
      match: (q)=> /size|sizing|garment bag|cover bag|length|width|measure|gusset|coat|dress/i.test(q),
      answerKey: "help.chat.answer.sizes",
      answer: () => `Use garment width + 4–6" and garment length + 4–8" as a quick rule. For bulky coats, consider a wider/gusseted bag.<br><a href="./resources.html#guide-garment-bag-sizes">Read the sizing guide</a>`
    },
    {
      id: "thickness",
      titleKey: "help.chat.topic.thickness",
      title: "Heavy vs Extra Heavy",
      keywords: ["heavy","extra heavy","thick","thickness","mil","gauge","tear","puncture","sharp","corner","epais","epaisseur","grueso","grosor","두께","मोटाई","தடிமன்","தடிமை"],
      followups: [
        { id:"thickness_mil", labelKey:"help.chat.followup.thickness_mil", label:"What does mil mean?" },
        { id:"thickness_choice", labelKey:"help.chat.followup.thickness_choice", label:"Which one should I buy?" }
      ],
      match: (q)=> /heavy|extra heavy|thick|thickness|mil|gauge|tear|puncture|sharp|corner/i.test(q),
      answerKey: "help.chat.answer.thickness",
      answer: () => `Choose <b>Heavy</b> for everyday packaging. Choose <b>Extra Heavy</b> for sharp corners, heavy loads, delivery routes, or fewer tears/rewraps.<br><a href="./resources.html#heavy-vs-extra-heavy">Read the thickness guide</a>`
    },
    {
      id: "hangers",
      titleKey: "help.chat.topic.hangers",
      title: "Hanger types + box quantity",
      keywords: ["hanger","hangers","shirt hanger","suit hanger","dress hanger","strut","capped","caped","cape","wire","strength","shoulder","box","case","case pack","pcs","pieces","500"],
      followups: [
        { id:"hangers_box", labelKey:"help.chat.followup.hangers_box", label:"How many hangers in a box?" },
        { id:"hangers_choice", labelKey:"help.chat.followup.hangers_choice", label:"Which hanger for shirts vs suits?" },
        { id:"hangers_caped", labelKey:"help.chat.followup.hangers_caped", label:"When should I use capped/cape hangers?" }
      ],
      match: (q)=> /hanger|hangers|shirt hanger|suit hanger|dress hanger|strut|capped|caped|cape|wire|500/i.test(q),
      answerKey: "help.chat.answer.hangers",
      answer: () => `Most of our hanger SKUs are packed <b>500 pieces per box</b> (case pack) - check the product page for the exact pack size.<br><br><b>Quick pick:</b> <b>Shirt</b> for tops, <b>Suit</b> for jackets, <b>Strut</b> for daily all-purpose strength, and <b>Capped/Cape</b> when you want extra shoulder stability and premium presentation.<br><a href="./products.html?cat=Hangers">Browse hangers</a>`
    },
    {
      id: "usage",
      titleKey: "help.chat.topic.usage",
      title: "Monthly packaging usage",
      keywords: ["month","monthly","how much","usage","estimate","planning","plan","per day","buffer","waste","consommation","mensuel","uso","mensual","사용량","월간","मासिक","उपयोग","महीना","மாத","பயன்பாடு"],
      followups: [
        { id:"usage_buffer", labelKey:"help.chat.followup.usage_buffer", label:"What buffer % should I use?" },
        { id:"usage_quote", labelKey:"help.chat.followup.usage_quote", label:"Can you estimate for me?" }
      ],
      match: (q)=> /month|monthly|how much|usage|estimate|planning|plan|per day/i.test(q),
      answerKey: "help.chat.answer.usage",
      answer: () => `A simple estimate: (garments/day) × (operating days/month), then add a 5–12% buffer for rewraps/tears/rush orders.<br><a href="./resources.html#dry-cleaner-packaging-usage">See the planner</a>`
    },
    {
      id: "pay",
      titleKey: "help.chat.topic.pay",
      title: "Payment options",
      keywords: ["pay","payment","square","card","invoice","pay later","terms","facture","paiement","pagar","pago","결제","카드","भुगतान","इनवॉइस","पेमेन्ट","பணம்","செலுத்த"],
      followups: [
        { id:"pay_invoice", labelKey:"help.chat.followup.pay_invoice", label:"Can I pay by invoice?" },
        { id:"pay_square", labelKey:"help.chat.followup.pay_square", label:"Is Square secure?" }
      ],
      match: (q)=> /pay|payment|square|card|invoice|pay later|terms/i.test(q),
      answerKey: "help.chat.answer.pay",
      answer: () => `You can pay online with Square or place the order now and pay later after fulfillment is confirmed. Start checkout to see both options.<br><a href="./checkout.html">Go to checkout</a>`
    },
    {
      id: "addresses",
      titleKey: "help.chat.topic.addresses",
      title: "Saved delivery addresses",
      keywords: ["address","addresses","multiple locations","warehouse","branch","default","saved","adresse","direccion","direcciones","주소","지점","पता","முகவரி","களஞ்சியம்"],
      followups: [
        { id:"addresses_how", labelKey:"help.chat.followup.addresses_how", label:"How do I add an address?" },
        { id:"addresses_default", labelKey:"help.chat.followup.addresses_default", label:"How do I set a default?" }
      ],
      match: (q)=> /address|addresses|multiple locations|warehouse|branch|default|saved/i.test(q),
      answerKey: "help.chat.answer.addresses",
      answer: () => `Business customers can save multiple delivery addresses (Main Store, Warehouse, Branch) and set a default for faster checkout.<br><a href="./account.html#addresses">Manage addresses</a>`
    }
  ];

  const HELP_CHIP_ROUTE = {
    shipping_fees: "shipping",
    shipping_time: "shipping",
    sizes_shirts: "sizes",
    sizes_coats: "sizes",
    thickness_mil: "thickness",
    thickness_choice: "thickness",
    hangers_box: "hangers",
    hangers_choice: "hangers",
    hangers_caped: "hangers",
    usage_buffer: "usage",
    usage_quote: "usage",
    pay_invoice: "pay",
    pay_square: "pay",
    addresses_how: "addresses",
    addresses_default: "addresses"
  };

  let helpChipBound = false;

  function getDefaultSuggestionItems(){
    return [
      { id:"sizes", label: helpT("help.chat.suggest.sizes", "Choosing garment bag sizes") },
      { id:"thickness", label: helpT("help.chat.suggest.thickness", "Heavy vs Extra Heavy thickness") },
      { id:"hangers", label: helpT("help.chat.suggest.hangers", "Hangers: types + box quantity") },
      { id:"usage", label: helpT("help.chat.suggest.usage", "How much packaging per month?") },
      { id:"shipping", label: helpT("help.chat.suggest.shipping", "Shipping / delivery") },
      { id:"pay", label: helpT("help.chat.suggest.pay", "Payments / pay later") }
    ];
  }

  function setSuggestionItems(items){
    if(!chatSuggestions) return;
    const list = Array.isArray(items) && items.length ? items : getDefaultSuggestionItems();
    chatSuggestions.innerHTML = list
      .map((it)=> `<button type="button" class="help-chip" data-help-chip="${esc(it.id)}">${esc(it.label)}</button>`)
      .join("");
  }

  function scoreFaq(faq, qNorm){
    if(!faq || !qNorm) return 0;
    let score = 0;
    const keywords = Array.isArray(faq.keywords) ? faq.keywords : [];
    for(const k of keywords){
      const kn = normalizeText(k);
      if(!kn) continue;
      if(qNorm.includes(kn)) score += (kn.length >= 6 ? 3 : 2);
    }
    if(typeof faq.match === "function" && faq.match(qNorm)) score += 3;
    return score;
  }

  function topFaqMatches(query, limit = 3){
    const qNorm = normalizeText(query);
    return FAQ
      .map((f)=> ({ f, score: scoreFaq(f, qNorm) }))
      .sort((a,b)=> b.score - a.score)
      .filter((x)=> x.score > 0)
      .slice(0, limit)
      .map((x)=> x.f);
  }

  function appendTyping(){
    if(!chatLog) return null;
    const bubble = document.createElement("div");
    bubble.className = "help-chat-msg bot";
    const inner = document.createElement("div");
    inner.className = "help-chat-bubble";
    inner.textContent = "...";
    bubble.appendChild(inner);
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    return bubble;
  }

  function renderSuggestions(items){
    setSuggestionItems(items);
    if(helpChipBound || !chatSuggestions) return;
    helpChipBound = true;
    chatSuggestions.addEventListener("click", (e)=>{
      const btn = e.target?.closest?.("[data-help-chip]");
      if(!btn) return;
      const chipId = String(btn.getAttribute("data-help-chip") || "").trim();
      const label = String(btn.textContent || "").trim();
      if(!chipId) return;

      const targetId = HELP_CHIP_ROUTE[chipId] || chipId;
      const faq = FAQ.find((f)=> f.id === targetId) || null;
      if(faq){
        appendMessage({ role:"user", text: label || faqTitle(faq) || chipId });
        const typing = appendTyping();
        setTimeout(()=>{
          try{ typing?.remove?.(); }catch(_err){}
          appendMessage({ role:"bot", html: faqAnswer(faq) });
          const followups = Array.isArray(faq.followups) ? faq.followups : [];
          if(followups.length){
            renderSuggestions(followups.map((x)=> ({ id: x.id, label: helpT(x.labelKey, x.label) })));
          }else{
            renderSuggestions();
          }
        }, 150);
        try{ chatInput?.focus?.(); }catch(_err){}
        return;
      }

      answerQuestion(label || chipId);
      try{ chatInput?.focus?.(); }catch(_err){}
    });
  }

  function answerQuestion(q){
    const raw = String(q || "").trim();
    if(!raw) return;
    appendMessage({ role:"user", text: raw });

    if(aiEndpoint){
      askAi(raw).then((reply)=>{
        if(reply) return;
        const typing = appendTyping();
        setTimeout(()=>{ try{ typing?.remove?.(); }catch(_err){} }, 200);
        appendMessage({
          role:"bot",
          html: helpT(
            "help.chat.fallback_html",
            `I can help with shipping, bag sizes, thickness, payments, and monthly usage. Try a quick button below, or visit <a href="./resources.html">Resources</a>.`
          )
        });
        renderSuggestions();
      });
      return;
    }

    const typing = appendTyping();
    const hits = topFaqMatches(raw, 3);
    const best = hits[0] || null;

    setTimeout(()=>{
      try{ typing?.remove?.(); }catch(_err){}

      if(best){
        appendMessage({ role:"bot", html: faqAnswer(best) });
        const followups = Array.isArray(best.followups) ? best.followups : [];
        if(followups.length){
          renderSuggestions(followups.map((x)=> ({ id: x.id, label: helpT(x.labelKey, x.label) })));
        }else{
          renderSuggestions();
        }
        return;
      }

      appendMessage({
        role:"bot",
        html: helpT(
          "help.chat.fallback_html",
          `I can help with shipping, bag sizes, thickness, payments, and monthly usage. Try a quick button below, or visit <a href="./resources.html">Resources</a>.`
        )
      });
      if(hits.length){
        renderSuggestions(hits.map((f)=> ({ id: f.id, label: faqTitle(f) })));
      }else{
        renderSuggestions();
      }
    }, 250);
  }

  function initChat(){
    if(!chatLog || chatLog.childElementCount) return;
    appendMessage({
      role:"bot",
      html: helpT(
        "help.chat.greeting_html",
        `Hi! Ask me about shipping, garment bag sizes, thickness, or monthly packaging planning.`
      )
    });
    renderSuggestions();
  }

  if(chatForm){
    chatForm.addEventListener("submit", (event)=>{
      event.preventDefault();
      const value = String(chatInput?.value || "").trim();
      if(!value) return;
      if(chatInput) chatInput.value = "";
      answerQuestion(value);
      try{ chatInput?.focus?.(); }catch(_err){}
    });
  }

  // Initialize chat once the panel opens.
  if(fab){
    fab.addEventListener("click", ()=>{
      if(panel?.classList.contains("open")){
        initChat();
        if(chatInput) setTimeout(()=> chatInput.focus(), 0);
      }
    });
  }

  if(form){
    form.addEventListener("submit", async (event)=>{
      event.preventDefault();
      const name = String(form.name.value || "").trim();
      const email = String(form.email.value || "").trim();
      const message = String(form.message.value || "").trim();
      if(!name || !email || !message) return;
      const lang = window.PPS_I18N?.getLang?.() || "en";
      const copy = getHelpCopy(lang);
      const sendingText = copy?.sending || (window.PPS_I18N?.t("help.sending") || "Sending...");
      const sentText = copy?.sent || (window.PPS_I18N?.t("help.sent") || "Thanks! We'll be in touch.");
      const errorText = copy?.error || (window.PPS_I18N?.t("help.error") || "Unable to send right now. Please try again.");

      if(status) status.textContent = sendingText;
      const submitBtn = form.querySelector("button[type='submit']");
      if(submitBtn) submitBtn.disabled = true;

      try{
        const apiBase = window.PPS?.API_BASE || window.PPS_API_BASE || "";
        const res = await fetch(`${apiBase}/api/help`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, message })
        });
        const data = await res.json().catch(()=> ({}));
        if(!res.ok || !data.ok){
          throw new Error(data?.message || "Failed");
        }
        if(status) status.textContent = sentText;
        form.reset();
      }catch(err){
        if(status) status.textContent = errorText;
      }finally{
        if(submitBtn) submitBtn.disabled = false;
      }
    });
  }

  window.addEventListener("pps:lang", applyHelpCopy);
}

function setupRetentionSignals(){
  const cartKey = "pps_cart_last_update";
  window.addEventListener("pps:cart", (e)=>{
    try{ localStorage.setItem(cartKey, String(Date.now())); }catch(_err){}
  });

  const cart = window.PPS?.getCart?.() || [];
  const last = Number(localStorage.getItem(cartKey) || 0);
  const hours = last ? (Date.now() - last) / 3600000 : 0;
  if(cart.length && hours > 6){
    if(!document.getElementById("abandonBanner")){
      const banner = document.createElement("div");
      banner.id = "abandonBanner";
      banner.className = "marketing-banner";
      banner.innerHTML = `
        <div class="marketing-banner-inner">
          <strong>Finish your order?</strong>
          <span>We can email your cart and apply a small discount.</span>
          <form id="abandonEmailForm">
            <input class="input" type="email" name="email" placeholder="you@company.com" required>
            <button class="btn btn-primary btn-sm" type="submit">Email my cart</button>
          </form>
          <button class="marketing-banner-close" type="button" aria-label="Close">x</button>
        </div>
      `;
      document.body.appendChild(banner);
      banner.querySelector(".marketing-banner-close")?.addEventListener("click", ()=> banner.remove());
      const form = document.getElementById("abandonEmailForm");
      if(form){
        form.addEventListener("submit", (e)=>{
          e.preventDefault();
          const email = form.email?.value?.trim?.() || "";
          if(!email) return;
          try{ localStorage.setItem("pps_abandon_email", email); }catch(_err){}
          banner.querySelector("span")?.remove?.();
          form.innerHTML = `<span class="muted">Email queued. We will send a reminder.</span>`;
        });
      }
    }
  }

  const lastVisitKey = "pps_last_visit";
  const lastVisit = Number(localStorage.getItem(lastVisitKey) || 0);
  const days = lastVisit ? (Date.now() - lastVisit) / (1000 * 60 * 60 * 24) : 0;
  localStorage.setItem(lastVisitKey, String(Date.now()));
  if(days > 30 && !localStorage.getItem("pps_winback_shown")){
    localStorage.setItem("pps_winback_shown", "true");
    const banner = document.createElement("div");
    banner.className = "marketing-banner winback";
    banner.innerHTML = `
      <div class="marketing-banner-inner">
        <strong>Welcome back!</strong>
        <span>Enjoy a win-back discount on your next bulk order.</span>
        <a class="btn btn-primary btn-sm" href="./specials.html">Claim offer</a>
        <button class="marketing-banner-close" type="button" aria-label="Close">x</button>
      </div>
    `;
    document.body.appendChild(banner);
    banner.querySelector(".marketing-banner-close")?.addEventListener("click", ()=> banner.remove());
  }
}

function showAuthModal(options = {}){
  const existing = document.getElementById("ppsAuthModal");
  if(existing) return;

  const session = window.PPS?.getSession?.();
  if(session){
    window.location.href = "./account.html";
    return;
  }

  const nextUrl = String(options?.nextUrl || "").trim();
  if(nextUrl){
    try{ sessionStorage.setItem("pps_login_next", nextUrl); }catch{ /* ignore */ }
  }

  const overlay = document.createElement("div");
  overlay.className = "pps-modal-overlay open";
  overlay.id = "ppsAuthModal";
  overlay.innerHTML = `
    <div class="pps-modal pps-auth-modal" role="dialog" aria-modal="true" aria-labelledby="ppsAuthTitle">
      <button class="pps-auth-close-x" type="button" aria-label="Close">×</button>
      <div class="pps-auth-layout">
        <div class="pps-auth-left" aria-hidden="true">
          <div class="pps-auth-brand">
            <img src="./assets/poly%20logo%20without%20background.png" alt="Power Poly Supplies" decoding="async">
            <div>PowerPolySupplies.com</div>
          </div>
           <div class="pps-auth-kicker">Canada-wide B2B sourcing</div>
           <h3 class="pps-auth-headline">Order protection and great savings.</h3>
           <div class="pps-auth-subline">Sign in to reorder faster, save multiple delivery addresses, and manage invoices.</div>
           <svg class="pps-auth-illustration pps-van" viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
             <defs>
               <linearGradient id="ppsAuthVanBody" x1="0" y1="0" x2="1" y2="1">
                 <stop offset="0" stop-color="#fff7ed"/>
                 <stop offset="1" stop-color="#ffffff"/>
               </linearGradient>
               <linearGradient id="ppsAuthVanAccent" x1="0" y1="0" x2="1" y2="0">
                 <stop offset="0" stop-color="#ff7a1a"/>
                 <stop offset="1" stop-color="#d94a1f"/>
               </linearGradient>
             </defs>

              <g class="cart-van-bg" aria-hidden="true">
                <g class="cart-van-bg-track">
                  <g opacity=".92">
                    <g opacity=".55">
                      <path d="M6 76V46h22v30H6Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                      <path d="M36 76V34h34v42H36Z" fill="rgba(17,24,39,.04)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                      <path d="M78 76V42h26v34H78Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                      <path d="M112 76V28h30v48h-30Z" fill="rgba(17,24,39,.04)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                      <path d="M150 76V40h28v36h-28Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                    </g>
                    <g opacity=".95">
                      <path d="M18 76V44c0-5 4-9 9-9h12c5 0 9 4 9 9v32H18Z" fill="rgba(17,24,39,.06)" stroke="rgba(17,24,39,.09)" stroke-width="2"/>
                      <path d="M62 76V30c0-6 5-11 11-11h18c6 0 11 5 11 11v46H62Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.08)" stroke-width="2"/>
                      <path d="M118 76V36c0-6 5-11 11-11h12c6 0 11 5 11 11v40h-34Z" fill="rgba(17,24,39,.06)" stroke="rgba(17,24,39,.09)" stroke-width="2"/>
                      <path d="M156 76V26c0-6 5-11 11-11h22c6 0 11 5 11 11v50h-44Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.08)" stroke-width="2"/>
                      <g fill="rgba(240,127,41,.13)">
                        <rect x="26" y="44" width="8" height="8" rx="2"/>
                        <rect x="38" y="44" width="8" height="8" rx="2"/>
                        <rect x="74" y="36" width="9" height="9" rx="2"/>
                        <rect x="88" y="36" width="9" height="9" rx="2"/>
                        <rect x="74" y="50" width="9" height="9" rx="2"/>
                        <rect x="88" y="50" width="9" height="9" rx="2"/>
                        <rect x="128" y="42" width="8" height="8" rx="2"/>
                        <rect x="138" y="42" width="8" height="8" rx="2"/>
                        <rect x="170" y="34" width="10" height="10" rx="2"/>
                        <rect x="184" y="34" width="10" height="10" rx="2"/>
                        <rect x="170" y="48" width="10" height="10" rx="2"/>
                        <rect x="184" y="48" width="10" height="10" rx="2"/>
                      </g>
                    </g>
                    <g class="cart-van-cn" transform="translate(196 8)" opacity=".98">
                      <path d="M8 0v8" stroke="rgba(17,24,39,.18)" stroke-width="2" stroke-linecap="round"/>
                      <path d="M8 8V64" stroke="rgba(17,24,39,.12)" stroke-width="6" stroke-linecap="round"/>
                      <ellipse cx="8" cy="26" rx="13" ry="6.5" fill="rgba(255,255,255,.70)" stroke="rgba(240,127,41,.22)" stroke-width="2"/>
                      <ellipse cx="8" cy="26" rx="4.5" ry="3.5" fill="rgba(17,24,39,.06)"/>
                      <path d="M8 64l-6 8h12l-6-8Z" fill="rgba(17,24,39,.06)" stroke="rgba(17,24,39,.08)" stroke-width="2"/>
                    </g>
                    <g opacity=".9">
                      <path d="M0 86c26-10 54-12 84-6 22-10 48-10 78 0 18-7 42-7 78 0v12H0V86Z" fill="rgba(240,127,41,.10)"/>
                      <path d="M18 28c3-8 10-12 18-10 3-6 12-8 18-4 7-2 14 3 14 11 0 7-6 12-14 12H34c-10 0-18-5-16-9Z" fill="rgba(255,255,255,.55)"/>
                      <path d="M146 24c2-6 8-9 14-8 2-5 9-7 14-4 6-1 11 3 11 9 0 6-5 10-11 10h-31c-8 0-15-4-13-7Z" fill="rgba(255,255,255,.50)"/>
                    </g>
                  </g>
                  <g opacity=".92" transform="translate(240 0)">
                    <g opacity=".55">
                      <path d="M6 76V46h22v30H6Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                      <path d="M36 76V34h34v42H36Z" fill="rgba(17,24,39,.04)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                      <path d="M78 76V42h26v34H78Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                      <path d="M112 76V28h30v48h-30Z" fill="rgba(17,24,39,.04)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                      <path d="M150 76V40h28v36h-28Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.06)" stroke-width="2"/>
                    </g>
                    <g opacity=".95">
                      <path d="M18 76V44c0-5 4-9 9-9h12c5 0 9 4 9 9v32H18Z" fill="rgba(17,24,39,.06)" stroke="rgba(17,24,39,.09)" stroke-width="2"/>
                      <path d="M62 76V30c0-6 5-11 11-11h18c6 0 11 5 11 11v46H62Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.08)" stroke-width="2"/>
                      <path d="M118 76V36c0-6 5-11 11-11h12c6 0 11 5 11 11v40h-34Z" fill="rgba(17,24,39,.06)" stroke="rgba(17,24,39,.09)" stroke-width="2"/>
                      <path d="M156 76V26c0-6 5-11 11-11h22c6 0 11 5 11 11v50h-44Z" fill="rgba(17,24,39,.05)" stroke="rgba(17,24,39,.08)" stroke-width="2"/>
                      <g fill="rgba(240,127,41,.13)">
                        <rect x="26" y="44" width="8" height="8" rx="2"/>
                        <rect x="38" y="44" width="8" height="8" rx="2"/>
                        <rect x="74" y="36" width="9" height="9" rx="2"/>
                        <rect x="88" y="36" width="9" height="9" rx="2"/>
                        <rect x="74" y="50" width="9" height="9" rx="2"/>
                        <rect x="88" y="50" width="9" height="9" rx="2"/>
                        <rect x="128" y="42" width="8" height="8" rx="2"/>
                        <rect x="138" y="42" width="8" height="8" rx="2"/>
                        <rect x="170" y="34" width="10" height="10" rx="2"/>
                        <rect x="184" y="34" width="10" height="10" rx="2"/>
                        <rect x="170" y="48" width="10" height="10" rx="2"/>
                        <rect x="184" y="48" width="10" height="10" rx="2"/>
                      </g>
                    </g>
                    <g class="cart-van-cn" transform="translate(196 8)" opacity=".98">
                      <path d="M8 0v8" stroke="rgba(17,24,39,.18)" stroke-width="2" stroke-linecap="round"/>
                      <path d="M8 8V64" stroke="rgba(17,24,39,.12)" stroke-width="6" stroke-linecap="round"/>
                      <ellipse cx="8" cy="26" rx="13" ry="6.5" fill="rgba(255,255,255,.70)" stroke="rgba(240,127,41,.22)" stroke-width="2"/>
                      <ellipse cx="8" cy="26" rx="4.5" ry="3.5" fill="rgba(17,24,39,.06)"/>
                      <path d="M8 64l-6 8h12l-6-8Z" fill="rgba(17,24,39,.06)" stroke="rgba(17,24,39,.08)" stroke-width="2"/>
                    </g>
                    <g opacity=".9">
                      <path d="M0 86c26-10 54-12 84-6 22-10 48-10 78 0 18-7 42-7 78 0v12H0V86Z" fill="rgba(240,127,41,.10)"/>
                      <path d="M18 28c3-8 10-12 18-10 3-6 12-8 18-4 7-2 14 3 14 11 0 7-6 12-14 12H34c-10 0-18-5-16-9Z" fill="rgba(255,255,255,.55)"/>
                      <path d="M146 24c2-6 8-9 14-8 2-5 9-7 14-4 6-1 11 3 11 9 0 6-5 10-11 10h-31c-8 0-15-4-13-7Z" fill="rgba(255,255,255,.50)"/>
                    </g>
                  </g>
                </g>
                <path d="M0 126H240" stroke="rgba(17,24,39,.10)" stroke-width="10" stroke-linecap="round" opacity=".55"/>
                <ellipse cx="80" cy="126" rx="22" ry="7" fill="rgba(17,24,39,.06)"/>
                <ellipse cx="170" cy="126" rx="22" ry="7" fill="rgba(17,24,39,.06)"/>
               <g class="cart-van-road" aria-hidden="true">
                 <g class="cart-van-road-track">
                   <path d="M10 126h42" stroke="rgba(255,255,255,.65)" stroke-width="4" stroke-linecap="round"/>
                   <path d="M66 126h42" stroke="rgba(255,255,255,.65)" stroke-width="4" stroke-linecap="round"/>
                   <path d="M122 126h42" stroke="rgba(255,255,255,.65)" stroke-width="4" stroke-linecap="round"/>
                   <path d="M178 126h42" stroke="rgba(255,255,255,.65)" stroke-width="4" stroke-linecap="round"/>
                   <g transform="translate(240 0)">
                     <path d="M10 126h42" stroke="rgba(255,255,255,.65)" stroke-width="4" stroke-linecap="round"/>
                     <path d="M66 126h42" stroke="rgba(255,255,255,.65)" stroke-width="4" stroke-linecap="round"/>
                     <path d="M122 126h42" stroke="rgba(255,255,255,.65)" stroke-width="4" stroke-linecap="round"/>
                     <path d="M178 126h42" stroke="rgba(255,255,255,.65)" stroke-width="4" stroke-linecap="round"/>
                   </g>
                 </g>
               </g>
             </g>

             <g class="cart-van-float">
               <path class="cart-van-shadow" d="M32 122c22 8 154 8 176 0" fill="none" stroke="rgba(17,24,39,.10)" stroke-width="10" stroke-linecap="round"/>
 
                <g class="cart-van-lines" fill="none" stroke-linecap="round">
                  <path d="M18 76h22" stroke="rgba(17,24,39,.18)" stroke-width="4"/>
                  <path d="M10 92h30" stroke="rgba(17,24,39,.12)" stroke-width="4"/>
                  <path d="M22 108h18" stroke="rgba(17,24,39,.10)" stroke-width="4"/>
                </g>

               <path d="M58 48h92c12 0 22 8 28 18l14 26c4 8 2 18-6 24-8 6-18 10-30 10H70c-16 0-28-12-28-28V74c0-14 2-26 16-26Z"
                 fill="url(#ppsAuthVanBody)" stroke="rgba(17,24,39,.14)" stroke-width="2.5" />

               <path d="M150 48h22c10 0 20 7 25 16l10 20c4 8 2 18-6 24-7 5-16 8-26 8h-30V60c0-6 4-12 5-12Z"
                 fill="url(#ppsAuthVanBody)" stroke="rgba(17,24,39,.14)" stroke-width="2.5" />

                 <path d="M165 58h20c6 0 11 4 13 10l4 10c1 3-1 6-4 6h-36V58Z"
                   fill="rgba(37,99,235,.10)" stroke="rgba(37,99,235,.20)" stroke-width="2" />

                 <path d="M160 70h6l3 6h-7l-2-6Z"
                   fill="rgba(17,24,39,.10)" stroke="rgba(17,24,39,.16)" stroke-width="1.6" />

                <path d="M68 56h70" stroke="rgba(255,255,255,.92)" stroke-width="4" stroke-linecap="round" opacity=".22"/>
                <path d="M156 56h26" stroke="rgba(255,255,255,.92)" stroke-width="4" stroke-linecap="round" opacity=".18"/>

                <path d="M124 56v46" stroke="rgba(17,24,39,.10)" stroke-width="2" stroke-linecap="round"/>
                <path d="M132 74h10" stroke="rgba(17,24,39,.18)" stroke-width="2" stroke-linecap="round"/>

                 <g class="pps-van-sticker" transform="translate(92 58)" style="filter: drop-shadow(0 10px 16px rgba(17,24,39,.14));">
                   <rect x="0" y="0" width="30" height="30" rx="9" fill="rgba(255,255,255,.92)" stroke="rgba(240,127,41,.45)" stroke-width="1.8"/>
                   <image href="./assets/poly%20logo%20without%20background.png" x="5" y="5" width="20" height="20" preserveAspectRatio="xMidYMid meet"/>
                 </g>

                <circle cx="200" cy="92" r="9" fill="rgba(255,214,120,.20)"/>
                <circle cx="200" cy="92" r="3.4" fill="rgba(255,214,120,.96)" stroke="rgba(240,127,41,.35)" stroke-width="1"/>
 
                <path d="M58 86h156" stroke="url(#ppsAuthVanAccent)" stroke-width="8" stroke-linecap="round" opacity=".9"/>

               <g class="cart-van-wheel cart-van-wheel-left" transform="translate(80 112)">
                 <g class="cart-van-wheel-spin">
                   <circle r="14" fill="#111827" opacity=".86"/>
                   <circle r="7" fill="rgba(255,255,255,.92)"/>
                   <path d="M0-10V10M-10 0H10M-7-7l14 14M-7 7l14-14" stroke="rgba(17,24,39,.35)" stroke-width="2" stroke-linecap="round"/>
                 </g>
               </g>
               <g class="cart-van-wheel cart-van-wheel-right" transform="translate(170 112)">
                 <g class="cart-van-wheel-spin">
                   <circle r="14" fill="#111827" opacity=".86"/>
                   <circle r="7" fill="rgba(255,255,255,.92)"/>
                   <path d="M0-10V10M-10 0H10M-7-7l14 14M-7 7l14-14" stroke="rgba(17,24,39,.35)" stroke-width="2" stroke-linecap="round"/>
                 </g>
               </g>

              </g>
            </svg>
          </div>
 
         <div class="pps-auth-right">
           <h2 id="ppsAuthTitle">Sign in or create account</h2>

          <button class="pps-auth-provider" type="button" data-auth-provider="google" disabled>
            <span class="pps-auth-icon google-icon" aria-hidden="true"></span>
            Continue with Google
          </button>
          <button class="pps-auth-provider" type="button" data-auth-provider="facebook" disabled style="margin-top:10px;">
            <span class="pps-auth-icon facebook-icon" aria-hidden="true"></span>
            Continue with Facebook
          </button>

          <div class="pps-auth-divider">OR</div>

          <form class="pps-auth-form" id="ppsAuthForm">
            <input class="input" type="email" name="email" placeholder="Enter your email address" autocomplete="email" required>
            <div class="password-field">
              <input class="input" type="password" name="password" id="ppsAuthPassword" placeholder="Password" autocomplete="current-password" required>
              <button class="toggle-visibility hidden" type="button" aria-label="Show password" title="Show password" data-toggle="ppsAuthPassword">
                <span class="eye"></span>
              </button>
            </div>
            <button class="btn btn-primary" type="submit" id="ppsAuthContinue">Continue</button>
            <div id="ppsAuthStatus" class="status muted" style="display:none;"></div>
          </form>

          <div class="pps-auth-footer">
            <div class="pps-auth-mini">New here? <a href="./signup.html">Create an account</a></div>
            <div class="pps-auth-mini"><a href="./contact.html">Need help?</a></div>
          </div>

          <div class="pps-auth-mini" style="margin-top:10px;">
            Social sign-in is enabled when OAuth is configured on the backend.
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const modal = overlay.querySelector(".pps-modal");
  const closeBtn = overlay.querySelector(".pps-auth-close-x");
  const statusEl = overlay.querySelector("#ppsAuthStatus");
  const form = overlay.querySelector("#ppsAuthForm");
  const passwordToggle = overlay.querySelector(".toggle-visibility");
  const googleBtn = overlay.querySelector('[data-auth-provider="google"]');
  const facebookBtn = overlay.querySelector('[data-auth-provider="facebook"]');

  const setStatus = (text, type = "muted") => {
    if(!statusEl) return;
    const msg = String(text || "").trim();
    if(!msg){
      statusEl.style.display = "none";
      statusEl.textContent = "";
      return;
    }
    statusEl.style.display = "block";
    statusEl.classList.remove("error","success","muted");
    statusEl.classList.add("status", type || "muted");
    statusEl.textContent = msg;
  };

  const close = () => {
    try{ document.removeEventListener("keydown", onKey); }catch{ /* ignore */ }
    overlay.classList.remove("open");
    setTimeout(()=> overlay.remove(), 160);
  };

  const normalizeLoginStatus = (message) => {
    const raw = String(message || "");
    if(!raw) return "";
    if(raw.includes("Supabase not configured")){
      return window.PPS_I18N?.t("login.status.unavailable") || "Login temporarily unavailable. Please try again later.";
    }
    return raw;
  };

  const login = async (email, password) => {
    const apiBase = window.PPS?.API_BASE || "";
    if(!apiBase){
      setStatus("Backend API not configured.", "error");
      return;
    }
    setStatus(window.PPS_I18N?.t("login.status.signing") || "Signing in...", "muted");
    const submitBtn = overlay.querySelector("#ppsAuthContinue");
    if(submitBtn) submitBtn.disabled = true;

    try{
      const res = await fetch(`${apiBase}/api/auth/login`,{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(()=> ({}));
      if(res.ok && data.ok && data.token){
        const lowerEmail = String(data.email || email).trim().toLowerCase();
        let profile = {};
        try{
          profile = JSON.parse(localStorage.getItem(`pps_profile_${lowerEmail}`) || "{}");
        }catch{
          profile = {};
        }
        window.PPS?.setSession?.({
          token: data.token,
          email: lowerEmail,
          name: data.name || "",
          phone: String(profile?.phone || ""),
          province: String(profile?.province || ""),
          expiresAt: data.expiresAt
        });
        try{
          window.PPS_ACTIVITY?.record?.("login", { email: lowerEmail });
        }catch{
          // ignore
        }

        let next = "";
        try{ next = String(sessionStorage.getItem("pps_login_next") || "").trim(); }catch{ next = ""; }
        try{ sessionStorage.removeItem("pps_login_next"); }catch{ /* ignore */ }

        // Prefer returning the user to where they were (eg. checkout), otherwise go to account.
        const safeNext = next && !/\/login\.html(\?|#|$)/i.test(next) ? next : "";
        window.location.href = safeNext || "./account.html";
      }else{
        const normalized = normalizeLoginStatus(data?.message);
        setStatus(normalized || (window.PPS_I18N?.t("login.status.failed") || "Login failed."), "error");
      }
    }catch{
      setStatus(window.PPS_I18N?.t("login.status.unreachable") || "Server unreachable. Is the backend running?", "error");
    }finally{
      if(submitBtn) submitBtn.disabled = false;
    }
  };

  const startOauth = (provider)=>{
    const apiBase = window.PPS?.API_BASE || "";
    if(!apiBase){
      setStatus("Backend API not configured.", "error");
      return;
    }
    const next = (()=>{
      try{ return String(sessionStorage.getItem("pps_login_next") || "").trim() || window.location.href; }catch{ return window.location.href; }
    })();
    const url = `${apiBase}/api/auth/oauth/${encodeURIComponent(provider)}/start?next=${encodeURIComponent(next)}`;
    window.location.href = url;
  };

  const refreshOauthButtons = async ()=>{
    const apiBase = window.PPS?.API_BASE || "";
    if(!apiBase) return;
    try{
      const res = await fetch(`${apiBase}/api/auth/oauth/status`, { cache:"no-store" });
      const data = await res.json().catch(()=> ({}));
      const googleOk = !!data?.providers?.google?.configured;
      const fbOk = !!data?.providers?.facebook?.configured;
      if(googleBtn) googleBtn.disabled = !googleOk;
      if(facebookBtn) facebookBtn.disabled = !fbOk;
    }catch{
      // Keep disabled on failure.
      if(googleBtn) googleBtn.disabled = true;
      if(facebookBtn) facebookBtn.disabled = true;
    }
  };

  const setToggleLabel = (btn, fieldType) => {
    const show = window.PPS_I18N?.t("signup.password.show") || "Show password";
    const hide = window.PPS_I18N?.t("signup.password.hide") || "Hide password";
    const text = fieldType === "password" ? show : hide;
    btn.setAttribute("aria-label", text);
    btn.setAttribute("title", text);
  };

  if(passwordToggle){
    setToggleLabel(passwordToggle, "password");
    passwordToggle.addEventListener("click", (event)=>{
      const btn = event.currentTarget;
      const id = btn.dataset.toggle;
      const field = document.getElementById(id);
      if(!field) return;
      const nextType = field.type === "password" ? "text" : "password";
      field.type = nextType;
      setToggleLabel(btn, nextType);
      btn.classList.toggle("visible", nextType === "text");
      btn.classList.toggle("hidden", nextType === "password");
    });
  }

  if(closeBtn) closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event)=>{
    if(event.target === overlay) close();
  });
  function onKey(event){
    if(event.key !== "Escape") return;
    close();
  }
  document.addEventListener("keydown", onKey);

  if(form){
    form.addEventListener("submit", (event)=>{
      event.preventDefault();
      const email = String(form.email?.value || "").trim();
      const password = String(form.password?.value || "");
      if(!email || !password){
        setStatus(window.PPS_I18N?.t("login.status.missing") || "Enter email and password.", "error");
        return;
      }
      login(email, password);
    });
  }

  if(googleBtn){
    googleBtn.addEventListener("click", ()=> startOauth("google"));
  }
  if(facebookBtn){
    facebookBtn.addEventListener("click", ()=> startOauth("facebook"));
  }

  refreshOauthButtons();

  // Focus first input for fast login.
  const firstInput = overlay.querySelector('input[name="email"]');
  if(firstInput) setTimeout(()=> firstInput.focus(), 0);

  // Prevent background scroll while open.
  document.documentElement.style.overflow = "hidden";
  const restoreScroll = ()=>{ document.documentElement.style.overflow = ""; };
  // Fallback restore when closed.
  const observer = new MutationObserver(()=>{
    if(!document.getElementById("ppsAuthModal")){
      observer.disconnect();
      restoreScroll();
    }
  });
  observer.observe(document.body, { childList:true });
}

function handleOauthReturn(){
  let params = null;
  try{
    params = new URLSearchParams(window.location.search);
  }catch{
    return;
  }
  if(!params) return;
  const marker = String(params.get("pps_oauth") || "").trim();
  const token = String(params.get("token") || "").trim();
  if(marker !== "1" || !token) return;

  const ok = String(params.get("ok") || "").trim();
  const message = String(params.get("message") || "").trim();
  const email = String(params.get("email") || "").trim().toLowerCase();
  const name = String(params.get("name") || "").trim();
  const expiresAt = Number(params.get("expiresAt") || 0) || 0;
  const next = String(params.get("next") || "").trim();

  // Clear the sensitive params from the URL immediately.
  try{
    const url = new URL(window.location.href);
    ["pps_oauth","provider","ok","token","email","name","expiresAt","message","next"].forEach((k)=> url.searchParams.delete(k));
    window.history.replaceState({}, "", url.toString());
  }catch{
    // ignore
  }

  if(ok !== "1"){
    // If OAuth failed, bounce to login page with a minimal message.
    try{
      if(message){
        sessionStorage.setItem("pps_login_error", message);
      }
    }catch{
      // ignore
    }
    if(!/\/login\.html(\?|#|$)/i.test(String(window.location.pathname || ""))){
      window.location.href = "./login.html";
    }
    return;
  }

  try{
    window.PPS?.setSession?.({
      token,
      email,
      name,
      phone: "",
      province: "",
      expiresAt: expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
  }catch{
    // ignore
  }

  // Prefer returning the user to where they were (eg. checkout), otherwise go to account.
  const safeNext = (()=>{
    if(!next) return "";
    if(next.startsWith("/") && !next.startsWith("//")) return next;
    try{
      const u = new URL(next, window.location.origin);
      if(u.origin !== window.location.origin) return "";
      return u.pathname + u.search + u.hash;
    }catch{
      return "";
    }
  })();

  window.location.href = safeNext || "./account.html";
}

function setupAuthModalTriggers(){
  const accountLink = document.querySelector('a[href="./login.html"]');
  if(accountLink){
    accountLink.addEventListener("click", (event)=>{
      const session = window.PPS?.getSession?.();
      if(session) return;
      event.preventDefault();
      // When a user clicks "Account" they expect the dashboard, not a return to the current page.
      showAuthModal({ nextUrl: "./account.html" });
    });
  }

  // If someone lands on login.html directly, show the modal on top for the same experience.
  try{
    const path = String(window.location.pathname || "").toLowerCase();
    if(path.endsWith("/login.html")){
      const session = window.PPS?.getSession?.();
      if(!session) showAuthModal({ nextUrl: "./account.html" });
    }
  }catch{
    // ignore
  }
}

function setupTopProgressBar(){
  const existing = document.getElementById("ppsTopProgress");
  if(existing) return existing;

  const wrap = document.createElement("div");
  wrap.className = "pps-top-progress";
  wrap.id = "ppsTopProgress";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = `<div class="pps-top-progress__bar"></div>`;

  // Prefer placing it before sticky header so it stays visually "on top".
  document.body.insertAdjacentElement("afterbegin", wrap);
  return wrap;
}

function createTopProgressController(){
  const wrap = setupTopProgressBar();
  const bar = wrap.querySelector(".pps-top-progress__bar");
  if(!bar) return null;

  let rafId = 0;
  let current = 0;
  let target = 0;
  let hidingTimer = 0;

  const clamp01 = (n)=> Math.max(0, Math.min(1, n));

  const render = ()=>{
    bar.style.transform = `scaleX(${current.toFixed(4)})`;
  };

  const stopRaf = ()=>{
    if(rafId){
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const tick = ()=>{
    // Ease towards target with a small constant drift (feels like loading).
    const delta = (target - current) * 0.16 + 0.0025;
    current = clamp01(current + Math.max(0, delta));
    render();

    if(current + 0.002 < target){
      rafId = requestAnimationFrame(tick);
    }else{
      stopRaf();
    }
  };

  const show = ()=>{
    clearTimeout(hidingTimer);
    wrap.classList.add("active");
  };

  const hide = ()=>{
    wrap.classList.remove("active");
  };

  const start = (initial = 0.08)=>{
    show();
    current = Math.max(current, clamp01(initial));
    target = Math.max(target, 0.82);
    render();
    if(!rafId) rafId = requestAnimationFrame(tick);
  };

  const set = (value)=>{
    show();
    current = clamp01(value);
    target = Math.max(target, current);
    render();
  };

  const done = ()=>{
    show();
    stopRaf();
    current = 1;
    target = 1;
    render();
    clearTimeout(hidingTimer);
    hidingTimer = setTimeout(()=>{
      hide();
      // Reset after fade so the next start doesn't jump.
      setTimeout(()=>{
        current = 0;
        target = 0;
        render();
      }, 170);
    }, 160);
  };

  return { start, set, done };
}

function setupPageTransitionProgress(){
  const controller = createTopProgressController();
  if(!controller) return;

  const NAV_FLAG = "pps_nav_progress";

  const markNextPage = ()=>{
    try{ sessionStorage.setItem(NAV_FLAG, String(Date.now())); }catch(_err){}
  };

  const consumeNavFlag = ()=>{
    try{
      const raw = sessionStorage.getItem(NAV_FLAG);
      if(!raw) return false;
      sessionStorage.removeItem(NAV_FLAG);
      const ts = Number(raw) || 0;
      return ts > 0 && (Date.now() - ts) < 10000;
    }catch(_err){
      return false;
    }
  };

  // If we arrived here from a click on a previous page, show immediately.
  if(consumeNavFlag()){
    controller.start(0.14);
  }

  // Start on internal link navigation (capture so we run before the browser leaves).
  document.addEventListener("click", (event)=>{
    if(event.defaultPrevented) return;
    if(event.button !== 0) return;
    if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if(!(target instanceof Node)) return;
    const link = target.closest?.("a");
    if(!link) return;
    if(link.hasAttribute("download")) return;
    const href = String(link.getAttribute("href") || "").trim();
    if(!href) return;
    if(href.startsWith("#")) return;
    if(/^mailto:/i.test(href) || /^tel:/i.test(href) || /^javascript:/i.test(href)) return;

    const targetAttr = String(link.getAttribute("target") || "").trim();
    if(targetAttr && targetAttr !== "_self") return;

    let url = null;
    try{
      url = new URL(href, window.location.href);
    }catch(_err){
      return;
    }
    if(!url || url.origin !== window.location.origin) return;

    // Same-page hash jumps shouldn't show a loader.
    const samePath = url.pathname === window.location.pathname && url.search === window.location.search;
    if(samePath && url.hash) return;

    controller.start(0.08);
    markNextPage();
  }, true);

  // Start on form submissions that navigate away (ex: search).
  document.addEventListener("submit", (event)=>{
    if(event.defaultPrevented) return;
    const form = event.target;
    if(!(form instanceof HTMLFormElement)) return;

    const action = String(form.getAttribute("action") || window.location.href).trim();
    if(!action) return;
    if(/^javascript:/i.test(action)) return;

    let url = null;
    try{
      url = new URL(action, window.location.href);
    }catch(_err){
      return;
    }
    if(url.origin !== window.location.origin) return;

    controller.start(0.08);
    markNextPage();
  }, true);

  // Finish when the page finishes loading.
  const finish = ()=> controller.done();
  window.addEventListener("load", finish);
  window.addEventListener("pageshow", (e)=>{
    if(e && e.persisted) finish();
  });
  if(document.readyState === "complete"){
    setTimeout(finish, 0);
  }
}

// Run ASAP so login.html doesn't render before the redirect.
handleOauthReturn();

// Setup transition progress as soon as the UI script is loaded.
setupPageTransitionProgress();

window.addEventListener("DOMContentLoaded", ()=>{
  try{
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(()=>{});
    }
  }catch{
    // ignore
  }
  try{
    if(!document.querySelector('link[rel="manifest"]')){
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "./manifest.webmanifest";
      document.head.appendChild(link);
    }
    if(!document.querySelector('meta[name="theme-color"]')){
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#ff7a1a";
      document.head.appendChild(meta);
    }
  }catch{
    // ignore
  }
  decoratePromoTagline();
  setupNavbar();
  setupFadeIn();
  setupStickyHeader();
  setupAnalytics();
  setupJourneyTracking();
  syncAccountLink();
  setupAuthModalTriggers();
  injectResourcesDropdown();
  injectAboutDropdown();
  injectLangSwitcher();
  injectCurrencySwitcher();
  injectNotificationsBell();
  injectMiniCartPreview();
  injectCartSidebar();
  setupSearch();
  setupCountUp();
  injectBottomNav();
  setupBottomNavSearch();
  setupInteractiveTools();
  injectFooter();
  injectHelpWidget();
  setupRetentionSignals();
  scheduleLanguagePrompt();
});

// Expose to pages that render footers dynamically after load
window.injectFooter = injectFooter;
