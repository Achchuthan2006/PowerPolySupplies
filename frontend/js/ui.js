function setupNavbar(){
  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");
  const dropdown = document.querySelector(".dropdown");
  const dropBtn = document.querySelector(".dropbtn");

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
      dropdown?.classList.remove("open");
    });
  }

  // Mobile dropdown toggle
  if(dropBtn && dropdown){
    dropBtn.addEventListener("click", ()=>{
      dropdown.classList.toggle("open");
    });
  }
}

function setupFadeIn(){
  const els = document.querySelectorAll(".fade-in");
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting) e.target.classList.add("show");
    });
  }, { threshold: 0.12 });

  els.forEach(el=>io.observe(el));
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
            Achchu <a href="tel:+16475704878">647-570-4878</a>
          </div>
          <div class="footer-contact-row">
            <span class="footer-inline-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6.6 2.9c.6-.6 1.6-.7 2.3-.2l3 2a1.8 1.8 0 0 1 .6 2.3l-1.1 2.2a1 1 0 0 0 .2 1.2l2.8 2.8a1 1 0 0 0 1.2.2l2.2-1.1a1.8 1.8 0 0 1 2.3.6l2 3a1.8 1.8 0 0 1-.2 2.3l-1.3 1.3c-.8.8-2 1.2-3.1 1-3.1-.5-6.2-2.2-9.1-5.1S2.3 9.7 1.8 6.6c-.2-1.1.2-2.3 1-3.1z"/></svg>
            </span>
            Andrew <a href="tel:+14374256638">437-425-6638</a>
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
            <a class="footer-icon" aria-label="LinkedIn" href="#" title="LinkedIn">
              <svg viewBox="0 0 24 24"><path d="M6.5 19h-3V9h3zm-1.5-12A1.75 1.75 0 1 1 6.75 5.25 1.75 1.75 0 0 1 5 7ZM20.5 19h-3v-5.1c0-1.22-.46-2.05-1.5-2.05-.82 0-1.3.55-1.52 1.08-.08.19-.1.46-.1.73V19h-3s.04-8.15 0-9h3v1.3a3 3 0 0 1 2.72-1.5c1.98 0 3.4 1.29 3.4 4.05z"/></svg>
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
          <span data-i18n="footer.secure">Secure payments via Square</span>
        </div>
      </div>
  `;
  footer.remove();
  document.body.appendChild(newFooter);
  window.PPS_I18N?.applyTranslations?.();

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
          return `<button type="button" data-cat="${item.value}">${item.label}</button>`;
        }
        return `<button type="button" data-slug="${item.value}">${item.label}</button>`;
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
        label: p.name
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

  function setOpen(open){
    if(!fab || !panel) return;
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    panel.classList.toggle("open", open);
  }

  if(fab){
    fab.addEventListener("click", ()=> setOpen(!panel.classList.contains("open")));
  }
  if(closeBtn){
    closeBtn.addEventListener("click", ()=> setOpen(false));
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

window.addEventListener("DOMContentLoaded", ()=>{
  setupNavbar();
  setupFadeIn();
  syncAccountLink();
  injectLangSwitcher();
  injectCurrencySwitcher();
  setupSearch();
  injectFooter();
  injectHelpWidget();
});

// Expose to pages that render footers dynamically after load
window.injectFooter = injectFooter;
