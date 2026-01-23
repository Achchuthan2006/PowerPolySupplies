// Account dashboard logic (kept external to avoid inline-script parsing issues)
// Built for the static `frontend/account.html` page.

(() => {
  "use strict";

  const session = window.PPS?.getSession?.();
  if (!session) {
    window.location.href = "./login.html";
    return;
  }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = {
    orders: [],
    products: [],
    productsById: new Map()
  };

  const els = {
    year: $("#y"),
    ordersGrid: $("#ordersGrid"),
    ordersMsg: $("#ordersMsg"),
    favoritesGrid: $("#favoritesGrid"),
    favoritesMsg: $("#favoritesMsg"),
    favoritesSuggestions: $("#favoritesSuggestions"),
    frequentGrid: $("#frequentGrid"),
    frequentMsg: $("#frequentMsg"),
    profileGrid: $("#profileGrid"),
    nameEl: $("#accountName"),
    badgeEl: $("#accountBadge"),
    dashboardBadge: $("#dashboardBadge"),
    provinceEl: $("#accountProvince"),
    logoutBtn: $("#logoutBtn"),
    dashboardStats: $("#dashboardStats"),
    dashboardSub: $("#dashboardSub"),
    dashboardInsights: $("#dashboardInsights"),
    ordersCountBadge: $("#ordersCountBadge"),
    favoritesCountBadge: $("#favoritesCountBadge"),
    orderSearch: $("#orderSearch"),
    orderStatus: $("#orderStatus"),
    orderRange: $("#orderRange"),
    exportOrdersBtn: $("#exportOrders"),
    addressesGrid: $("#addressesGrid"),
    addAddressForm: $("#addAddressForm"),
    paymentGrid: $("#paymentGrid"),
    addPaymentForm: $("#addPaymentForm"),
    rewardsBody: $("#rewardsBody"),
    reportsBody: $("#reportsBody"),
    settingsForm: $("#settingsForm")
  };

  if (els.year) els.year.textContent = String(new Date().getFullYear());
  window.PPS?.updateCartBadge?.();

  const toast = (message) => {
    if (!message) return;
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.right = "16px";
    el.style.bottom = "16px";
    el.style.zIndex = "9999";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "14px";
    el.style.border = "1px solid rgba(17,24,39,.12)";
    el.style.background = "rgba(255,255,255,.95)";
    el.style.boxShadow = "0 18px 45px rgba(17,24,39,.12)";
    el.style.fontWeight = "900";
    el.style.fontSize = "13px";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  };

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

  const firstName = (value) => String(value || "").trim().split(/\s+/)[0] || "";
  const money = (cents, currency) => window.PPS?.money?.(Number(cents) || 0, currency || "CAD") || "";

  const fmtShortDate = (value) => {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const fmtDateTime = (value) => {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const provinceLabel = (code) => {
    const names = {
      ON: "Ontario",
      NS: "Nova Scotia",
      NB: "New Brunswick",
      NL: "Newfoundland and Labrador",
      PE: "Prince Edward Island",
      AB: "Alberta",
      BC: "British Columbia",
      SK: "Saskatchewan",
      MB: "Manitoba",
      QC: "Quebec",
      YT: "Yukon",
      NT: "Northwest Territories",
      NU: "Nunavut"
    };
    return names[code] || code || "";
  };

  const getStatusKey = (status) => {
    const s = String(status || "").toLowerCase().trim();
    if (!s) return "pending";
    if (["paid", "fulfilled"].includes(s)) return "fulfilled";
    if (s === "processing") return "processing";
    if (s === "shipped") return "shipped";
    if (s === "delivered") return "delivered";
    if (["cancelled", "canceled"].includes(s)) return "cancelled";
    return s;
  };

  const statusLabel = (status) => {
    const key = getStatusKey(status);
    const map = {
      pending: "Pending",
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
      fulfilled: "Fulfilled",
      cancelled: "Cancelled"
    };
    return map[key] || key;
  };

  const userKey = (suffix) => `pps_account_${String(session.email || "").trim().toLowerCase()}_${suffix}`;
  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };
  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  };

  const setActiveNavByHash = () => {
    const hash = window.location.hash || "#dashboard";
    $$(".account-nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === hash));
  };

  const moneySavedCentsFromOrder = (order) =>
    (order?.items || []).reduce((sum, item) => {
      const base = Number(item.priceCentsBase ?? item.priceCents ?? 0);
      const current = Number(item.priceCents ?? 0);
      const diff = Math.max(0, base - current);
      return sum + diff * (Number(item.qty) || 0);
    }, 0);

  const computeFrequent = () => {
    const counts = new Map();
    state.orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const id = String(it.id || "");
        if (!id) return;
        counts.set(id, (counts.get(id) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count, product: state.productsById.get(id) }))
      .filter((x) => x.product)
      .sort((a, b) => b.count - a.count);
  };

  const typicalQtyFor = (productId) => {
    const qtys = [];
    state.orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        if (String(it.id) !== String(productId)) return;
        qtys.push(Number(it.qty) || 1);
      });
    });
    if (!qtys.length) return 1;
    qtys.sort((a, b) => a - b);
    return qtys[Math.floor(qtys.length / 2)] || 1;
  };

  const descForLang = (product) => {
    const lang = window.PPS_I18N?.getLang?.() || "en";
    const pick =
      lang === "fr"
        ? product.description_fr || product.description
        : lang === "ko"
          ? product.description_ko || product.description
          : lang === "hi"
            ? product.description_hi || product.description
            : lang === "ta"
              ? product.description_ta || product.description
              : lang === "es"
                ? product.description_es || product.description
                : product.description;
    return String(pick || "").trim();
  };

  function renderRewards() {
    if (!els.rewardsBody) return;
    const totalSpent = state.orders.reduce((s, o) => s + Number(o.totalCents || 0), 0);
    const points = Math.floor(totalSpent / 100);
    const tier = points >= 25000 ? "Gold" : points >= 10000 ? "Silver" : "Bronze";
    const nextTier = tier === "Bronze" ? "Silver" : tier === "Silver" ? "Gold" : null;
    const nextTarget = tier === "Bronze" ? 10000 : tier === "Silver" ? 25000 : points;
    const progress = nextTier ? Math.min(100, Math.round((points / nextTarget) * 100)) : 100;

    els.rewardsBody.innerHTML = `
      <div class="insights-grid">
        <div class="insight">
          <div class="insight-title">Points balance</div>
          <div class="insight-body">${points.toLocaleString()}</div>
          <div class="insight-sub">1 point per $1 spent (estimated)</div>
        </div>
        <div class="insight">
          <div class="insight-title">Member tier</div>
          <div class="insight-body">${tier}</div>
          <div class="insight-sub">${nextTier ? `Progress to ${nextTier}: ${progress}%` : "Top tier reached"}</div>
          <div style="margin-top:10px; height:10px; border-radius:999px; background:rgba(17,24,39,.08); overflow:hidden;">
            <div style="height:100%; width:${progress}%; background:linear-gradient(90deg, var(--primary), var(--primary-strong));"></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderDashboard() {
    if (!els.dashboardStats || !els.dashboardSub) return;
    if (!state.orders.length) {
      els.dashboardSub.textContent = "No orders yet - browse products to get started.";
      els.dashboardStats.innerHTML = "";
      if (els.dashboardInsights) els.dashboardInsights.innerHTML = "";
      renderRewards();
      return;
    }

    const currency = state.orders[0]?.currency || "CAD";
    const totalOrders = state.orders.length;
    const totalSpent = state.orders.reduce((s, o) => s + Number(o.totalCents || 0), 0);
    const saved = state.orders.reduce((s, o) => s + moneySavedCentsFromOrder(o), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthSpent = state.orders.filter((o) => new Date(o.createdAt) >= monthStart).reduce((s, o) => s + Number(o.totalCents || 0), 0);
    const avgOrder = totalOrders ? Math.round(totalSpent / totalOrders) : 0;
    const oldest = state.orders[state.orders.length - 1];
    const memberSince = oldest?.createdAt ? fmtShortDate(oldest.createdAt) : "";

    els.dashboardSub.textContent = memberSince ? `Member since ${memberSince}` : "Your account summary";

    els.dashboardStats.innerHTML = `
      <div class="dash-card"><div class="dash-value">${totalOrders}</div><div class="dash-label">Total orders</div></div>
      <div class="dash-card"><div class="dash-value">${money(totalSpent, currency)}</div><div class="dash-label">Lifetime spend</div></div>
      <div class="dash-card highlight"><div class="dash-value">${money(saved, currency)}</div><div class="dash-label">Money saved</div><div class="dash-sub">with member pricing</div></div>
      <div class="dash-card"><div class="dash-value">${money(thisMonthSpent, currency)}</div><div class="dash-label">This month</div></div>
      <div class="dash-card"><div class="dash-value">${money(avgOrder, currency)}</div><div class="dash-label">Avg order</div></div>
    `;

    if (els.dashboardInsights) {
      const top = computeFrequent()[0];
      els.dashboardInsights.innerHTML = `
        <div class="insights-grid">
          <div class="insight">
            <div class="insight-title">Top item</div>
            <div class="insight-body">${esc(top?.product?.name || "-")}</div>
            <div class="insight-sub">${top ? `Ordered ${top.count} time${top.count === 1 ? "" : "s"}` : ""}</div>
          </div>
          <div class="insight">
            <div class="insight-title">Smart note</div>
            <div class="insight-body">Tip: add your usuals to Favorites for one-click reorder.</div>
            <div class="insight-sub">Bulk tiers (10/15/20+) maximize savings</div>
          </div>
        </div>
      `;
    }

    renderRewards();
  }

  function renderOrders() {
    if (!els.ordersGrid || !els.ordersMsg) return;
    if (!state.orders.length) {
      els.ordersMsg.textContent = window.PPS_I18N?.t("account.status.empty") || "No orders found for this account yet.";
      els.ordersGrid.innerHTML = "";
      return;
    }

    const q = String(els.orderSearch?.value || "").trim().toLowerCase();
    const statusFilter = String(els.orderStatus?.value || "").trim().toLowerCase();
    const range = String(els.orderRange?.value || "all");
    const cutoff = range === "all" ? null : Date.now() - Number(range) * 24 * 60 * 60 * 1000;

    const filtered = state.orders.filter((order) => {
      if (cutoff && new Date(order.createdAt).getTime() < cutoff) return false;
      if (statusFilter && getStatusKey(order.status) !== statusFilter) return false;
      if (!q) return true;
      const hay = [order.id, order.status, fmtShortDate(order.createdAt), ...(order.items || []).map((it) => it.name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    if (els.ordersCountBadge) els.ordersCountBadge.textContent = String(state.orders.length);

    if (!filtered.length) {
      els.ordersMsg.textContent = "No matching orders. Try a different search or filters.";
      els.ordersGrid.innerHTML = "";
      return;
    }

    els.ordersMsg.textContent = "";
    els.ordersGrid.innerHTML = filtered
      .map((order) => {
        const status = getStatusKey(order.status);
        const step = status === "processing" ? 1 : status === "shipped" ? 2 : ["delivered", "fulfilled"].includes(status) ? 3 : 0;
        const currency = order.currency || "CAD";

        const items = (order.items || [])
          .map((it) => {
            const p = state.productsById.get(String(it.id || "")) || {};
            const desc = descForLang(p);
            const img = p.image || "./assets/poly%20logo%20without%20background.png";
            const lineTotal = Number(it.priceCents || 0) * Number(it.qty || 0);
            return `
              <div class="order-item">
                <img class="order-thumb" src="${esc(img)}" alt="${esc(it.name || "")}" loading="lazy" decoding="async" width="60" height="60">
                <div>
                  <div class="order-item-title">${esc(it.name || "")}</div>
                  <div class="order-item-qty">Qty: ${Number(it.qty) || 0}</div>
                  ${desc ? `<div class="order-item-desc">${esc(desc)}</div>` : ""}
                </div>
                <div class="order-item-price">${money(lineTotal, currency)}</div>
              </div>
            `;
          })
          .join("");

        const start = new Date(order.createdAt);
        const end = new Date(order.createdAt);
        start.setDate(start.getDate() + 2);
        end.setDate(end.getDate() + 4);
        const delivery = `Estimated delivery: ${fmtShortDate(start)} - ${fmtShortDate(end)}`;

        const contactTracking = `./contact.html?topic=tracking&order=${encodeURIComponent(order.id)}`;
        const contactIssue = `./contact.html?topic=issue&order=${encodeURIComponent(order.id)}`;
        const feedback = `./feedback.html?order=${encodeURIComponent(order.id)}`;

        return `
          <div class="card fade-in order-card">
            <div class="order-top">
              <div>
                <div class="order-id">Order #${esc(order.id)}</div>
                <div class="order-date">${esc(fmtDateTime(order.createdAt))}</div>
              </div>
              <div class="order-right">
                <div class="status-pill ${esc(status)}">${esc(statusLabel(status))}</div>
                <div class="order-total">${money(Number(order.totalCents || 0), currency)}</div>
              </div>
            </div>
            <div class="status-track" aria-label="Order progress">
              <div class="track">
                ${["Order placed", "Processing", "Shipped", "Delivered"]
                  .map(
                    (label, i) => `
                      <div class="track-step ${i <= step ? "done" : ""}">
                        <div class="dot"></div>
                        <div class="label">${label}</div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>
            <div class="order-items">${items}</div>
            <div class="order-delivery">
              <div>${esc(delivery)}</div>
              <a class="btn btn-outline btn-sm" href="${contactTracking}">Track order</a>
            </div>
            <div class="order-actions">
              <button class="btn btn-primary" type="button" onclick="reorder('${esc(order.id)}')">${window.PPS_I18N?.t("account.reorder") || "Reorder"}</button>
              <button class="btn btn-outline" type="button" onclick="downloadInvoice('${esc(order.id)}')">Invoice</button>
              <button class="btn btn-outline" type="button" onclick="shareOrder('${esc(order.id)}')">Share</button>
              <a class="btn btn-outline" href="${feedback}">Write review</a>
              <a class="btn btn-outline" href="${contactIssue}">Report problem</a>
            </div>
          </div>
        `;
      })
      .join("");

    $$(".fade-in").forEach((el) => el.classList.add("show"));
  }

  function renderProfile(latest) {
    if (!els.profileGrid) return;
    const email = session?.email || latest?.customer?.email || "";
    const name = session?.name || latest?.customer?.name || "";
    const phone = String(session?.phone || latest?.customer?.phone || "").trim();
    const provinceCode = String(session?.province || latest?.customer?.province || "").trim();
    const province = provinceCode ? provinceLabel(provinceCode) : "";
    els.profileGrid.innerHTML = `
      <div class="profile-item"><div class="k">Name</div><div class="v">${esc(name || "-")}</div></div>
      <div class="profile-item"><div class="k">Email</div><div class="v">${esc(email || "-")}</div></div>
      <div class="profile-item"><div class="k">Phone</div><div class="v">${esc(phone || "-")}</div></div>
      <div class="profile-item"><div class="k">Province</div><div class="v">${esc(province || "-")}</div></div>
      <div class="profile-item"><div class="k">Member status</div><div class="v">&#10003; Verified Power Poly Member</div></div>
    `;
  }

  function exportOrdersCsv() {
    if (!state.orders.length) return;
    const rows = [["order_id", "created_at", "status", "currency", "total", "item_id", "item_name", "qty", "unit_price", "line_total"]];
    state.orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const qty = Number(it.qty) || 0;
        const unit = Number(it.priceCents) || 0;
        const line = unit * qty;
        rows.push([
          o.id,
          o.createdAt,
          getStatusKey(o.status),
          o.currency || "CAD",
          (Number(o.totalCents || 0) / 100).toFixed(2),
          it.id || "",
          it.name || "",
          String(qty),
          (unit / 100).toFixed(2),
          (line / 100).toFixed(2)
        ]);
      });
    });
    const csv = rows
      .map((r) =>
        r
          .map((v) => {
            const s = String(v ?? "");
            if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  window.downloadInvoice = (orderId) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    const currency = order.currency || "CAD";
    const lines = (order.items || [])
      .map((it) => {
        const line = Number(it.priceCents || 0) * Number(it.qty || 0);
        return `<tr><td style="padding:8px 0;">${esc(it.name || "")}</td><td style="padding:8px 0; text-align:center;">${Number(it.qty) || 0}</td><td style="padding:8px 0; text-align:right;">${money(it.priceCents, currency)}</td><td style="padding:8px 0; text-align:right;">${money(line, currency)}</td></tr>`;
      })
      .join("");
    const html = `
      <html><head><meta charset="utf-8"/><title>Invoice ${esc(order.id)}</title></head>
      <body style="font-family:Arial,sans-serif; padding:24px;">
        <h2 style="margin:0;">Power Poly Supplies</h2>
        <div style="color:#6b7280; margin-top:6px;">Invoice / Receipt</div>
        <div style="margin-top:16px;"><b>Order:</b> ${esc(order.id)}</div>
        <div style="color:#6b7280; margin-top:4px;">${esc(fmtDateTime(order.createdAt))}</div>
        <table style="width:100%; border-collapse:collapse; margin-top:16px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid #e5e7eb;">
              <th style="padding:8px 0;">Item</th>
              <th style="padding:8px 0; text-align:center;">Qty</th>
              <th style="padding:8px 0; text-align:right;">Price</th>
              <th style="padding:8px 0; text-align:right;">Line</th>
            </tr>
          </thead>
          <tbody>${lines}</tbody>
        </table>
        <div style="margin-top:14px; text-align:right; font-size:16px;"><b>Total:</b> ${money(order.totalCents, currency)}</div>
      </body></html>
    `;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${order.id}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  window.reorder = (orderId) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    window.PPS?.addItemsToCart?.(order.items || []);
    window.PPS?.updateCartBadge?.();
    if (els.ordersMsg) els.ordersMsg.textContent = window.PPS_I18N?.t("account.status.added") || "Items added to cart. Ready to checkout.";
  };

  window.shareOrder = async (orderId) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    const currency = order.currency || "CAD";
    const lines = (order.items || []).map((it) => `- ${it.name} x${it.qty}`).join("\n");
    const text = `Power Poly Supplies - Order ${order.id}\nDate: ${fmtShortDate(order.createdAt)}\nStatus: ${statusLabel(order.status)}\nTotal: ${money(order.totalCents, currency)}\n\nItems:\n${lines}`;
    try {
      await navigator.clipboard.writeText(text);
      toast("Order details copied.");
    } catch {
      toast("Could not copy (clipboard blocked).");
    }
  };

  function renderFavoriteSuggestions() {
    if (!els.favoritesSuggestions) return;
    if (!state.orders.length || !state.productsById.size) {
      els.favoritesSuggestions.innerHTML = "";
      return;
    }
    const suggestions = computeFrequent()
      .filter((x) => !window.PPS?.isFavorite?.(x.id))
      .slice(0, 3);
    if (!suggestions.length) {
      els.favoritesSuggestions.innerHTML = "";
      return;
    }
    els.favoritesSuggestions.innerHTML = `
      <div style="margin-top:12px;">
        <div style="font-weight:1000; margin-bottom:8px;">Quick add from your order history</div>
        <div class="grid grid-3">
          ${suggestions
            .map(
              ({ product }) => `
                <div class="card fade-in">
                  <a href="./product.html?slug=${encodeURIComponent(product.slug)}">
                    <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" decoding="async" width="400" height="190">
                  </a>
                  <div class="card-body">
                    <a class="card-title" style="text-decoration:none; display:inline-block;" href="./product.html?slug=${encodeURIComponent(product.slug)}">${esc(product.name)}</a>
                    <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                      <button class="btn btn-outline" type="button" onclick="addFav('${esc(product.id)}')">Add to Favorites</button>
                      <button class="btn btn-primary" ${product.stock <= 0 ? "disabled" : ""} type="button" onclick="quickAdd('${esc(product.id)}', 1)">Add to cart</button>
                    </div>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;
    $$(".fade-in").forEach((el) => el.classList.add("show"));
  }

  function renderFavorites() {
    if (!els.favoritesGrid || !els.favoritesMsg) return;
    const favorites = window.PPS?.getFavorites?.() || [];
    if (els.favoritesCountBadge) els.favoritesCountBadge.textContent = String(favorites.length);

    if (!favorites.length) {
      els.favoritesMsg.textContent = "No favorite items yet. Add products you reorder often.";
      els.favoritesGrid.innerHTML = "";
      renderFavoriteSuggestions();
      return;
    }

    els.favoritesMsg.textContent = "";
    els.favoritesGrid.innerHTML = favorites
      .map((id) => state.productsById.get(String(id)))
      .filter(Boolean)
      .map((p) => {
        return `
          <div class="card fade-in">
            <a href="./product.html?slug=${encodeURIComponent(p.slug)}">
              <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="400" height="190">
            </a>
            <div class="card-body">
              <a class="card-title" style="text-decoration:none; display:inline-block;" href="./product.html?slug=${encodeURIComponent(p.slug)}">${esc(p.name)}</a>
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn btn-primary" ${p.stock <= 0 ? "disabled" : ""} type="button" onclick="quickAdd('${esc(p.id)}', 1)">Add to cart</button>
                <a class="btn btn-outline" href="./product.html?slug=${encodeURIComponent(p.slug)}">View</a>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    renderFavoriteSuggestions();
    $$(".fade-in").forEach((el) => el.classList.add("show"));
    window.PPS_I18N?.applyTranslations?.();
  }

  window.addFav = (productId) => {
    window.PPS?.toggleFavorite?.(productId);
    toast("Updated Favorites.");
    renderFavorites();
  };

  function renderFrequent() {
    if (!els.frequentGrid || !els.frequentMsg) return;
    if (!state.orders.length || !state.productsById.size) {
      els.frequentMsg.textContent = "Your frequent items will appear after your first order.";
      els.frequentGrid.innerHTML = "";
      return;
    }
    const freq = computeFrequent().slice(0, 6);
    if (!freq.length) {
      els.frequentMsg.textContent = "No frequent items yet.";
      els.frequentGrid.innerHTML = "";
      return;
    }
    els.frequentMsg.textContent = "";
    els.frequentGrid.innerHTML = freq
      .map(({ product, count }) => {
        const typicalQty = typicalQtyFor(product.id);
        return `
          <div class="card fade-in">
            <a href="./product.html?slug=${encodeURIComponent(product.slug)}">
              <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" decoding="async" width="400" height="190">
            </a>
            <div class="card-body">
              <a class="card-title" style="text-decoration:none; display:inline-block;" href="./product.html?slug=${encodeURIComponent(product.slug)}">${esc(product.name)}</a>
              <div class="card-meta">Ordered ${count} time${count === 1 ? "" : "s"} &middot; Typical qty: ${typicalQty}</div>
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn btn-primary" ${product.stock <= 0 ? "disabled" : ""} type="button" onclick="quickAdd('${esc(product.id)}', ${typicalQty})">Add ${typicalQty} to cart</button>
                <button class="btn btn-outline" type="button" onclick="addFav('${esc(product.id)}')">Favorite</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
    $$(".fade-in").forEach((el) => el.classList.add("show"));
  }

  window.quickAdd = (productId, qty) => {
    const product = state.productsById.get(String(productId));
    if (!product) return;
    window.PPS?.addToCart?.(product, Number(qty) || 1);
    window.PPS?.updateCartBadge?.();
    toast("Added to cart.");
  };

  function renderAddresses() {
    if (!els.addressesGrid) return;
    const list = readJson(userKey("addresses"), []);
    if (!Array.isArray(list) || !list.length) {
      els.addressesGrid.innerHTML = `
        <div class="account-empty">
          <div style="font-weight:1000;">No saved addresses yet.</div>
          <div style="margin-top:6px; color:var(--muted); font-weight:800; font-size:13px;">Add your main store, warehouse, or branch locations for faster checkout.</div>
        </div>
      `;
      return;
    }
    els.addressesGrid.innerHTML = `
      <div class="profile-grid">
        ${list
          .map(
            (a) => `
              <div class="profile-item">
                <div class="k">${esc(a.label || "Address")}</div>
                <div class="v" style="margin-top:8px;">
                  <div style="font-weight:1000;">${esc(a.name || "")}</div>
                  <div style="color:var(--muted); font-weight:800; font-size:13px; margin-top:4px;">
                    ${[a.line1, a.line2, `${a.city || ""}${a.province ? ", " + a.province : ""} ${a.postal || ""}`.trim(), a.country || ""]
                      .filter(Boolean)
                      .map(esc)
                      .join("<br>")}
                  </div>
                  <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn btn-outline btn-sm" type="button" data-addr-edit="${esc(a.id)}">Edit</button>
                    <button class="btn btn-outline btn-sm" type="button" data-addr-del="${esc(a.id)}">Remove</button>
                  </div>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function upsertAddress(addr) {
    const key = userKey("addresses");
    const list = readJson(key, []);
    const safe = Array.isArray(list) ? list : [];
    const idx = safe.findIndex((x) => String(x.id) === String(addr.id));
    if (idx >= 0) safe[idx] = addr;
    else safe.unshift(addr);
    writeJson(key, safe);
    renderAddresses();
  }

  function deleteAddress(id) {
    const key = userKey("addresses");
    const list = readJson(key, []);
    const safe = Array.isArray(list) ? list : [];
    writeJson(
      key,
      safe.filter((x) => String(x.id) !== String(id))
    );
    renderAddresses();
  }

  function renderPayments() {
    if (!els.paymentGrid) return;
    const list = readJson(userKey("payments"), []);
    if (!Array.isArray(list) || !list.length) {
      els.paymentGrid.innerHTML = `
        <div class="account-empty">
          <div style="font-weight:1000;">No saved payment methods.</div>
          <div style="margin-top:6px; color:var(--muted); font-weight:800; font-size:13px;">For security, we only store basic labels locally in your browser.</div>
        </div>
      `;
      return;
    }
    els.paymentGrid.innerHTML = `
      <div class="profile-grid">
        ${list
          .map(
            (m) => `
              <div class="profile-item">
                <div class="k">${esc(m.label || "Card")}</div>
                <div class="v">
                  <div style="margin-top:6px;">${esc(m.brand || "Card")} •••• ${esc(m.last4 || "----")}</div>
                  <div style="margin-top:4px; color:var(--muted); font-weight:800; font-size:13px;">Exp ${esc(m.exp || "--/--")}</div>
                  <div style="margin-top:10px;">
                    <button class="btn btn-outline btn-sm" type="button" data-pay-del="${esc(m.id)}">Remove</button>
                  </div>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function addPayment(method) {
    const key = userKey("payments");
    const list = readJson(key, []);
    const safe = Array.isArray(list) ? list : [];
    safe.unshift(method);
    writeJson(key, safe);
    renderPayments();
  }

  function deletePayment(id) {
    const key = userKey("payments");
    const list = readJson(key, []);
    const safe = Array.isArray(list) ? list : [];
    writeJson(
      key,
      safe.filter((x) => String(x.id) !== String(id))
    );
    renderPayments();
  }

  function renderReports() {
    if (!els.reportsBody) return;
    const count = state.orders.length;
    els.reportsBody.innerHTML = `
      <div class="account-empty">
        <div style="font-weight:1000;">Download reports</div>
        <div style="margin-top:6px; color:var(--muted); font-weight:800; font-size:13px;">Export your ${count} order${count === 1 ? "" : "s"} for accounting, or download invoices per order.</div>
        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-outline" type="button" id="exportOrdersSecondary">Export orders CSV</button>
          <a class="btn btn-outline" href="./contact.html">Need a formal invoice? Contact us</a>
        </div>
      </div>
    `;
    const btn = $("#exportOrdersSecondary");
    if (btn) btn.addEventListener("click", exportOrdersCsv);
  }

  function renderSettings() {
    if (!els.settingsForm) return;
    const data = readJson(userKey("settings"), { deals: true, updates: true });
    const dealsEl = els.settingsForm.querySelector("[name=deals]");
    const updatesEl = els.settingsForm.querySelector("[name=updates]");
    if (dealsEl) dealsEl.checked = Boolean(data?.deals);
    if (updatesEl) updatesEl.checked = Boolean(data?.updates);
  }

  function saveSettingsFromForm() {
    if (!els.settingsForm) return;
    writeJson(userKey("settings"), {
      deals: Boolean(els.settingsForm.querySelector("[name=deals]")?.checked),
      updates: Boolean(els.settingsForm.querySelector("[name=updates]")?.checked)
    });
    toast("Settings saved.");
  }

  async function loadProducts() {
    try {
      const data = await window.PPS?.loadProducts?.();
      state.products = Array.isArray(data) ? data : [];
      state.productsById = new Map(state.products.map((p) => [String(p.id), p]));
      window._products = state.products;
      renderFavorites();
      renderFrequent();
      renderOrders();
    } catch {
      // ignore
    }
  }

  async function loadOrders() {
    try {
      const res = await fetch(`${window.PPS?.API_BASE}/api/orders`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      state.orders = Array.isArray(data) ? data : [];
      state.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (els.ordersCountBadge) els.ordersCountBadge.textContent = String(state.orders.length);

      const latest = state.orders[0];
      if (els.provinceEl && latest?.customer?.province) {
        const provinceLabelText = window.PPS_I18N?.t("account.province_label") || "{{province}}";
        els.provinceEl.textContent = provinceLabelText.replace("{{province}}", provinceLabel(latest.customer.province));
      }

      renderDashboard();
      renderProfile(latest);
      renderOrders();
      renderFrequent();
      renderReports();
    } catch {
      if (els.ordersMsg) els.ordersMsg.textContent = window.PPS_I18N?.t("account.status.unreachable") || "Server unreachable. Start the backend to load your orders.";
      renderDashboard();
      renderProfile(null);
      renderReports();
    }
  }

  if (els.nameEl) {
    const welcomeName = window.PPS_I18N?.t("account.welcome_name") || "Welcome, {{name}}";
    const welcomeBack = window.PPS_I18N?.t("account.welcome_back") || "Welcome back";
    const displayName = firstName(session.name);
    els.nameEl.textContent = displayName ? welcomeName.replace("{{name}}", displayName) : welcomeBack;
  }
  if (els.badgeEl) els.badgeEl.style.display = "inline-flex";
  if (els.dashboardBadge) els.dashboardBadge.style.display = "inline-flex";

  document.addEventListener("click", (e) => {
    const addrDel = e.target.closest("[data-addr-del]");
    if (addrDel) return deleteAddress(addrDel.getAttribute("data-addr-del"));

    const addrEdit = e.target.closest("[data-addr-edit]");
    if (addrEdit && els.addAddressForm) {
      const id = addrEdit.getAttribute("data-addr-edit");
      const list = readJson(userKey("addresses"), []);
      const addr = (Array.isArray(list) ? list : []).find((x) => String(x.id) === String(id));
      if (!addr) return;
      els.addAddressForm.dataset.editId = String(id);
      ["label", "name", "line1", "line2", "city", "province", "postal", "country"].forEach((k) => {
        const input = els.addAddressForm.querySelector(`[name=${k}]`);
        if (input) input.value = addr[k] || "";
      });
      toast("Editing address...");
      window.location.hash = "#addresses";
      return;
    }

    const payDel = e.target.closest("[data-pay-del]");
    if (payDel) return deletePayment(payDel.getAttribute("data-pay-del"));
  });

  window.addEventListener("hashchange", setActiveNavByHash);
  setActiveNavByHash();

  if (els.orderSearch) els.orderSearch.addEventListener("input", renderOrders);
  if (els.orderStatus) els.orderStatus.addEventListener("change", renderOrders);
  if (els.orderRange) els.orderRange.addEventListener("change", renderOrders);
  if (els.exportOrdersBtn) els.exportOrdersBtn.addEventListener("click", exportOrdersCsv);

  if (els.addAddressForm) {
    els.addAddressForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = els.addAddressForm.dataset.editId || `addr_${Date.now()}`;
      const addr = { id };
      ["label", "name", "line1", "line2", "city", "province", "postal", "country"].forEach((k) => {
        addr[k] = els.addAddressForm.querySelector(`[name=${k}]`)?.value?.trim?.() || "";
      });
      if (!addr.country) addr.country = "Canada";
      upsertAddress(addr);
      els.addAddressForm.reset();
      delete els.addAddressForm.dataset.editId;
      toast("Address saved.");
    });
  }

  if (els.addPaymentForm) {
    els.addPaymentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const label = els.addPaymentForm.querySelector("[name=label]")?.value?.trim?.() || "";
      const brand = els.addPaymentForm.querySelector("[name=brand]")?.value?.trim?.() || "";
      const last4 = String(els.addPaymentForm.querySelector("[name=last4]")?.value || "").replace(/\D/g, "").slice(-4);
      const exp = els.addPaymentForm.querySelector("[name=exp]")?.value?.trim?.() || "";
      if (last4.length !== 4) return toast("Enter the last 4 digits.");
      addPayment({ id: `pm_${Date.now()}`, label, brand, last4, exp });
      els.addPaymentForm.reset();
      toast("Payment method saved.");
    });
  }

  if (els.settingsForm) {
    els.settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveSettingsFromForm();
    });
  }

  if (els.logoutBtn) {
    els.logoutBtn.addEventListener("click", async () => {
      try {
        await fetch(`${window.PPS?.API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` }
        });
      } catch {
        // ignore
      }
      window.PPS?.clearSession?.();
      window.location.href = "./login.html";
    });
  }

  renderAddresses();
  renderPayments();
  renderSettings();
  renderReports();

  loadProducts();
  loadOrders();
})();
