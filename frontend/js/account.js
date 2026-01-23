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
    accountMsg: $("#accountMsg"),
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
    milestonesBody: $("#milestonesBody"),
    analyticsBody: $("#analyticsBody"),
    reportsBody: $("#reportsBody"),
    settingsForm: $("#settingsForm"),
    notifCountBadge: $("#notifCountBadge"),
    milestonesPrefsForm: $("#milestonesPrefsForm")
  };

  if (els.year) els.year.textContent = String(new Date().getFullYear());
  window.PPS?.updateCartBadge?.();
  try {
    window.PPS_NOTIFS?.initAccountCenter?.();
    window.PPS_ACTIVITY?.initAccountActivity?.();
    window.PPS_WISHLISTS?.init?.();
    window.PPS_PAYMENT_METHODS?.init?.();
  } catch {
    // ignore
  }

  // No popups/toasts/alerts: keep feedback inline.
  const toast = (message) => {
    if (!message) return;
    if (!els.accountMsg) return;
    els.accountMsg.textContent = String(message);
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

  const REWARDS_LEDGER_KEY = userKey("rewards_ledger_v1");
  const MILESTONES_PREFS_KEY = userKey("milestones_prefs_v1");

  const getMilestonesPrefs = () => {
    const raw = readJson(MILESTONES_PREFS_KEY, { showMilestones: true });
    return { showMilestones: raw?.showMilestones !== false };
  };

  const saveMilestonesPrefs = (prefs) => {
    const next = { showMilestones: prefs?.showMilestones !== false };
    writeJson(MILESTONES_PREFS_KEY, next);
    return next;
  };

  const getRewardsLedger = () => {
    const raw = readJson(REWARDS_LEDGER_KEY, { redemptions: [] });
    const redemptions = Array.isArray(raw?.redemptions) ? raw.redemptions : [];
    return { redemptions };
  };

  const saveRewardsLedger = (ledger) => {
    const safe = {
      redemptions: Array.isArray(ledger?.redemptions) ? ledger.redemptions.filter(Boolean).slice(0, 200) : []
    };
    writeJson(REWARDS_LEDGER_KEY, safe);
    return safe;
  };

  const pointsFromCents = (cents) => Math.max(0, Math.floor((Number(cents) || 0) / 100));

  const computeRewards = () => {
    const totalSpentCents = state.orders.reduce((s, o) => s + Number(o.totalCents || 0), 0);
    const earned = pointsFromCents(totalSpentCents);
    const ledger = getRewardsLedger();
    const redeemed = ledger.redemptions.reduce((s, r) => s + (Number(r?.pointsCost) || 0), 0);
    const balance = Math.max(0, earned - redeemed);
    return { earned, redeemed, balance, ledger };
  };

  const fmtPoints = (n) => (Number(n) || 0).toLocaleString();

  const makeRewardCode = () => `PPS-${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`;

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

  const DAY_MS = 24 * 60 * 60 * 1000;
  const toDayNumber = (iso) => {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.floor(t / DAY_MS);
  };

  const median = (values) => {
    const v = (Array.isArray(values) ? values : []).map((x) => Number(x) || 0).filter((x) => x > 0).sort((a, b) => a - b);
    if (!v.length) return null;
    return v[Math.floor(v.length / 2)] || null;
  };

  const mean = (values) => {
    const v = (Array.isArray(values) ? values : []).map((x) => Number(x) || 0).filter((x) => Number.isFinite(x) && x > 0);
    if (!v.length) return null;
    return v.reduce((s, x) => s + x, 0) / v.length;
  };

  const predictionText = ({ avgIntervalDays, daysUntilNext }) => {
    const n = Math.max(1, Math.round(Number(avgIntervalDays) || 0));
    if (!Number.isFinite(daysUntilNext)) return "";
    const d = Math.round(daysUntilNext);
    if (d <= 0) return `You typically order every ${n} days — order now?`;
    if (d === 1) return "Based on your pattern, you'll need to reorder in 1 day.";
    return `Based on your pattern, you'll need to reorder in ${d} days.`;
  };

  const computeFrequent = () => {
    const stats = new Map();
    const todayDay = Math.floor(Date.now() / DAY_MS);

    state.orders.forEach((o) => {
      const day = toDayNumber(o?.createdAt);
      (o.items || []).forEach((it) => {
        const id = String(it.id || "");
        if (!id) return;
        const qty = Math.max(0, Number(it.qty) || 0);
        const s = stats.get(id) || { count: 0, qtySum: 0, qtyCount: 0, days: [] };
        s.count += 1;
        if (qty > 0) {
          s.qtySum += qty;
          s.qtyCount += 1;
        }
        if (day !== null) s.days.push(day);
        stats.set(id, s);
      });
    });

    const rows = Array.from(stats.entries()).map(([id, s]) => {
      const uniqueDays = Array.from(new Set(s.days)).sort((a, b) => b - a);
      const intervals = [];
      for (let i = 0; i + 1 < uniqueDays.length; i++) {
        const diff = uniqueDays[i] - uniqueDays[i + 1];
        if (diff > 0) intervals.push(diff);
      }
      const avgIntervalDaysRaw = mean(intervals);
      const avgIntervalDays = avgIntervalDaysRaw ? Math.max(1, Math.round(avgIntervalDaysRaw)) : null;
      const lastDay = uniqueDays.length ? uniqueDays[0] : null;
      const daysSinceLast = lastDay === null ? null : Math.max(0, todayDay - lastDay);
      const daysUntilNext =
        avgIntervalDays && daysSinceLast !== null
          ? Math.round(avgIntervalDays - daysSinceLast)
          : null;

      const avgQty = s.qtyCount ? s.qtySum / s.qtyCount : null;
      const avgQtyRounded = avgQty ? Math.max(1, Math.round(avgQty)) : 1;

      return {
        id,
        count: s.count,
        product: state.productsById.get(id),
        avgQty: avgQtyRounded,
        medianQty: median(
          state.orders.flatMap((o) => (o.items || []).filter((it) => String(it.id) === String(id)).map((it) => Number(it.qty) || 0))
        ) || 1,
        avgIntervalDays,
        daysUntilNext,
        prediction: predictionText({ avgIntervalDays, daysUntilNext }),
      };
    });

    const pinName = "Garment Cover Bags 21x6x42 Extra Heavy";
    const isPinned = (row) => String(row?.product?.name || "").toLowerCase() === pinName.toLowerCase();

    return rows
      .filter((x) => x.product)
      .sort((a, b) => {
        if (isPinned(a) && !isPinned(b)) return -1;
        if (!isPinned(a) && isPinned(b)) return 1;
        return (b.count || 0) - (a.count || 0);
      });
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
    const { earned, redeemed, balance, ledger } = computeRewards();
    const points = balance;
    const tier = earned >= 25000 ? "Gold" : earned >= 10000 ? "Silver" : "Bronze";
    const nextTier = tier === "Bronze" ? "Silver" : tier === "Silver" ? "Gold" : null;
    const nextTarget = tier === "Bronze" ? 10000 : tier === "Silver" ? 25000 : points;
    const progressBase = tier === "Bronze" ? 10000 : tier === "Silver" ? 25000 : points;
    const progress = nextTier ? Math.min(100, Math.round((earned / progressBase) * 100)) : 100;

    const catalog = [
      { id: "disc_5", title: "$5 off your next order", pointsCost: 500, valueCents: 500, kind: "discount" },
      { id: "disc_10", title: "$10 off your next order", pointsCost: 1000, valueCents: 1000, kind: "discount" },
      { id: "disc_25", title: "$25 off your next order", pointsCost: 2500, valueCents: 2500, kind: "discount" },
      { id: "free_20", title: "Free product voucher (up to $20)", pointsCost: 2000, valueCents: 2000, kind: "free_product" }
    ];

    const available = (ledger?.redemptions || []).filter((r) => r && !r.usedAt);

    els.rewardsBody.innerHTML = `
      <div class="insights-grid">
        <div class="insight">
          <div class="insight-title">Points</div>
          <div class="insight-body">${fmtPoints(points)}</div>
          <div class="insight-sub">${fmtPoints(earned)} earned · ${fmtPoints(redeemed)} redeemed</div>
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

      <div style="margin-top:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <div style="font-weight:1000;">Rewards catalog</div>
          <div style="color:var(--muted); font-size:13px;">Redeem points for a code you can use at checkout.</div>
        </div>
        <div class="grid grid-3" style="margin-top:10px;">
          ${catalog
            .map((item) => {
              const canRedeem = points >= item.pointsCost;
              return `
                <div class="card" style="padding:14px;">
                  <div style="font-weight:1000;">${esc(item.title)}</div>
                  <div style="margin-top:6px; color:var(--muted); font-size:13px;">${fmtPoints(item.pointsCost)} points</div>
                  <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn btn-primary btn-sm" type="button" data-reward-redeem="${esc(item.id)}" ${canRedeem ? "" : "disabled"}>${canRedeem ? "Redeem" : "Not enough points"}</button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>

      <div style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <div style="font-weight:1000;">Your reward codes</div>
          <div style="color:var(--muted); font-size:13px;">Unused codes: ${fmtPoints(available.length)}</div>
        </div>
        <div style="margin-top:10px; display:grid; gap:10px;">
          ${
            available.length
              ? available
                  .slice(0, 12)
                  .map((r) => {
                    const code = esc(r.code || "");
                    const title = esc(r.title || "Reward");
                    const createdAt = fmtDateTime(r.createdAt);
                    return `
                      <div class="card" style="padding:14px;">
                        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                          <div>
                            <div style="font-weight:1000;">${title}</div>
                            <div style="color:var(--muted); font-size:13px; margin-top:4px;">Code: <span style="font-weight:900; letter-spacing:.6px;">${code}</span>${createdAt ? ` · ${createdAt}` : ""}</div>
                          </div>
                          <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <a class="btn btn-primary btn-sm" href="./checkout.html?reward=${encodeURIComponent(r.code || "")}">Use at checkout</a>
                            <button class="btn btn-outline btn-sm" type="button" data-reward-copy="${code}">Copy code</button>
                            <button class="btn btn-outline btn-sm" type="button" data-reward-mark-used="${code}">Mark used</button>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : `<div style="color:var(--muted); font-size:13px;">No reward codes yet. Redeem from the catalog above.</div>`
          }
        </div>
      </div>
    `;
  }

  function renderMilestonesPrefs() {
    if (!els.milestonesPrefsForm) return;
    const prefs = getMilestonesPrefs();
    const box = els.milestonesPrefsForm.querySelector('[name="showMilestones"]');
    if (box) box.checked = !!prefs.showMilestones;
  }

  const computeMilestones = () => {
    const ordersCount = state.orders.length;
    const itemsCount = state.orders.reduce((sum, o) => sum + (o?.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0), 0);
    const spentCents = state.orders.reduce((sum, o) => sum + Number(o.totalCents || 0), 0);
    const currency = String(state.orders[0]?.currency || "CAD").toUpperCase();
    const spentDollars = Math.floor(spentCents / 100);

    const defs = [
      {
        id: "loyal_20",
        title: "Loyal customer",
        detail: "20 orders placed",
        metric: { current: ordersCount, target: 20, unit: "orders" }
      },
      {
        id: "loyal_50",
        title: "Loyal customer",
        detail: "50 orders placed",
        metric: { current: ordersCount, target: 50, unit: "orders" }
      },
      {
        id: "bulk_500",
        title: "Bulk buyer",
        detail: "500+ items ordered",
        metric: { current: itemsCount, target: 500, unit: "items" }
      },
      {
        id: "bulk_1000",
        title: "Bulk buyer",
        detail: "1,000+ items ordered",
        metric: { current: itemsCount, target: 1000, unit: "items" }
      },
      {
        id: "partner_5000",
        title: "Trusted partner",
        detail: `${currency} 5,000+ spent`,
        metric: { current: spentDollars, target: 5000, unit: currency }
      },
      {
        id: "partner_10000",
        title: "Trusted partner",
        detail: `${currency} 10,000+ spent`,
        metric: { current: spentDollars, target: 10000, unit: currency }
      }
    ];

    const achieved = defs.filter((d) => (Number(d.metric.current) || 0) >= (Number(d.metric.target) || 0));
    const nextUp = defs.filter((d) => (Number(d.metric.current) || 0) < (Number(d.metric.target) || 0));

    return {
      ordersCount,
      itemsCount,
      spentCents,
      achieved,
      nextUp: nextUp.slice(0, 3)
    };
  };

  function renderMilestones() {
    if (!els.milestonesBody) return;
    const prefs = getMilestonesPrefs();
    if (!prefs.showMilestones) {
      els.milestonesBody.innerHTML = `
        <div class="card" style="padding:14px;">
          <div style="font-weight:1000;">Customer milestones</div>
          <div style="color:var(--muted); font-size:13px; margin-top:6px;">Hidden in your settings.</div>
        </div>
      `;
      return;
    }

    if (!state.orders.length) {
      els.milestonesBody.innerHTML = `
        <div class="card" style="padding:14px;">
          <div style="font-weight:1000;">Customer milestones</div>
          <div style="color:var(--muted); font-size:13px; margin-top:6px;">Place your first order to start building your purchase history.</div>
        </div>
      `;
      return;
    }

    const { achieved, nextUp } = computeMilestones();

    const pill = (label) => `<span class="milestone-pill">${esc(label)}</span>`;
    const progressHtml = (m) => {
      const current = Math.max(0, Number(m?.current) || 0);
      const target = Math.max(1, Number(m?.target) || 1);
      const pct = Math.min(100, Math.round((current / target) * 100));
      return `
        <div class="milestone-progress">
          <div class="milestone-progress-bar" style="width:${pct}%;"></div>
        </div>
        <div class="milestone-sub">${current.toLocaleString()} / ${target.toLocaleString()}</div>
      `;
    };

    els.milestonesBody.innerHTML = `
      <div class="milestones-head">
        <div style="font-weight:1000;">Customer milestones</div>
        <div style="color:var(--muted); font-size:13px;">Based on your orders</div>
      </div>

      ${achieved.length ? `
        <div class="milestone-row" style="margin-top:10px;">
          ${achieved.slice(0, 4).map((m) => pill(`${m.title} · ${m.detail}`)).join("")}
        </div>
      ` : `
        <div style="margin-top:10px; color:var(--muted); font-size:13px;">Milestones will appear here as your order history grows.</div>
      `}

      ${nextUp.length ? `
        <div style="margin-top:12px;">
          <div style="font-weight:1000;">Next up</div>
          <div class="milestone-grid" style="margin-top:10px;">
            ${nextUp.map((m) => `
              <div class="milestone-card">
                <div style="font-weight:1000;">${esc(m.title)}</div>
                <div class="milestone-sub">${esc(m.detail)}</div>
                ${progressHtml(m.metric)}
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
    `;
  }

  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (key) => {
    const [y, m] = String(key || "").split("-");
    const d = new Date(Number(y) || 0, Math.max(0, (Number(m) || 1) - 1), 1);
    try {
      return d.toLocaleDateString(undefined, { month: "short" });
    } catch {
      return key;
    }
  };

  const lastNMonthKeys = (n = 12) => {
    const out = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(monthKey(d));
    }
    return out;
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const svgLineChart = ({ points, labels, unitLabel = "" }) => {
    const w = 640;
    const h = 220;
    const pad = 28;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const max = Math.max(1, ...points.map((x) => Number(x) || 0));
    const min = 0;
    const xFor = (i) => pad + (innerW * (points.length <= 1 ? 0 : i / (points.length - 1)));
    const yFor = (v) => pad + innerH - ((Number(v) || 0) - min) / (max - min) * innerH;

    const poly = points
      .map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`)
      .join(" ");
    const area = `${pad},${pad + innerH} ${poly} ${pad + innerW},${pad + innerH}`;

    const lastLabel = labels[labels.length - 1] || "";
    const lastValue = points[points.length - 1] || 0;

    return `
      <svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(unitLabel)} over time">
        <line class="chart-axis" x1="${pad}" y1="${pad + innerH}" x2="${pad + innerW}" y2="${pad + innerH}"></line>
        <path class="chart-area" d="M ${area} Z"></path>
        <polyline class="chart-line" points="${poly}"></polyline>
        ${points
          .map((v, i) => `<circle class="chart-dot" cx="${xFor(i).toFixed(1)}" cy="${yFor(v).toFixed(1)}" r="${i === points.length - 1 ? 5 : 3}"></circle>`)
          .join("")}
        <text class="chart-label" x="${pad}" y="${pad - 8}">${esc(unitLabel)}</text>
        <text class="chart-label" x="${pad + innerW}" y="${pad - 8}" text-anchor="end">${esc(String(lastLabel))}: ${esc(String(lastValue))}</text>
        ${labels
          .map((l, i) => (i % 2 ? "" : `<text class="chart-label" x="${xFor(i).toFixed(1)}" y="${pad + innerH + 18}" text-anchor="middle">${esc(l)}</text>`))
          .join("")}
      </svg>
    `;
  };

  const svgBarChart = ({ values, labels, unitLabel = "" }) => {
    const w = 640;
    const h = 220;
    const pad = 28;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const max = Math.max(1, ...values.map((x) => Number(x) || 0));
    const barW = innerW / Math.max(1, values.length);
    const yFor = (v) => pad + innerH - (Number(v) || 0) / max * innerH;
    return `
      <svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(unitLabel)} over time">
        <line class="chart-axis" x1="${pad}" y1="${pad + innerH}" x2="${pad + innerW}" y2="${pad + innerH}"></line>
        ${values
          .map((v, i) => {
            const x = pad + i * barW + barW * 0.12;
            const bw = barW * 0.76;
            const y = yFor(v);
            const bh = pad + innerH - y;
            return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="8" fill="rgba(240,127,41,.25)" stroke="rgba(240,127,41,.35)"></rect>`;
          })
          .join("")}
        <text class="chart-label" x="${pad}" y="${pad - 8}">${esc(unitLabel)}</text>
        ${labels
          .map((l, i) => (i % 2 ? "" : `<text class="chart-label" x="${(pad + i * barW + barW / 2).toFixed(1)}" y="${pad + innerH + 18}" text-anchor="middle">${esc(l)}</text>`))
          .join("")}
      </svg>
    `;
  };

  const svgPieChart = ({ parts }) => {
    // parts: [{label, value, color}]
    const total = parts.reduce((s, p) => s + (Number(p.value) || 0), 0) || 1;
    const cx = 110;
    const cy = 110;
    const r = 82;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const circles = parts
      .filter((p) => (Number(p.value) || 0) > 0)
      .map((p) => {
        const frac = (Number(p.value) || 0) / total;
        const dash = frac * c;
        const out = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" stroke="${p.color}" stroke-width="20" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"></circle>`;
        offset += dash;
        return out;
      })
      .join("");
    return `
      <svg class="chart-svg" viewBox="0 0 220 220" role="img" aria-label="Product category breakdown">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" stroke="rgba(17,24,39,.08)" stroke-width="20"></circle>
        <g transform="rotate(-90 ${cx} ${cy})">
          ${circles}
        </g>
        <text class="chart-label" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle">${Math.round(total).toLocaleString()}</text>
      </svg>
    `;
  };

  function renderAnalytics() {
    if (!els.analyticsBody) return;
    if (!state.orders.length) {
      els.analyticsBody.innerHTML = "";
      return;
    }

    const currency = String(state.orders[0]?.currency || "CAD").toUpperCase();
    const totalOrders = state.orders.length;
    const totalSpent = state.orders.reduce((s, o) => s + Number(o.totalCents || 0), 0);
    const avgOrderCents = totalOrders ? Math.round(totalSpent / totalOrders) : 0;

    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1).getTime();
    const ordersThisYear = state.orders.filter((o) => new Date(o.createdAt).getTime() >= yearStart);

    // Monthly spend + frequency (last 12 months)
    const keys = lastNMonthKeys(12);
    const spendByMonth = new Map(keys.map((k) => [k, 0]));
    const countByMonth = new Map(keys.map((k) => [k, 0]));
    state.orders.forEach((o) => {
      const d = new Date(o.createdAt);
      const k = monthKey(d);
      if (!spendByMonth.has(k)) return;
      spendByMonth.set(k, (spendByMonth.get(k) || 0) + Number(o.totalCents || 0));
      countByMonth.set(k, (countByMonth.get(k) || 0) + 1);
    });
    const spendPoints = keys.map((k) => Math.round((spendByMonth.get(k) || 0) / 100));
    const freqPoints = keys.map((k) => countByMonth.get(k) || 0);
    const labels = keys.map(monthLabel);

    // Category breakdown (spend)
    const catSpend = new Map();
    const addCat = (cat, cents) => catSpend.set(cat, (catSpend.get(cat) || 0) + cents);
    state.orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const id = String(it.id || "");
        const p = state.productsById.get(id);
        const cat = String(p?.category || "Other") || "Other";
        const line = (Number(it.priceCents || 0) * Number(it.qty || 0));
        addCat(cat, line);
      });
    });
    const canonical = (cat) => {
      const c = String(cat || "");
      if (/garment/i.test(c)) return "Garment Bags";
      if (/hanger/i.test(c)) return "Hangers";
      if (/poly/i.test(c)) return "Polybags";
      if (/wrap/i.test(c)) return "Wraps";
      if (/rack/i.test(c)) return "Racks";
      return "Other";
    };
    const grouped = new Map();
    Array.from(catSpend.entries()).forEach(([cat, cents]) => {
      const k = canonical(cat);
      grouped.set(k, (grouped.get(k) || 0) + cents);
    });
    const partsBase = Array.from(grouped.entries())
      .map(([label, cents]) => ({ label, value: Math.round(cents / 100) }))
      .sort((a, b) => b.value - a.value);
    const palette = ["#f07f29", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#64748b"];
    const parts = partsBase.slice(0, 6).map((p, i) => ({ ...p, color: palette[i] }));
    const totalParts = parts.reduce((s, p) => s + p.value, 0) || 1;

    // Top product this year (by qty)
    const qtyById = new Map();
    ordersThisYear.forEach((o) => {
      (o.items || []).forEach((it) => {
        const id = String(it.id || "");
        if (!id) return;
        qtyById.set(id, (qtyById.get(id) || 0) + (Number(it.qty) || 0));
      });
    });
    const topId = Array.from(qtyById.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const topQty = topId ? qtyById.get(topId) || 0 : 0;
    const topName = topId ? (state.productsById.get(topId)?.name || (ordersThisYear.flatMap((o) => o.items || []).find((it) => String(it.id) === topId)?.name) || "Item") : "-";

    // Savings vs retail (priceCentsBase vs priceCents)
    const savedLifetime = state.orders.reduce((s, o) => s + moneySavedCentsFromOrder(o), 0);
    const savedThisYear = ordersThisYear.reduce((s, o) => s + moneySavedCentsFromOrder(o), 0);

    const avgItemsPerOrder = totalOrders
      ? Math.round(state.orders.reduce((s, o) => s + (o?.items || []).reduce((t, it) => t + (Number(it.qty) || 0), 0), 0) / totalOrders)
      : 0;

    els.analyticsBody.innerHTML = `
      <div class="analytics-grid">
        <div class="chart-card">
          <div class="chart-head">
            <div>
              <div class="chart-title">Monthly spending</div>
              <div class="chart-sub">Last 12 months (${esc(currency)})</div>
            </div>
          </div>
          <div class="chart-wrap">
            ${svgLineChart({ points: spendPoints, labels, unitLabel: `Spend (${currency})` })}
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-head">
            <div>
              <div class="chart-title">Order frequency</div>
              <div class="chart-sub">Orders per month (last 12 months)</div>
            </div>
          </div>
          <div class="chart-wrap">
            ${svgBarChart({ values: freqPoints, labels, unitLabel: "Orders" })}
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-head">
            <div>
              <div class="chart-title">Product breakdown</div>
              <div class="chart-sub">Share of spend by category</div>
            </div>
          </div>
          <div class="chart-wrap" style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
            <div style="width:220px; max-width:220px;">
              ${svgPieChart({ parts })}
            </div>
            <div class="chart-legend" style="flex:1 1 240px;">
              ${parts
                .map((p) => {
                  const pct = Math.round((p.value / totalParts) * 100);
                  return `
                    <div class="legend-item">
                      <span class="legend-swatch" style="background:${p.color};"></span>
                      <span>${esc(p.label)}: ${pct}%</span>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-head">
            <div>
              <div class="chart-title">Smart insights</div>
              <div class="chart-sub">Based on your orders</div>
            </div>
          </div>
          <div class="insights-list">
            <div class="insight-row">
              <span class="insight-k">Average per order</span>
              <span class="insight-v">${money(avgOrderCents, currency)}</span>
            </div>
            <div class="insight-row">
              <span class="insight-k">Average items per order</span>
              <span class="insight-v">${avgItemsPerOrder}</span>
            </div>
            <div class="insight-row">
              <span class="insight-k">Top product (${year})</span>
              <span class="insight-v">${esc(topName)} · ${topQty} units</span>
            </div>
            <div class="insight-row">
              <span class="insight-k">Saved vs retail (lifetime)</span>
              <span class="insight-v">${money(savedLifetime, currency)}</span>
            </div>
            <div class="insight-row">
              <span class="insight-k">Saved vs retail (${year})</span>
              <span class="insight-v">${money(savedThisYear, currency)}</span>
            </div>
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
    renderAnalytics();
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

        const itemRows = (order.items || [])
          .map((it) => {
            const p = state.productsById.get(String(it.id || "")) || {};
            const desc = descForLang(p);
            const img = p.image || "./assets/poly%20logo%20without%20background.png";
            const reviewHref = p.slug ? `./product.html?slug=${encodeURIComponent(p.slug)}#reviewForm` : "";
            const lineTotal = Number(it.priceCents || 0) * Number(it.qty || 0);
            return `
              <div class="order-item">
                <img class="order-thumb" src="${esc(img)}" alt="${esc(it.name || "")}" loading="lazy" decoding="async" width="60" height="60">
                <div>
                  <div class="order-item-title">${esc(it.name || "")}</div>
                  <div class="order-item-qty">Qty: ${Number(it.qty) || 0}</div>
                  ${desc ? `<div class="order-item-desc">${esc(desc)}</div>` : ""}
                  ${reviewHref ? `<div style="margin-top:8px;"><a class="btn btn-outline btn-sm" style="padding:6px 10px; font-size:12px;" href="${reviewHref}">Write review</a></div>` : ""}
                </div>
                <div class="order-item-price">${money(lineTotal, currency)}</div>
              </div>
            `;
          })
          .join("");

        const estimateDelivery = () => {
          const created = new Date(order.createdAt);
          if (Number.isNaN(created.getTime())) return { label: "Estimated delivery", value: "-" };

          if (["delivered", "fulfilled"].includes(status)) {
            return { label: "Delivered", value: fmtShortDate(created) };
          }

          const start = new Date(created);
          const end = new Date(created);
          const startDays = status === "shipped" ? 1 : status === "processing" ? 2 : 2;
          const endDays = status === "shipped" ? 3 : status === "processing" ? 5 : 4;
          start.setDate(start.getDate() + startDays);
          end.setDate(end.getDate() + endDays);
          return { label: "Estimated delivery", value: `${fmtShortDate(start)} - ${fmtShortDate(end)}` };
        };
        const eta = estimateDelivery();

        const contactTracking = `./contact.html?topic=tracking&order=${encodeURIComponent(order.id)}`;
        const contactIssue = `./contact.html?topic=issue&order=${encodeURIComponent(order.id)}`;

        const thumbs = (order.items || [])
          .map((it) => state.productsById.get(String(it.id || "")) || {})
          .filter((p) => p && p.image)
          .slice(0, 3);
        const moreCount = Math.max(0, (order.items || []).length - thumbs.length);
        const thumbsHtml = thumbs.length
          ? `
            <div class="order-summary-thumbs" aria-label="Order items">
              ${thumbs.map((p) => `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" width="34" height="34">`).join("")}
              ${moreCount ? `<span class="order-summary-more">+${moreCount}</span>` : ""}
            </div>
          `
          : "";

        return `
          <div class="card fade-in order-card">
            <div class="order-top">
              <div class="order-top-left">
                ${thumbsHtml}
                <div>
                  <div class="order-id">Order #${esc(order.id)}</div>
                  <div class="order-date">${esc(fmtDateTime(order.createdAt))}</div>
                  <div style="margin-top:6px; font-weight:1000;">${esc(eta.label)}: <span style="color:rgba(17,24,39,.95);">${esc(eta.value)}</span></div>
                </div>
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
                      <div class="track-step ${i < step ? "done" : ""} ${i === step ? "active" : ""} ${step === 3 && i <= 3 ? "done" : ""}">
                        <div class="dot"></div>
                        <div class="label">${label}</div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>
            <div class="order-items">${itemRows}</div>
            <div class="order-actions">
              <button class="btn btn-primary" type="button" onclick="reorder('${esc(order.id)}')">${window.PPS_I18N?.t("account.reorder") || "Reorder"}</button>
              <button class="btn btn-outline" type="button" onclick="trackOrder('${esc(order.id)}')">Track order</button>
              <button class="btn btn-outline" type="button" onclick="downloadInvoice('${esc(order.id)}')">Download invoice</button>
              <button class="btn btn-outline" type="button" onclick="emailReceipt('${esc(order.id)}')">Email receipt</button>
              <button class="btn btn-outline" type="button" onclick="shareOrder('${esc(order.id)}')">Share</button>
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
    renderMilestones();
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

  window.trackOrder = (orderId) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    const url = `./contact.html?topic=tracking&order=${encodeURIComponent(order.id)}`;
    window.location.href = url;
  };

  window.emailReceipt = (orderId) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    const currency = order.currency || "CAD";
    const lines = (order.items || []).map((it) => `- ${it.name} x${it.qty}`).join("\n");
    const subject = `Receipt - Order ${order.id} (Power Poly Supplies)`;
    const body =
      `Power Poly Supplies - Receipt\n` +
      `Order: ${order.id}\n` +
      `Date: ${fmtShortDate(order.createdAt)}\n` +
      `Status: ${statusLabel(order.status)}\n` +
      `Total: ${money(order.totalCents, currency)}\n\n` +
      `Items:\n${lines}\n\n` +
      `Need help? Reply with your order number.`;

    const to = encodeURIComponent(String(session?.email || "").trim());
    const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
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
      if (navigator.share) {
        await navigator.share({ title: `Order ${order.id}`, text });
        toast("Shared.");
        return;
      }
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
      .map(({ product, count, avgQty, prediction }, idx) => {
        const defaultQty = Math.max(1, Math.round(Number(avgQty) || 1));
        return `
          <div class="card fade-in">
            <a href="./product.html?slug=${encodeURIComponent(product.slug)}">
              <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" decoding="async" width="400" height="190">
            </a>
            <div class="card-body">
              <a class="card-title" style="text-decoration:none; display:inline-block;" href="./product.html?slug=${encodeURIComponent(product.slug)}">${esc(product.name)}</a>
              <div class="card-meta">
                ${idx === 0 ? `<span class="count-badge count-badge-muted" title="Frequently ordered" style="margin-right:8px;">Frequently ordered</span>` : ""}
                Ordered ${count} time${count === 1 ? "" : "s"} &middot; Avg qty: ${defaultQty}
              </div>
              ${prediction ? `<div style="margin-top:8px; color:var(--muted); font-size:13px;">${esc(prediction)}</div>` : ""}
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <label style="display:flex; align-items:center; gap:8px; font-weight:800;">
                  <span style="color:var(--muted); font-size:13px;">Qty</span>
                  <input class="input" type="number" min="1" step="1" value="${defaultQty}" style="max-width:110px;" data-freq-qty>
                </label>
                <button class="btn btn-primary" ${product.stock <= 0 ? "disabled" : ""} type="button" data-freq-add="${esc(product.id)}">Add to cart</button>
                <button class="btn btn-outline" type="button" onclick="addFav('${esc(product.id)}')">Favorite</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
    $$(".fade-in").forEach((el) => el.classList.add("show"));

    if (!state._frequentBound) {
      state._frequentBound = true;
      els.frequentGrid.addEventListener("click", (e) => {
        const btn = e.target.closest?.("[data-freq-add]");
        if (!btn) return;
        const productId = String(btn.getAttribute("data-freq-add") || "");
        const card = btn.closest(".card");
        const input = card ? card.querySelector("[data-freq-qty]") : null;
        const qty = Math.max(1, Math.round(Number(input?.value) || 1));
        window.quickAdd?.(productId, qty);
      });
    }
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
      try {
        const favorites = window.PPS?.getFavorites?.() || [];
        const frequent = computeFrequent();
        window.PPS_NOTIFS?.refreshFromAccount?.({ session, orders: state.orders, products: state.products, favorites, frequent });
        window.PPS_NOTIFS?.initAccountCenter?.();
        window.PPS_WISHLISTS?.setContext?.({ orders: state.orders, products: state.products });
      } catch {
        // ignore
      }
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
      try {
        const favorites = window.PPS?.getFavorites?.() || [];
        const frequent = computeFrequent();
        window.PPS_NOTIFS?.refreshFromAccount?.({ session, orders: state.orders, products: state.products, favorites, frequent });
        window.PPS_NOTIFS?.initAccountCenter?.();
        window.PPS_WISHLISTS?.setContext?.({ orders: state.orders, products: state.products });
      } catch {
        // ignore
      }
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

    const redeemBtn = e.target.closest("[data-reward-redeem]");
    if (redeemBtn) {
      const id = redeemBtn.getAttribute("data-reward-redeem") || "";
      const { balance, ledger } = computeRewards();
      const catalog = {
        disc_5: { title: "$5 off your next order", pointsCost: 500, valueCents: 500, kind: "discount" },
        disc_10: { title: "$10 off your next order", pointsCost: 1000, valueCents: 1000, kind: "discount" },
        disc_25: { title: "$25 off your next order", pointsCost: 2500, valueCents: 2500, kind: "discount" },
        free_20: { title: "Free product voucher (up to $20)", pointsCost: 2000, valueCents: 2000, kind: "free_product" }
      };
      const item = catalog[id];
      if (!item) return;
      if (balance < item.pointsCost) return;

      const code = makeRewardCode();
      const next = {
        id: `rw_${Date.now()}`,
        code,
        kind: item.kind,
        title: item.title,
        pointsCost: item.pointsCost,
        valueCents: item.valueCents,
        createdAt: new Date().toISOString(),
        usedAt: ""
      };
      const updated = saveRewardsLedger({ redemptions: [next, ...(ledger?.redemptions || [])] });
      toast(`Redeemed: ${item.title}. Code: ${code}`);
      try{
        window.PPS_ACTIVITY?.record?.("reward_redeemed", { title: item.title, code, pointsCost: item.pointsCost });
      }catch{
        // ignore
      }
      renderRewards();
      return;
    }

    const copyBtn = e.target.closest("[data-reward-copy]");
    if (copyBtn) {
      const code = copyBtn.getAttribute("data-reward-copy") || "";
      if (!code) return;
      (async () => {
        try {
          await navigator.clipboard.writeText(code);
          toast("Reward code copied.");
        } catch {
          toast("Could not copy (clipboard blocked).");
        }
      })();
      return;
    }

    const usedBtn = e.target.closest("[data-reward-mark-used]");
    if (usedBtn) {
      const code = usedBtn.getAttribute("data-reward-mark-used") || "";
      if (!code) return;
      const ledger = getRewardsLedger();
      const next = (ledger.redemptions || []).map((r) => {
        if (!r) return r;
        if (String(r.code || "") !== String(code)) return r;
        if (r.usedAt) return r;
        return { ...r, usedAt: new Date().toISOString() };
      });
      saveRewardsLedger({ redemptions: next });
      toast("Reward marked used.");
      try{
        window.PPS_ACTIVITY?.record?.("reward_used", { code });
      }catch{
        // ignore
      }
      renderRewards();
      return;
    }
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
      try{
        window.PPS_ACTIVITY?.record?.("address_saved", { label: addr.label || "" });
      }catch{
        // ignore
      }
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
      try{
        window.PPS_ACTIVITY?.record?.("payment_saved", { label: label || (brand ? `${brand} ••••${last4}` : "") });
      }catch{
        // ignore
      }
    });
  }

  if (els.settingsForm) {
    els.settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveSettingsFromForm();
      try{
        window.PPS_ACTIVITY?.record?.("settings_update", {});
      }catch{
        // ignore
      }
    });
  }

  if (els.milestonesPrefsForm) {
    els.milestonesPrefsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const show = Boolean(els.milestonesPrefsForm.querySelector('[name="showMilestones"]')?.checked);
      saveMilestonesPrefs({ showMilestones: show });
      toast("Milestones settings saved.");
      renderMilestones();
      renderMilestonesPrefs();
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
      try{
        window.PPS_ACTIVITY?.record?.("logout", {});
      }catch{
        // ignore
      }
      window.PPS?.clearSession?.();
      window.location.href = "./login.html";
    });
  }

  renderAddresses();
  renderPayments();
  renderSettings();
  renderMilestonesPrefs();
  renderReports();

  loadProducts();
  loadOrders();
})();
