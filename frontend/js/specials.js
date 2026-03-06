(() => {
  "use strict";

  const tt = (key, fallback) => {
    try {
      return window.PPS_I18N?.t?.(key) || fallback;
    } catch {
      return fallback;
    }
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function hashString(str) {
    const s = String(str || "");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function offerEndsAt(product) {
    const now = Date.now();
    const days = 7 + (hashString(product?.id || product?.slug || "") % 15); // 7-21 days
    const d = new Date(now + days * 24 * 60 * 60 * 1000);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function formatEndsDate(ms) {
    try {
      const d = new Date(ms);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  function formatCountdown(msLeft) {
    const total = Math.max(0, Math.floor(msLeft / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${Math.max(0, mins)}m`;
  }

  function categoryLabel(category) {
    const lang = window.PPS_I18N?.getLang?.() || "en";
    if (lang === "fr") {
      const map = {
        "Garment Bags": "Housses de vetements",
        "Hangers": "Cintres",
        "Polybags": "Sacs en poly"
      };
      return map[category] || category || "";
    }
    if (lang === "ko") {
      const map = {
        "Garment Bags": "Garment Bags",
        "Hangers": "Hangers",
        "Polybags": "Polybags"
      };
      return map[category] || category || "";
    }
    if (lang === "es") {
      const map = {
        "Garment Bags": "Bolsas para prendas",
        "Hangers": "Ganchos",
        "Polybags": "Bolsas de polietileno"
      };
      return map[category] || category || "";
    }
    return category || "";
  }

  function packPillHtml(category){
    const cat = String(category || "");
    if(cat !== "Hangers") return "";
    const label = tt("pack.label", "Pack");
    const pack = tt("pack.hangers_500", "500 pcs / box");
    return `
      <div class="feature-badges" aria-label="${label}">
        <span class="feature-pill">${pack}</span>
      </div>
    `;
  }

  function stockClass(stock) {
    if (stock <= 0) return "out";
    if (stock <= 10) return "low";
    return "in";
  }

  function stockLabel(stock) {
    if (stock <= 0) return tt("specials.stock.out", "Out of stock");
    if (stock <= 10) return tt("specials.stock.low", "Almost out of stock");
    return tt("specials.stock.in", "In stock");
  }

  const heartIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.7-4.4-9.5-7.2A5.6 5.6 0 0 1 12 5.6a5.6 5.6 0 0 1 9.5 8.2C18.7 16.6 12 21 12 21z"/></svg>';

  function favoriteTitle(active) {
    return active ? tt("favorite.remove", "Remove from favorites") : tt("favorite.add", "Add to favorites");
  }

  function favoriteButton(productId) {
    const active = window.PPS?.isFavorite?.(productId);
    return `<button class="favorite-btn ${active ? "active" : ""}" type="button" data-fav-id="${productId}" aria-pressed="${active ? "true" : "false"}" title="${favoriteTitle(active)}">${heartIcon}</button>`;
  }

  function syncFavoriteButton(btn) {
    const id = btn.dataset.favId;
    const active = window.PPS?.isFavorite?.(id);
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.title = favoriteTitle(active);
  }

  function setupFavorites() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".favorite-btn");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      window.PPS?.toggleFavorite?.(btn.dataset.favId);
      syncFavoriteButton(btn);
    });
    window.addEventListener("pps:favorites", () => {
      document.querySelectorAll(".favorite-btn").forEach(syncFavoriteButton);
    });
  }

  function renderSkeletons(grid, count = 8) {
    grid.innerHTML = new Array(count).fill(0).map(() => `<div class="card skeleton"></div>`).join("");
  }

  function computeDeal(p) {
    const compareCents = window.PPS.getComparePriceCents?.(p) ?? ((Number(p.priceCents) || 0) + 1000);
    const memberCents = Number(p.priceCents) || 0;
    const savingsCents = Math.max(0, compareCents - memberCents);
    const pct = compareCents > 0 ? Math.round((savingsCents / compareCents) * 100) : 0;
    return { compareCents, memberCents, savingsCents, pct: clamp(pct, 0, 90) };
  }

  function addBusinessDays(date, days) {
    const d = new Date(date);
    let remaining = Math.max(0, Math.floor(Number(days) || 0));
    while (remaining > 0) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay(); // 0=Sun, 6=Sat
      if (day === 0 || day === 6) continue;
      remaining--;
    }
    return d;
  }

  function formatShortDate(d) {
    try {
      return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  function getBulkTierPriceCents(product, qty) {
    try {
      return window.PPS?.getTieredPriceCents?.(product, qty) ?? Math.round(Number(product?.priceCents) || 0);
    } catch {
      return Math.round(Number(product?.priceCents) || 0);
    }
  }

  function clampQty(product, val) {
    const n = Math.max(1, Math.floor(Number(val) || 1));
    if (Number.isFinite(product?.stock) && product.stock > 0) {
      return Math.min(n, product.stock);
    }
    return n;
  }

  function renderTierButton(product, tierQty) {
    const qty = Number(tierQty) || 0;
    const disabled = product?.stock <= 0 || (Number.isFinite(product?.stock) && product.stock > 0 && product.stock < qty);
    const unit = getBulkTierPriceCents(product, qty);
    const label =
      qty >= 20 ? tt("specials.bulk.20", "20+ boxes") : qty >= 15 ? tt("specials.bulk.15", "15+ boxes") : tt("specials.bulk.10", "10+ boxes");
    return `
      <button class="pricing-tier" type="button" data-tier-qty="${qty}" ${disabled ? "disabled" : ""}>
        <strong>${label}</strong>
        <span>${window.PPS.money(unit, product.currency)}</span>
      </button>
    `;
  }

  function setupSpotlightControls(product) {
    const qtyInput = document.getElementById("spotQty");
    const qtyMinus = document.getElementById("spotQtyMinus");
    const qtyPlus = document.getElementById("spotQtyPlus");
    const qtyTotal = document.getElementById("spotQtyTotal");
    const qtyNote = document.getElementById("spotQtyNote");
    const deliveryEl = document.getElementById("spotDeliveryEstimate");
    const shareBtn = document.getElementById("spotShareBtn");
    const shareMsg = document.getElementById("spotShareMsg");

    function updateQtyPricing() {
      if (!qtyInput || !qtyTotal || !qtyNote) return;
      const qty = clampQty(product, qtyInput.value);
      qtyInput.value = String(qty);
      const unit = getBulkTierPriceCents(product, qty);
      const total = unit * qty;
      qtyTotal.textContent = `Total: ${window.PPS.money(total, product.currency)}`;
      const tierMsg =
        qty >= 20 ? "20+ pricing applied" : qty >= 15 ? "15+ pricing applied" : qty >= 10 ? "10+ pricing applied" : "Standard pricing";
      qtyNote.textContent = `${window.PPS.money(unit, product.currency)} / box · ${tierMsg}`;
    }

    function setQty(val) {
      if (!qtyInput) return;
      qtyInput.value = String(clampQty(product, val));
      updateQtyPricing();
    }

    if (qtyInput) {
      qtyInput.addEventListener("input", updateQtyPricing);
      qtyInput.addEventListener("blur", () => setQty(qtyInput.value));
      updateQtyPricing();
    }
    if (qtyMinus) qtyMinus.addEventListener("click", () => setQty((Number(qtyInput?.value) || 1) - 1));
    if (qtyPlus) qtyPlus.addEventListener("click", () => setQty((Number(qtyInput?.value) || 1) + 1));

    document.querySelectorAll("[data-tier-qty]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const q = Number(btn.getAttribute("data-tier-qty") || 0) || 1;
        setQty(q);
        if (!window.PPS?.addToCart || product?.stock <= 0) return;
        window.PPS.addToCart(product, q);
        const prev = btn.innerHTML;
        const addedLabel = tt("specials.added_qty", "Added {{qty}}") || "Added {{qty}}";
        btn.innerHTML = `<strong>${addedLabel.replace("{{qty}}", String(q))}</strong><span>${window.PPS.money(getBulkTierPriceCents(product, q), product.currency)}</span>`;
        btn.disabled = true;
        setTimeout(() => {
          btn.innerHTML = prev;
          btn.disabled = false;
        }, 900);
      });
    });

    if (deliveryEl) {
      const start = addBusinessDays(new Date(), 2);
      const end = addBusinessDays(new Date(), 5);
      deliveryEl.textContent = `Estimated delivery: ${formatShortDate(start)} – ${formatShortDate(end)} (business days)`;
    }

    function setShareMsg(text) {
      if (!shareMsg) return;
      shareMsg.textContent = text || "";
    }

    if (shareBtn) {
      const url = new URL("./product.html", window.location.href);
      url.searchParams.set("slug", String(product?.slug || ""));
      const shareData = {
        title: String(product?.name || ""),
        text: `${String(product?.name || "")} - Power Poly Supplies`,
        url: url.toString()
      };

      shareBtn.addEventListener("click", async () => {
        if (navigator.share) {
          try {
            await navigator.share(shareData);
            setShareMsg(window.PPS_I18N?.t("product.share.sent") || "Thanks for sharing.");
            return;
          } catch (err) {
            if (err && err.name === "AbortError") return;
            setShareMsg(window.PPS_I18N?.t("product.share.fail") || "Unable to share right now.");
            return;
          }
        }
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(shareData.url);
            setShareMsg(window.PPS_I18N?.t("product.share.copied") || "Link copied to clipboard.");
            return;
          } catch {
            // fall through
          }
        }
        setShareMsg(window.PPS_I18N?.t("product.share.manual") || "Copy the URL from the address bar.");
      });
    }
  }

  function renderSpotlight(container, p, deal) {
    if (!container) return;
    const endsAt = offerEndsAt(p);
    const endsDate = formatEndsDate(endsAt);
    const saveTpl = tt("specials.save_pct", "Save {{pct}}%");
    const limited = tt("specials.limited", "Limited-time");
    const dealTitle = tt("specials.deal_of_day", "Deal of the day");
    const endsOn = (tt("specials.ends_on", "Ends {{date}}") || "Ends {{date}}").replace("{{date}}", endsDate);
    const view = tt("specials.view", "View");
    const add = tt("specials.add", "Add");
    const bulkQuote = tt("product.bulk_quote", "Bulk quote");

    container.style.display = "";
    container.innerHTML = `
      <div class="specials-spotlight-head">
        <div>
          <div class="specials-spotlight-kicker">${dealTitle}</div>
          <div class="specials-spotlight-badges">
            <span class="specials-badge specials-badge-save">${saveTpl.replace("{{pct}}", String(deal.pct))}</span>
            <span class="specials-badge specials-badge-limited">${limited}</span>
            <span class="specials-badge specials-badge-ends">${endsOn}</span>
          </div>
        </div>
        <div class="specials-countdown" data-ends="${endsAt}"></div>
      </div>

      <div class="specials-spotlight-body">
        <a class="specials-spotlight-media" href="./product.html?slug=${encodeURIComponent(p.slug)}">
          <img src="${p.image}" alt="${p.name || ""}" loading="lazy" decoding="async" width="640" height="280">
        </a>
         <div class="specials-spotlight-info">
           <a class="specials-spotlight-title" href="./product.html?slug=${encodeURIComponent(p.slug)}">${p.name || ""}</a>
           <div class="card-meta">${categoryLabel(p.category)}</div>
           <div class="member-pricing">
             <div>
               <div class="market-label" data-i18n="market.price.label">Market price</div>
               <span class="compare-price">${window.PPS.money(deal.compareCents, p.currency)}</span>
             </div>
             <div>
               <div class="member-label" data-i18n="member.price.label">Power Poly Member Price</div>
               <span class="price">${window.PPS.money(deal.memberCents, p.currency)}</span>
             </div>
           </div>
           <div class="stock ${stockClass(p.stock)}" style="margin-top:10px;">
             <span class="dot"></span>
             ${stockLabel(p.stock)}
           </div>

           <div class="pricing-tiers">
             <div class="pricing-tiers-header" data-i18n="product.bulk">${tt("product.bulk", "Bulk pricing")}</div>
             <div class="pricing-tiers-grid">
               ${renderTierButton(p, 10)}
               ${renderTierButton(p, 15)}
               ${renderTierButton(p, 20)}
             </div>
           </div>

           <div class="qty-row" style="margin-top:16px;">
             <div class="qty-stepper" aria-label="Quantity selector">
               <button class="qty-btn" type="button" id="spotQtyMinus" aria-label="Decrease quantity">-</button>
               <input class="qty-input" id="spotQty" inputmode="numeric" pattern="[0-9]*" value="1" aria-label="Quantity">
               <button class="qty-btn" type="button" id="spotQtyPlus" aria-label="Increase quantity">+</button>
             </div>
             <div class="qty-meta">
               <div class="qty-total" id="spotQtyTotal"></div>
               <div class="qty-note" id="spotQtyNote"></div>
             </div>
           </div>

           <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
             <a class="btn btn-outline" href="./product.html?slug=${encodeURIComponent(p.slug)}">${view}</a>
             <button class="btn btn-primary" ${p.stock <= 0 ? "disabled" : ""} data-add-id="${p.id}" data-qty-input="spotQty">${add}</button>
             <a class="btn" href="./cart.html" data-i18n="specials.action.cart">${tt("specials.action.cart", "Go to cart")}</a>
             <a class="btn btn-outline" href="./contact.html?subject=${encodeURIComponent("Bulk quote")}&product=${encodeURIComponent(p.name || "")}">${bulkQuote}</a>
           </div>

           <div class="delivery-estimate" id="spotDeliveryEstimate" aria-live="polite"></div>
           <div style="margin-top:10px;">
             <button class="share-btn" type="button" id="spotShareBtn" aria-label="${window.PPS_I18N?.t("product.share") || "Share"}">
               <span class="share-icon" aria-hidden="true">
                 <svg viewBox="0 0 24 24" width="16" height="16" focusable="false" aria-hidden="true">
                   <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M12 4v12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                   <path d="M7.5 8.5 12 4l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                 </svg>
               </span>
               <span data-i18n="product.share">Share</span>
             </button>
             <div id="spotShareMsg" style="color:var(--muted); font-size:12px; margin-top:6px;"></div>
           </div>
         </div>
       </div>
     `;
  }

  function renderCard(p, deal, endsAt) {
    const lang = window.PPS_I18N?.getLang?.() || "en";
    const displayName =
      lang === "es" ? window.PPS_I18N?.autoTranslate?.(p.name || "", "es") || p.name : p.name;

    const isMember = Boolean(window.PPS.getSession?.());
    const bannerTemplate =
      tt("member.banner", "Log in to save {{amount}} with Power Poly Member Pricing") ||
      "Log in to save {{amount}} with Power Poly Member Pricing";
    const bannerText = bannerTemplate.replace("{{amount}}", window.PPS.money(deal.savingsCents, p.currency));

    const saveTpl = tt("specials.save_pct", "Save {{pct}}%");
    const limited = tt("specials.limited", "Limited-time");
    const endsDate = formatEndsDate(endsAt);
    const endsOn = (tt("specials.ends_on", "Ends {{date}}") || "Ends {{date}}").replace("{{date}}", endsDate);

    return `
      <div class="card fade-in specials-card" data-ends="${endsAt}">
        <div class="specials-media">
          <a href="./product.html?slug=${encodeURIComponent(p.slug)}">
            <img src="${p.image}" alt="${displayName}" loading="lazy" decoding="async" width="400" height="190">
          </a>
          <div class="specials-badges">
            <span class="specials-badge specials-badge-save">${saveTpl.replace("{{pct}}", String(deal.pct))}</span>
            <span class="specials-badge specials-badge-limited">${limited}</span>
          </div>
          <div class="specials-ends">${endsOn}</div>
        </div>

        <div class="card-body">
          <a class="card-title" style="text-decoration:none; display:inline-block;" href="./product.html?slug=${encodeURIComponent(p.slug)}">${displayName}</a>
          <div class="specials-meta-row">
            <div class="card-meta">${categoryLabel(p.category)}</div>
            <div class="specials-countdown" data-ends="${endsAt}"></div>
          </div>
          ${packPillHtml(p.category)}

          <div class="member-pricing">
            <div>
              <div class="market-label" data-i18n="market.price.label">Market price</div>
              <span class="compare-price">${window.PPS.money(deal.compareCents, p.currency)}</span>
            </div>
            <div>
              <div class="member-label" data-i18n="member.price.label">Power Poly Member Price</div>
              <span class="price">${window.PPS.money(deal.memberCents, p.currency)}</span>
            </div>
            ${favoriteButton(p.id)}
          </div>

          ${!isMember && deal.savingsCents > 0 ? `<a class="member-banner" href="./login.html">${bannerText}</a>` : ""}

          <div class="stock ${stockClass(p.stock)}">
            <span class="dot"></span>
            ${stockLabel(p.stock)}
          </div>

          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <a class="btn" href="./product.html?slug=${encodeURIComponent(p.slug)}">${tt("specials.view", "View")}</a>
            <button class="btn btn-primary" ${p.stock <= 0 ? "disabled" : ""} data-add-id="${p.id}">${tt("specials.add", "Add")}</button>
            <a class="btn btn-outline" href="./cart.html" data-i18n="specials.action.cart">${tt("specials.action.cart", "Go to cart")}</a>
          </div>

          <div class="bulk-quick">
            <button class="btn btn-outline" ${p.stock <= 0 ? "disabled" : ""} data-bulk-id="${p.id}" data-bulk-qty="10">${tt("specials.bulk.10", "10+ boxes")}</button>
            <button class="btn btn-outline" ${p.stock <= 0 ? "disabled" : ""} data-bulk-id="${p.id}" data-bulk-qty="15">${tt("specials.bulk.15", "15+ boxes")}</button>
            <button class="btn btn-outline" ${p.stock <= 0 ? "disabled" : ""} data-bulk-id="${p.id}" data-bulk-qty="20">${tt("specials.bulk.20", "20+ boxes")}</button>
          </div>
        </div>
      </div>
    `;
  }

  function updateCountdowns() {
    const now = Date.now();
    document.querySelectorAll(".specials-countdown[data-ends]").forEach((el) => {
      const endsAt = Number(el.getAttribute("data-ends") || 0);
      const left = endsAt - now;
      el.classList.remove("urgent", "soon", "expired");
      if (!Number.isFinite(endsAt) || endsAt <= 0) {
        el.textContent = "";
        return;
      }
      if (left <= 0) {
        el.textContent = tt("specials.expired", "Expired");
        el.classList.add("expired");
        return;
      }

      if (left <= 24 * 60 * 60 * 1000) el.classList.add("urgent");
      else if (left <= 3 * 24 * 60 * 60 * 1000) el.classList.add("soon");

      const labelTpl = tt("specials.ends_in", "Ends in {{time}}") || "Ends in {{time}}";
      el.textContent = labelTpl.replace("{{time}}", formatCountdown(left));
    });
  }

  function setupActions(specials) {
    document.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add-id]");
      if (addBtn) {
        const id = addBtn.getAttribute("data-add-id");
        const p = specials.find((x) => x.id === id);
        if (!p || p.stock <= 0) return;
        const qtyInputId = addBtn.getAttribute("data-qty-input");
        const qtyEl = qtyInputId ? document.getElementById(qtyInputId) : null;
        const qty = clampQty(p, qtyEl?.value || 1);
        window.PPS.addToCart(p, qty);
        const prev = addBtn.textContent;
        const addedLabel = tt("specials.added_qty", "Added {{qty}}") || "Added {{qty}}";
        addBtn.textContent = qty > 1 ? addedLabel.replace("{{qty}}", String(qty)) : tt("specials.added", "Added");
        addBtn.disabled = true;
        setTimeout(() => {
          addBtn.textContent = prev;
          addBtn.disabled = false;
        }, 800);
        return;
      }

      const bulkBtn = e.target.closest("[data-bulk-id]");
      if (bulkBtn) {
        const id = bulkBtn.getAttribute("data-bulk-id");
        const qty = Number(bulkBtn.getAttribute("data-bulk-qty") || 0) || 0;
        const p = specials.find((x) => x.id === id);
        if (!p || p.stock <= 0 || qty <= 0) return;
        window.PPS.addToCart(p, qty);
        const prev = bulkBtn.textContent;
        const addedLabel = tt("specials.added_qty", "Added {{qty}}") || "Added {{qty}}";
        bulkBtn.textContent = addedLabel.replace("{{qty}}", String(qty));
        bulkBtn.disabled = true;
        setTimeout(() => {
          bulkBtn.textContent = prev;
          bulkBtn.disabled = false;
        }, 800);
      }
    });
  }

  async function init() {
    const grid = document.getElementById("grid");
    if (!grid) return;

    setupFavorites();
    renderSkeletons(grid);

    try {
      const products = await window.PPS.loadProducts();
      const specials = products.filter((p) => p.special === true);

      if (specials.length === 0) {
        const none = tt("specials.none", "No specials yet.");
        grid.innerHTML = `<div class="card" style="padding:14px;">${none}</div>`;
        return;
      }

      const withDeals = specials.map((p) => {
        const deal = computeDeal(p);
        const endsAt = offerEndsAt(p);
        return { p, deal, endsAt };
      });

      const spotlight = withDeals
        .slice()
        .sort((a, b) => (b.deal.pct - a.deal.pct) || (b.deal.savingsCents - a.deal.savingsCents))[0];

      renderSpotlight(document.getElementById("specialsSpotlight"), spotlight.p, spotlight.deal);
      try {
        setupSpotlightControls(spotlight.p);
      } catch {
        // ignore
      }

      grid.innerHTML = withDeals
        .sort((a, b) => (b.deal.pct - a.deal.pct) || (a.endsAt - b.endsAt))
        .map(({ p, deal, endsAt }) => renderCard(p, deal, endsAt))
        .join("");

      document.querySelectorAll(".fade-in").forEach((el) => el.classList.add("show"));

      setupActions(specials);
      updateCountdowns();
      setInterval(updateCountdowns, 1000);
    } catch (err) {
      const errMsg = tt("specials.error", "Unable to load specials right now. Please refresh.");
      grid.innerHTML = `<div class="card" style="padding:14px;">${errMsg}</div>`;
      // eslint-disable-next-line no-console
      console.error("Failed to load specials", err);
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
