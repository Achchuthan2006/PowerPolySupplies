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
        "Polybags": "Sacs en poly",
        "Wraps": "Films",
        "Racks": "Portants"
      };
      return map[category] || category || "";
    }
    if (lang === "ko") {
      const map = {
        "Garment Bags": "Garment Bags",
        "Hangers": "Hangers",
        "Polybags": "Polybags",
        "Wraps": "Wraps",
        "Racks": "Racks"
      };
      return map[category] || category || "";
    }
    if (lang === "es") {
      const map = {
        "Garment Bags": "Bolsas para prendas",
        "Hangers": "Ganchos",
        "Polybags": "Bolsas de polietileno",
        "Wraps": "Film",
        "Racks": "Percheros"
      };
      return map[category] || category || "";
    }
    return category || "";
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
    const compareCents = (Number(p.priceCents) || 0) + 1000;
    const memberCents = Number(p.priceCents) || 0;
    const savingsCents = Math.max(0, compareCents - memberCents);
    const pct = compareCents > 0 ? Math.round((savingsCents / compareCents) * 100) : 0;
    return { compareCents, memberCents, savingsCents, pct: clamp(pct, 0, 90) };
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
          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <a class="btn btn-outline" href="./product.html?slug=${encodeURIComponent(p.slug)}">${view}</a>
            <button class="btn btn-primary" ${p.stock <= 0 ? "disabled" : ""} data-add-id="${p.id}">${add}</button>
            <a class="btn" href="./cart.html" data-i18n="specials.action.cart">${tt("specials.action.cart", "Go to cart")}</a>
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
        window.PPS.addToCart(p);
        const prev = addBtn.textContent;
        addBtn.textContent = tt("specials.added", "Added");
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
