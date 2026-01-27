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
    dropBtn.addEventListener("click", ()=>{
      dropdown.classList.toggle("open");
    });
  });
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
  const langOptions = (document.documentElement?.dataset?.langOptions || "en,fr,es,ko,hi,ta")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const langLabels = {
    en: "English",
    fr: "French",
    es: "Spanish",
    ko: "Korean",
    hi: "Hindi",
    ta: "Tamil"
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
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="ko">한국어</option>
            <option value="hi">हिन्दी</option>
            <option value="ta">தமிழ்</option>
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
    const lang = String(select?.value || "en").trim() || "en";
    try{ localStorage.setItem("pps_lang_prompt_dismissed", "1"); }catch(err){}
    try{ window.PPS_I18N?.setLang?.(lang); }catch(err){ /* ignore */ }
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

function injectResourcesNavLink(){
  const navLinks = document.getElementById("navLinks");
  if(!navLinks) return;
  if(navLinks.querySelector('a[href="./resources.html"]')) return;

  const link = document.createElement("a");
  link.href = "./resources.html";
  link.setAttribute("data-i18n", "nav.resources");
  link.textContent = "Resources";

  const anchorAfter = navLinks.querySelector('a[href="./specials.html"]');
  if(anchorAfter && anchorAfter.parentElement === navLinks){
    anchorAfter.insertAdjacentElement("afterend", link);
    try{ window.PPS_I18N?.applyTranslations?.(); }catch{}
    return;
  }
  navLinks.appendChild(link);
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
    <button class="dropbtn" type="button"><span data-i18n="nav.about">About Us</span> <span class="caret" aria-hidden="true"></span></button>
    <div class="dropdown-menu">
      <a href="./about.html" data-i18n="nav.about_overview">About Power Poly Supplies</a>
      <a href="./about.html#why" data-i18n="nav.about_why">Why Power Poly</a>
      <a href="./about.html#sectors" data-i18n="nav.about_sectors">Sectors we serve</a>
      <a href="./about.html#quality" data-i18n="nav.about_quality">Quality promise</a>
      <a href="./about.html#contacts" data-i18n="nav.about_contacts">Contacts</a>
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
          <div class="footer-newsletter">
            <div class="footer-newsletter-title">Get updates & specials</div>
            <form class="newsletter-form" id="newsletterForm">
              <input class="input" type="email" name="email" placeholder="Email address" aria-label="Email address" required>
              <button class="btn btn-primary btn-sm" type="submit">Subscribe</button>
            </form>
            <div class="newsletter-note" id="newsletterNote">No spam. 1–2 emails/month.</div>
          </div>
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

  const newsletterForm = document.getElementById("newsletterForm");
  const newsletterNote = document.getElementById("newsletterNote");
  if(newsletterForm && newsletterNote){
    newsletterForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const email = String(newsletterForm.email?.value || "").trim();
      if(!email) return;
      try{
        const key = "pps_newsletter_email_v1";
        localStorage.setItem(key, email);
      }catch(_err){
        // ignore
      }
      newsletterNote.textContent = "Thanks! You're on the list.";
      newsletterForm.reset();
    });
  }

  // Reveal animation when footer comes into view
  const io = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting) newFooter.classList.add("reveal");
    });
  }, { threshold: 0.2 });
  io.observe(newFooter);
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
        const meta = [item.category, item.price, item.stockLabel].filter(Boolean).join(" · ");
        return `<button type="button" data-slug="${item.value}" class="suggestion suggestion-product">
          ${img}
          <span class="suggestion-text">
            <span class="suggestion-title">${item.label}</span>
            <span class="suggestion-meta">${meta}</span>
          </span>
        </button>`;
      }).join("");
      box.hidden = false;
    };

    input.addEventListener("input", async ()=>{
      const query = normalizeSearchText(input.value);
      if(!query){
        hideBox();
        return;
      }
      const products = await ensureProducts();
      const matches = products.filter(p=>{
        const name = normalizeSearchText(p.name);
        const slug = normalizeSearchText(p.slug);
        const cat = normalizeSearchText(p.category);
        return name.includes(query) || slug.includes(query) || cat.includes(query);
      });
      const productItems = matches.slice(0, 8).map(p=>({
        type: "product",
        value: p.slug,
        label: p.name,
        image: p.image,
        category: p.category,
        price: window.PPS?.money ? PPS.money(PPS.getTieredPriceCents?.(p, 1) ?? p.priceCents, p.currency) : "",
        stockLabel: p.stock <= 0 ? (window.PPS_I18N?.t("products.stock.out") || "Out of stock") : p.stock <= 10 ? (window.PPS_I18N?.t("products.stock.low") || "Almost out") : (window.PPS_I18N?.t("products.stock.in") || "In stock")
      }));

      const categories = Array.from(new Set(products.map(p=>p.category).filter(Boolean)));
      const categoryItems = categories
        .filter(cat=>normalizeSearchText(cat).includes(query))
        .slice(0, 3)
        .map(cat=>({
          type: "category",
          value: cat,
          label: cat
        }));

      renderSuggestions([...productItems, ...categoryItems]);
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
      if(target.matches("button[data-slug]")){
        const slug = target.getAttribute("data-slug");
        if(slug){
          window.location.href = `./product.html?slug=${encodeURIComponent(slug)}`;
        }
      }else if(target.matches("button[data-cat]")){
        const cat = target.getAttribute("data-cat");
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

function setupExitIntentOffer(){
  const prefersReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const isMobile = window.matchMedia?.("(max-width: 860px)")?.matches;
  if(isMobile) return;

  const key = "pps_exit_offer_v1";
  let dismissed = false;
  try{
    dismissed = localStorage.getItem(key) === "1";
  }catch(_err){
    dismissed = false;
  }
  if(dismissed) return;

  const overlay = document.createElement("div");
  overlay.className = "pps-modal-overlay";
  overlay.id = "exitOffer";
  overlay.innerHTML = `
    <div class="pps-modal" role="dialog" aria-modal="true" aria-label="Special offer">
      <div class="pps-modal-header">
        <div>
          <div class="pps-modal-title">Get 10% off your first order</div>
          <div class="pps-modal-subtitle">Use this code at checkout or mention it in your bulk quote request.</div>
        </div>
        <button class="pps-modal-close" type="button" aria-label="Close" data-close>×</button>
      </div>
      <div class="pps-modal-body">
        <div class="offer-code-row">
          <div class="offer-code" id="offerCode">WELCOME10</div>
          <button class="btn btn-primary btn-sm" type="button" id="copyOffer">Copy</button>
        </div>
        <div id="offerMsg" style="color:var(--muted); font-size:13px; margin-top:8px;"></div>
        <div class="pps-modal-row" style="margin-top:14px;">
          <a class="btn btn-primary" href="./products.html">Shop now</a>
          <a class="btn btn-outline" href="./contact.html">Get a bulk quote</a>
        </div>
      </div>
    </div>
  `;

  const close = ()=>{
    overlay.remove();
    try{ localStorage.setItem(key, "1"); }catch(_err){}
  };

  overlay.addEventListener("click", (e)=>{
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;
    if(t.hasAttribute("data-close")) close();
    if(t === overlay) close();
  });

  const show = ()=>{
    if(document.getElementById("exitOffer")) return;
    document.body.appendChild(overlay);
    overlay.classList.add("open");
    const btn = document.getElementById("copyOffer");
    const msg = document.getElementById("offerMsg");
    btn?.addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText("WELCOME10");
        if(msg) msg.textContent = "Copied to clipboard.";
      }catch(_err){
        if(msg) msg.textContent = "Copy manually: WELCOME10";
      }
    });
    // Focus close for accessibility
    overlay.querySelector(".pps-modal-close")?.focus?.();
  };

  const handler = (e)=>{
    if(e.clientY > 0) return;
    document.removeEventListener("mouseout", handler);
    show();
  };
  document.addEventListener("mouseout", handler);
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
        <button class="help-close" type="button" id="helpClose" aria-label="Close">X</button>
      </div>
      <div class="help-panel-body">
        <div class="help-tabs" role="tablist" aria-label="Help options">
          <button class="help-tab active" type="button" role="tab" aria-selected="true" data-help-tab="faq">Quick answers</button>
          <button class="help-tab" type="button" role="tab" aria-selected="false" data-help-tab="message">Message us</button>
        </div>

        <div class="help-tab-panels">
          <div class="help-tab-panel open" data-help-panel="faq" role="tabpanel">
            <div class="help-chat">
              <div class="help-chat-log" id="helpChatLog" aria-live="polite"></div>
              <div class="help-suggestions" id="helpChatSuggestions" aria-label="Suggested questions"></div>
              <form class="help-chat-input" id="helpChatForm">
                <input class="input" id="helpChatInput" placeholder="Ask a question (shipping, sizes, thickness...)" autocomplete="off">
                <button class="btn btn-primary" type="submit">Send</button>
              </form>
              <div class="help-chat-footer">
                <a class="btn btn-outline btn-sm" href="https://chat.whatsapp.com/LVaouedAZVIEcgrD6nj2hC" target="_blank" rel="noopener">WhatsApp</a>
                <a class="btn btn-outline btn-sm" href="./resources.html">Resources</a>
                <a class="btn btn-outline btn-sm" href="./contact.html">Contact</a>
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

  const FAQ = [
    {
      id: "shipping",
      title: "Shipping / delivery",
      match: (q)=> /ship|shipping|deliver|delivery|gta|outside|charge|charges|cost/i.test(q),
      answer: () => `Standard GTA delivery is free. Express and non‑GTA delivery charges are confirmed by our team after we review the order and address.<br><a href="./legal-shipping.html">Read Shipping & Returns</a>`
    },
    {
      id: "sizes",
      title: "Garment bag sizes",
      match: (q)=> /size|sizing|garment bag|cover bag|length|width|measure/i.test(q),
      answer: () => `Use garment width + 4–6" and garment length + 4–8" as a quick rule. For bulky coats, consider a wider/gusseted bag.<br><a href="./resources.html#guide-garment-bag-sizes">Read the sizing guide</a>`
    },
    {
      id: "thickness",
      title: "Heavy vs Extra Heavy",
      match: (q)=> /heavy|extra heavy|thick|thickness|mil|gauge|tear|puncture/i.test(q),
      answer: () => `Choose <b>Heavy</b> for everyday packaging. Choose <b>Extra Heavy</b> for sharp corners, heavy loads, delivery routes, or fewer tears/rewraps.<br><a href="./resources.html#heavy-vs-extra-heavy">Read the thickness guide</a>`
    },
    {
      id: "usage",
      title: "Monthly packaging usage",
      match: (q)=> /month|monthly|how much|usage|estimate|planning|plan/i.test(q),
      answer: () => `A simple estimate: (garments/day) × (operating days/month), then add a 5–12% buffer for rewraps/tears/rush orders.<br><a href="./resources.html#dry-cleaner-packaging-usage">See the planner</a>`
    },
    {
      id: "pay",
      title: "Payment options",
      match: (q)=> /pay|payment|square|card|invoice|pay later/i.test(q),
      answer: () => `You can pay online with Square or place the order now and pay later after fulfillment is confirmed. Start checkout to see both options.<br><a href="./checkout.html">Go to checkout</a>`
    },
    {
      id: "addresses",
      title: "Saved delivery addresses",
      match: (q)=> /address|addresses|multiple locations|warehouse|branch|default/i.test(q),
      answer: () => `Business customers can save multiple delivery addresses (Main Store, Warehouse, Branch) and set a default for faster checkout.<br><a href="./account.html#addresses">Manage addresses</a>`
    }
  ];

  function renderSuggestions(){
    if(!chatSuggestions) return;
    const items = [
      { id:"sizes", label:"Choosing garment bag sizes" },
      { id:"thickness", label:"Heavy vs Extra Heavy thickness" },
      { id:"usage", label:"How much packaging per month?" },
      { id:"shipping", label:"Shipping / delivery" },
      { id:"pay", label:"Payments / pay later" }
    ];
    chatSuggestions.innerHTML = items
      .map((it)=> `<button type="button" class="help-chip" data-help-chip="${esc(it.id)}">${esc(it.label)}</button>`)
      .join("");
    chatSuggestions.addEventListener("click", (e)=>{
      const btn = e.target?.closest?.("[data-help-chip]");
      if(!btn) return;
      const id = btn.getAttribute("data-help-chip");
      const found = FAQ.find((x)=> x.id === id);
      if(!found) return;
      appendMessage({ role:"user", text: btn.textContent });
      appendMessage({ role:"bot", html: found.answer() });
    }, { once:true });
  }

  function answerQuestion(q){
    const raw = String(q || "").trim();
    if(!raw) return;
    appendMessage({ role:"user", text: raw });
    const hit = FAQ.find((item)=> item.match(raw));
    if(hit){
      appendMessage({ role:"bot", html: hit.answer() });
      return;
    }
    appendMessage({
      role:"bot",
      html: `I can help with shipping, bag sizes, thickness, and monthly usage. Try one of the quick buttons below, or visit <a href="./resources.html">Resources</a>.`
    });
  }

  function initChat(){
    if(!chatLog || chatLog.childElementCount) return;
    appendMessage({
      role:"bot",
      html: `Hi! Ask me about shipping, garment bag sizes, thickness, or monthly packaging planning.`
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
          <img class="pps-auth-illustration" src="./assets/auth-illustration.svg" alt="" loading="lazy" decoding="async">
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
      showAuthModal({ nextUrl: window.location.href });
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

// Run ASAP so login.html doesn't render before the redirect.
handleOauthReturn();

window.addEventListener("DOMContentLoaded", ()=>{
  try{
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(()=>{});
    }
  }catch{
    // ignore
  }
  setupNavbar();
  setupFadeIn();
  setupStickyHeader();
  syncAccountLink();
  setupAuthModalTriggers();
  injectResourcesNavLink();
  injectAboutDropdown();
  injectLangSwitcher();
  injectCurrencySwitcher();
  injectNotificationsBell();
  setupSearch();
  setupCountUp();
  setupExitIntentOffer();
  injectBottomNav();
  setupBottomNavSearch();
  injectFooter();
  injectHelpWidget();
  scheduleLanguagePrompt();
});

// Expose to pages that render footers dynamically after load
window.injectFooter = injectFooter;
