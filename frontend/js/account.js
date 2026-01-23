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
    productsById: new Map(),
    templateEditingId: ""
  };

  const els = {
    year: $("#y"),
    accountMsg: $("#accountMsg"),
    ordersGrid: $("#ordersGrid"),
    ordersMsg: $("#ordersMsg"),
    invoicesList: $("#invoicesList"),
    invoicesMsg: $("#invoicesMsg"),
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
    invoicesCountBadge: $("#invoicesCountBadge"),
    favoritesCountBadge: $("#favoritesCountBadge"),
    orderSearch: $("#orderSearch"),
    orderStatus: $("#orderStatus"),
    orderRange: $("#orderRange"),
    exportOrdersBtn: $("#exportOrders"),
    invoiceSearch: $("#invoiceSearch"),
    invoiceStatus: $("#invoiceStatus"),
    invoiceFrom: $("#invoiceFrom"),
    invoiceTo: $("#invoiceTo"),
    downloadInvoicesRangeBtn: $("#downloadInvoicesRange"),
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
    ,
    templateName: $("#templateName"),
    templateSaveFromCart: $("#templateSaveFromCart"),
    templatesMsg: $("#templatesMsg"),
    templatesList: $("#templatesList"),
    combosMsg: $("#combosMsg"),
    combosGrid: $("#combosGrid")
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
  const tt = (key, fallback) => window.PPS_I18N?.t?.(key) || fallback || "";

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

  const DEFAULT_ADDRESS_ID_KEY = userKey("default_address_id_v1");
  const getStoredDefaultAddressId = () => {
    try {
      return String(localStorage.getItem(DEFAULT_ADDRESS_ID_KEY) || "").trim();
    } catch {
      return "";
    }
  };
  const setStoredDefaultAddressId = (id) => {
    try {
      const next = String(id || "").trim();
      if (!next) localStorage.removeItem(DEFAULT_ADDRESS_ID_KEY);
      else localStorage.setItem(DEFAULT_ADDRESS_ID_KEY, next);
    } catch {
      // ignore
    }
  };
  const resolveDefaultAddressId = (list) => {
    const safe = Array.isArray(list) ? list : [];
    const stored = getStoredDefaultAddressId();
    if (stored && safe.some((a) => String(a?.id) === String(stored))) return stored;
    const first = safe[0]?.id ? String(safe[0].id) : "";
    if (first) setStoredDefaultAddressId(first);
    return first;
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

  const TEMPLATE_KEY = "order_templates_v1";

  const readTemplates = () => {
    const key = userKey(TEMPLATE_KEY);
    const data = readJson(key, { templates: [] });
    const list = Array.isArray(data?.templates) ? data.templates : [];
    return list
      .filter((t) => t && t.id && Array.isArray(t.items) && t.items.length)
      .map((t) => ({
        id: String(t.id),
        name: String(t.name || "Template").trim() || "Template",
        createdAt: String(t.createdAt || ""),
        updatedAt: String(t.updatedAt || ""),
        items: t.items
          .map((it) => ({
            id: String(it?.id || ""),
            name: String(it?.name || ""),
            qty: Math.max(1, Math.round(Number(it?.qty) || 1))
          }))
          .filter((it) => it.id)
      }));
  };

  const writeTemplates = (templates) => {
    const key = userKey(TEMPLATE_KEY);
    const safe = Array.isArray(templates) ? templates.slice(0, 50) : [];
    writeJson(key, { templates: safe });
  };

  const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const normalizeTemplateItems = (items) =>
    (Array.isArray(items) ? items : [])
      .map((it) => ({
        id: String(it?.id || it?.productId || ""),
        name: String(it?.name || ""),
        qty: Math.max(1, Math.round(Number(it?.qty) || 1))
      }))
      .filter((it) => it.id)
      .slice(0, 40);

  const computeCombos = () => {
    // Signature-based combos from order history. We only consider orders with 2+ items.
    const map = new Map(); // sig -> { count, lastAt, itemIds:Set, qtyById:Map<id, qtys[]> }

    state.orders.forEach((o) => {
      const rawItems = Array.isArray(o?.items) ? o.items : [];
      const items = rawItems
        .map((it) => ({ id: String(it?.id || ""), qty: Math.max(1, Math.round(Number(it?.qty) || 1)) }))
        .filter((it) => it.id);
      if (items.length < 2) return;

      // Use full item set signature (stable): sorted IDs.
      const ids = Array.from(new Set(items.map((x) => x.id))).sort();
      const sig = ids.join("|");
      if (!sig) return;

      const entry = map.get(sig) || {
        sig,
        count: 0,
        lastAt: "",
        qtyById: new Map()
      };

      entry.count += 1;
      const createdAt = String(o?.createdAt || "");
      if (!entry.lastAt || new Date(createdAt) > new Date(entry.lastAt)) entry.lastAt = createdAt;

      items.forEach((it) => {
        const list = entry.qtyById.get(it.id) || [];
        list.push(it.qty);
        entry.qtyById.set(it.id, list);
      });

      map.set(sig, entry);
    });

    const combos = Array.from(map.values())
      .filter((c) => c.count >= 2)
      .map((c) => {
        const items = Array.from(c.qtyById.entries())
          .map(([id, qtys]) => {
            const product = state.productsById.get(String(id)) || null;
            const name = product?.name || (state.orders.flatMap((o) => o.items || []).find((it) => String(it.id) === String(id))?.name) || "Item";
            qtys.sort((a, b) => a - b);
            const medianQty = qtys[Math.floor(qtys.length / 2)] || 1;
            return {
              id,
              name,
              qty: Math.max(1, Math.round(Number(medianQty) || 1)),
              product
            };
          })
          .sort((a, b) => (b.qty || 0) - (a.qty || 0));

        const top = items.slice(0, 2).map((it) => `${it.qty}x ${it.name}`);
        const title = top.length ? `Your usual: ${top.join(" + ")}` : "Your usual";

        return {
          sig: c.sig,
          count: c.count,
          lastAt: c.lastAt,
          title,
          items
        };
      })
      .sort((a, b) => {
        if ((b.count || 0) !== (a.count || 0)) return (b.count || 0) - (a.count || 0);
        return new Date(b.lastAt || 0) - new Date(a.lastAt || 0);
      });

    return combos.slice(0, 6);
  };

  const addItemsAndConfirm = (items) => {
    const normalized = normalizeTemplateItems(items);
    if (!normalized.length) return;
    const enriched = normalized
      .map((it) => {
        const p = state.productsById.get(String(it.id)) || {};
        return {
          id: it.id,
          name: it.name || p.name || "Item",
          qty: it.qty,
          priceCents: Number(p.priceCents || 0),
          currency: p.currency || "CAD",
          description: p.description || ""
        };
      })
      .filter((it) => it.id);

    window.PPS?.addItemsToCart?.(enriched);
    window.PPS?.updateCartBadge?.();
    toast(tt("account.toast.added_to_cart", "Added to cart."));
  };

  const saveTemplate = ({ name, items }) => {
    const trimmed = String(name || "").trim();
    const safeName = trimmed || "Order template";
    const normalized = normalizeTemplateItems(items);
    if (!normalized.length) {
      toast(tt("account.templates.empty", "Template is empty."));
      return;
    }
    const now = new Date().toISOString();
    const templates = readTemplates();
    templates.unshift({ id: makeId("tpl"), name: safeName, createdAt: now, updatedAt: now, items: normalized });
    writeTemplates(templates);
    renderTemplates();
    toast(tt("account.templates.saved", "Template saved."));
  };

  function renderTemplates() {
    if (!els.templatesList || !els.templatesMsg) return;
    const labelReorder = tt("account.reorder", "Reorder");
    const labelRename = tt("common.rename", "Rename");
    const labelDelete = tt("common.delete", "Delete");
    const labelSave = tt("common.save", "Save");
    const labelCancel = tt("common.cancel", "Cancel");
    const templates = readTemplates();
    if (!templates.length) {
      els.templatesMsg.textContent = tt("account.templates.none", "No templates yet. Save your cart or a usual combo.");
      els.templatesList.innerHTML = "";
      return;
    }
    els.templatesMsg.textContent = "";
    els.templatesList.innerHTML = templates
      .slice(0, 9)
      .map((t) => {
        const isEditing = String(state.templateEditingId || "") === String(t.id);
        const lines = t.items.slice(0, 4).map((it) => `<div style="color:var(--muted); font-size:13px;">${esc(it.qty)}x ${esc(it.name || "Item")}</div>`).join("");
        const more = Math.max(0, t.items.length - 4);
        return `
          <div class="card fade-in" style="padding:14px;">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
              <div>
                ${
                  isEditing
                    ? `<input class="input" data-template-edit-name="${esc(t.id)}" value="${esc(t.name)}" style="max-width:260px;">`
                    : `<div style="font-weight:1000;">${esc(t.name)}</div>`
                }
                <div style="color:var(--muted); font-size:12px; margin-top:4px;">${t.items.length} item${t.items.length === 1 ? "" : "s"}</div>
              </div>
              <button class="btn btn-primary btn-sm" type="button" data-template-reorder="${esc(t.id)}">${esc(labelReorder)}</button>
            </div>
            <div style="margin-top:10px;">${lines}${more ? `<div style="color:var(--muted); font-size:12px; margin-top:4px;">+${more} more</div>` : ""}</div>
            <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
              ${
                isEditing
                  ? `<button class="btn btn-outline btn-sm" type="button" data-template-rename-save="${esc(t.id)}">${esc(labelSave)}</button>
                     <button class="btn btn-outline btn-sm" type="button" data-template-rename-cancel>${esc(labelCancel)}</button>`
                  : `<button class="btn btn-outline btn-sm" type="button" data-template-rename="${esc(t.id)}">${esc(labelRename)}</button>`
              }
              <button class="btn btn-outline btn-sm" type="button" data-template-delete="${esc(t.id)}">${esc(labelDelete)}</button>
            </div>
          </div>
        `;
      })
      .join("");
    $$(".fade-in").forEach((el) => el.classList.add("show"));
  }

  function renderCombos() {
    if (!els.combosGrid || !els.combosMsg) return;
    if (!state.orders.length) {
      els.combosMsg.textContent = tt("account.combos.empty", "Place a couple of orders and your usual combinations will show here.");
      els.combosGrid.innerHTML = "";
      return;
    }
    const combos = computeCombos().slice(0, 3);
    if (!combos.length) {
      els.combosMsg.textContent = tt("account.combos.none", "No repeated combinations found yet. Reorder a previous order to build your usuals.");
      els.combosGrid.innerHTML = "";
      return;
    }
    const labelReorder = tt("account.combos.reorder", "Reorder combo");
    const labelSave = tt("account.combos.save_template", "Save as template");
    els.combosMsg.textContent = "";
    els.combosGrid.innerHTML = combos
      .map((c) => {
        const topLines = c.items.slice(0, 4).map((it) => `<div style="color:var(--muted); font-size:13px;">${esc(it.qty)}x ${esc(it.name)}</div>`).join("");
        const more = Math.max(0, c.items.length - 4);
        const metaTpl = tt("account.combos.meta", "Ordered {{count}} times · Last: {{date}}");
        const meta = metaTpl
          .replace("{{count}}", String(c.count))
          .replace("{{date}}", fmtShortDate(c.lastAt));
        return `
          <div class="card fade-in" style="padding:14px;">
            <div style="font-weight:1000;">${esc(c.title)}</div>
            <div style="color:var(--muted); font-size:12px; margin-top:4px;">${esc(meta)}</div>
            <div style="margin-top:10px;">${topLines}${more ? `<div style="color:var(--muted); font-size:12px; margin-top:4px;">+${more} more</div>` : ""}</div>
            <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" type="button" data-combo-reorder="${esc(c.sig)}">${esc(labelReorder)}</button>
              <button class="btn btn-outline btn-sm" type="button" data-combo-save="${esc(c.sig)}">${esc(labelSave)}</button>
            </div>
          </div>
        `;
      })
      .join("");
    $$(".fade-in").forEach((el) => el.classList.add("show"));
  }

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

    const labelTrack = tt("account.actions.track", "Track order");
    const labelInvoice = tt("account.actions.invoice", "Invoice (PDF)");
    const labelEmail = tt("account.actions.email_receipt", "Email receipt");
    const labelShare = tt("account.actions.share", "Share");
    const labelReport = tt("account.actions.report_problem", "Report problem");

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
              <button class="btn btn-outline" type="button" onclick="trackOrder('${esc(order.id)}')">${esc(labelTrack)}</button>
              <button class="btn btn-outline" type="button" onclick="downloadInvoice('${esc(order.id)}')">${esc(labelInvoice)}</button>
              <button class="btn btn-outline" type="button" onclick="emailReceipt('${esc(order.id)}')">${esc(labelEmail)}</button>
              <button class="btn btn-outline" type="button" onclick="shareOrder('${esc(order.id)}')">${esc(labelShare)}</button>
              <a class="btn btn-outline" href="${contactIssue}">${esc(labelReport)}</a>
            </div>
          </div>
        `;
      })
      .join("");

    $$(".fade-in").forEach((el) => el.classList.add("show"));
  }

  function parseDateInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const parts = raw.split("-").map((n) => Number(n));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    const dt = new Date(y, m - 1, d);
    const t = dt.getTime();
    if (Number.isNaN(t)) return null;
    return t;
  }

  function getInvoicesFiltered() {
    const q = String(els.invoiceSearch?.value || "").trim().toLowerCase();
    const statusFilter = String(els.invoiceStatus?.value || "").trim().toLowerCase();
    const from = parseDateInput(els.invoiceFrom?.value);
    const toRaw = parseDateInput(els.invoiceTo?.value);
    const to = toRaw == null ? null : toRaw + 24 * 60 * 60 * 1000 - 1;

    return state.orders.filter((order) => {
      const createdAtMs = new Date(order.createdAt).getTime();
      if (from != null && createdAtMs < from) return false;
      if (to != null && createdAtMs > to) return false;
      if (statusFilter && getStatusKey(order.status) !== statusFilter) return false;
      if (!q) return true;
      const hay = [order.id, order.status, fmtShortDate(order.createdAt), ...(order.items || []).map((it) => it.name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderInvoices() {
    if (!els.invoicesList || !els.invoicesMsg) return;

    if (els.invoicesCountBadge) els.invoicesCountBadge.textContent = String(state.orders.length);

    if (!state.orders.length) {
      els.invoicesMsg.textContent = tt("account.invoices.empty", "No invoices yet. Orders will appear here once you place an order.");
      els.invoicesList.innerHTML = "";
      return;
    }

    const filtered = getInvoicesFiltered();
    if (!filtered.length) {
      els.invoicesMsg.textContent = tt("account.invoices.none", "No matching invoices. Try a different search or filters.");
      els.invoicesList.innerHTML = "";
      return;
    }

    els.invoicesMsg.textContent = "";
    const labelInvoice = tt("account.actions.invoice", "Invoice (PDF)");
    const labelEmail = tt("account.actions.email_receipt", "Email receipt");

    els.invoicesList.innerHTML = filtered
      .map((order) => {
        const status = getStatusKey(order.status);
        const currency = order.currency || "CAD";
        const itemSummary = (order.items || [])
          .slice(0, 2)
          .map((it) => `${it.name} x${Number(it.qty) || 0}`)
          .filter(Boolean)
          .join(" · ");
        const more = Math.max(0, (order.items || []).length - 2);
        return `
          <div class="card fade-in" style="padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
              <div>
                <div style="font-weight:1000;">${esc(tt("account.order", "Order"))} #${esc(order.id)}</div>
                <div style="color:var(--muted); font-size:13px; margin-top:4px;">${esc(fmtDateTime(order.createdAt))}${itemSummary ? ` · ${esc(itemSummary)}${more ? ` +${more}` : ""}` : ""}</div>
              </div>
              <div style="text-align:right;">
                <div class="status-pill ${esc(status)}" style="display:inline-flex;">${esc(statusLabel(status))}</div>
                <div style="margin-top:6px; font-weight:1000;">${money(Number(order.totalCents || 0), currency)}</div>
              </div>
            </div>
            <div style="margin-top:10px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
              <button class="btn btn-outline btn-sm" type="button" onclick="emailReceipt('${esc(order.id)}')">${esc(labelEmail)}</button>
              <button class="btn btn-primary btn-sm" type="button" onclick="downloadInvoice('${esc(order.id)}')">${esc(labelInvoice)}</button>
            </div>
          </div>
        `;
      })
      .join("");

    $$(".fade-in").forEach((el) => el.classList.add("show"));
  }

  function downloadInvoicesRangeFromFilters() {
    const from = parseDateInput(els.invoiceFrom?.value);
    const toRaw = parseDateInput(els.invoiceTo?.value);
    if (from == null || toRaw == null) {
      toast(tt("account.invoices.select_range", "Select a start and end date to download a date range."));
      return;
    }

    const filtered = getInvoicesFiltered();
    if (!filtered.length) {
      toast(tt("account.invoices.none", "No matching invoices. Try a different search or filters."));
      return;
    }

    const MAX = 30;
    if (filtered.length > MAX) {
      const tmpl = tt("account.invoices.too_many", "");
      const msg = tmpl
        ? tmpl.replace(/\{\{count\}\}/g, String(filtered.length)).replace(/\{\{max\}\}/g, String(MAX))
        : `Too many invoices (${filtered.length}). Narrow the range to download up to ${MAX} at once.`;
      toast(msg);
    }
    const slice = filtered.slice(0, MAX);
    const title = `Invoices ${String(els.invoiceFrom?.value || "")} to ${String(els.invoiceTo?.value || "")}`.trim();
    downloadInvoicesForOrders(slice, { title: title || "Invoices", autoPrint: true });
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

  const COMPANY_INFO = {
    name: "Power Poly Supplies",
    address: "15725 Weston Rd, Kettleby, ON L7B 0L4",
    email: "powerpolysupplies@gmail.com"
  };

  function getProvinceTaxInfo(code) {
    const c = String(code || "").trim().toUpperCase();
    const map = {
      ON: { label: "HST 13%", rate: 0.13 },
      NS: { label: "HST 15%", rate: 0.15 },
      NB: { label: "HST 15%", rate: 0.15 },
      NL: { label: "HST 15%", rate: 0.15 },
      PE: { label: "HST 15%", rate: 0.15 },
      AB: { label: "GST 5%", rate: 0.05 },
      BC: { label: "GST 5%", rate: 0.05 },
      SK: { label: "GST 5%", rate: 0.05 },
      MB: { label: "GST 5%", rate: 0.05 },
      QC: { label: "GST 5% + QST 9.975%", rate: 0.05, qstRate: 0.09975 },
      YT: { label: "GST 5%", rate: 0.05 },
      NT: { label: "GST 5%", rate: 0.05 },
      NU: { label: "GST 5%", rate: 0.05 }
    };
    return map[c] || { label: tt("invoice.tax", "Tax"), rate: 0 };
  }

  function computeInvoiceTotals(order) {
    const currency = order.currency || "CAD";
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsSubtotalCents = items.reduce((sum, it) => sum + Number(it.priceCents || 0) * Number(it.qty || 0), 0);

    const discountFromOrder = Number(order.discountCents ?? order.discount_cents ?? 0);
    const discountFromRewards = Number(order.customer?.rewards?.amountCents ?? 0);
    const discountCents = Math.max(0, Math.min(itemsSubtotalCents, discountFromOrder || discountFromRewards || 0));
    const discountLabel = String(order.customer?.rewards?.code || "").trim();

    const shippingCents = Math.max(0, Number(order.shipping?.costCents ?? order.shipping?.amountCents ?? 0));
    const shippingLabel = String(order.shipping?.label || tt("invoice.shipping", "Shipping")).trim();

    const province = String(order.customer?.province || session?.province || "").trim().toUpperCase();
    const taxableSubtotalCents = Math.max(0, itemsSubtotalCents - discountCents);
    const taxInfo = getProvinceTaxInfo(province);
    const gstCents = Math.round(taxableSubtotalCents * (Number(taxInfo.rate) || 0));
    const qstCents = taxInfo.qstRate ? Math.round(taxableSubtotalCents * Number(taxInfo.qstRate)) : 0;
    const computedTaxCents = gstCents + qstCents;

    const totalFromOrder = Number(order.totalCents ?? order.total_cents ?? 0);
    const totalComputed = taxableSubtotalCents + shippingCents + computedTaxCents;
    const totalCents = totalFromOrder > 0 ? totalFromOrder : totalComputed;

    let taxCents = Math.max(0, Number(order.taxCents ?? order.tax_cents ?? 0));
    if (!taxCents && computedTaxCents) taxCents = computedTaxCents;
    if (!taxCents && totalCents) {
      taxCents = Math.max(0, totalCents - (taxableSubtotalCents + shippingCents));
    }

    const paymentMethod = String(order.paymentMethod ?? order.payment_method ?? "").trim();

    return {
      currency,
      items,
      itemsSubtotalCents,
      discountCents,
      discountLabel,
      shippingCents,
      shippingLabel,
      taxableSubtotalCents,
      gstCents: qstCents ? gstCents : 0,
      qstCents: qstCents || 0,
      taxCents,
      taxLabel: String(order.taxLabel || taxInfo.label || tt("invoice.tax", "Tax")).trim(),
      totalCents,
      paymentMethod,
      province
    };
  }

  function formatCustomerAddress(customer) {
    const parts = [
      customer?.address1 || customer?.address_line1 || "",
      customer?.address2 || customer?.address_line2 || "",
      [customer?.city || "", customer?.province || "", customer?.postal || ""].filter(Boolean).join(" "),
      customer?.country || ""
    ]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    return parts.join("\n");
  }

  function buildInvoiceSection(order, strings, logoUrl) {
    const totals = computeInvoiceTotals(order);
    const customer = order.customer || {};
    const customerName = String(customer.name || session?.name || "").trim();
    const customerEmail = String(customer.email || session?.email || "").trim();
    const customerPhone = String(customer.phone || session?.phone || "").trim();
    const customerAddress = formatCustomerAddress(customer);

    const itemRows = totals.items
      .map((it) => {
        const qty = Number(it.qty) || 0;
        const unit = Number(it.priceCents || 0);
        const line = unit * qty;
        return `
          <tr>
            <td class="item">${esc(it.name || "")}</td>
            <td class="qty">${qty}</td>
            <td class="num">${esc(money(unit, totals.currency))}</td>
            <td class="num">${esc(money(line, totals.currency))}</td>
          </tr>
        `;
      })
      .join("");

    const discountLine =
      totals.discountCents > 0
        ? `
          <tr>
            <td>${esc(strings.discount)}${totals.discountLabel ? ` (${esc(totals.discountLabel)})` : ""}</td>
            <td class="num">-${esc(money(totals.discountCents, totals.currency))}</td>
          </tr>
        `
        : "";

    const taxLines = totals.qstCents
      ? `
        <tr><td>GST (5%)</td><td class="num">${esc(money(totals.gstCents, totals.currency))}</td></tr>
        <tr><td>QST (9.975%)</td><td class="num">${esc(money(totals.qstCents, totals.currency))}</td></tr>
      `
      : `
        <tr><td>${esc(totals.taxLabel || strings.tax)}</td><td class="num">${esc(money(totals.taxCents, totals.currency))}</td></tr>
      `;

    const methodLine = totals.paymentMethod
      ? `<div class="meta-row"><span class="k">${esc(strings.payment)}</span><span class="v">${esc(totals.paymentMethod)}</span></div>`
      : "";

    const provinceLine = totals.province
      ? `<div class="meta-row"><span class="k">${esc(strings.province)}</span><span class="v">${esc(totals.province)}</span></div>`
      : "";

    return `
      <section class="invoice">
        <div class="top">
          <div class="brand">
            ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="" width="52" height="52">` : ""}
            <div>
              <div class="company">${esc(COMPANY_INFO.name)}</div>
              <div class="muted">${esc(COMPANY_INFO.address)}</div>
              <div class="muted">${esc(COMPANY_INFO.email)}</div>
            </div>
          </div>
          <div class="meta">
            <div class="title">${esc(strings.invoiceTitle)}</div>
            <div class="meta-row"><span class="k">${esc(strings.order)}</span><span class="v">#${esc(order.id)}</span></div>
            <div class="meta-row"><span class="k">${esc(strings.date)}</span><span class="v">${esc(fmtShortDate(order.createdAt))}</span></div>
            <div class="meta-row"><span class="k">${esc(strings.status)}</span><span class="v">${esc(statusLabel(order.status))}</span></div>
            ${methodLine}
            ${provinceLine}
          </div>
        </div>

        <div class="billto">
          <div class="section-title">${esc(strings.billTo)}</div>
          <div class="muted">
            ${customerName ? `${esc(customerName)}<br/>` : ""}
            ${customerEmail ? `${esc(strings.email)}: ${esc(customerEmail)}<br/>` : ""}
            ${customerPhone ? `${esc(strings.phone)}: ${esc(customerPhone)}<br/>` : ""}
            ${customerAddress ? `${esc(customerAddress).replace(/\n/g, "<br/>")}<br/>` : ""}
          </div>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th>${esc(strings.item)}</th>
              <th class="qty">${esc(strings.qty)}</th>
              <th class="num">${esc(strings.unitPrice)}</th>
              <th class="num">${esc(strings.lineTotal)}</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <table class="totals">
          <tbody>
            <tr><td>${esc(strings.subtotal)}</td><td class="num">${esc(money(totals.itemsSubtotalCents, totals.currency))}</td></tr>
            ${discountLine}
            <tr><td>${esc(totals.shippingLabel || strings.shipping)}</td><td class="num">${esc(money(totals.shippingCents, totals.currency))}</td></tr>
            ${taxLines}
            <tr class="grand"><td>${esc(strings.total)}</td><td class="num">${esc(money(totals.totalCents, totals.currency))}</td></tr>
          </tbody>
        </table>
      </section>
    `;
  }

  function openInvoiceWindow({ title, bodyHtml, autoPrint }) {
    const win = window.open("", "_blank");
    if (!win) {
      toast(tt("invoice.popup_blocked", "Popup blocked. Please allow popups to download invoices."));
      return;
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width,initial-scale=1"/>
          <title>${esc(title)}</title>
          <style>
            :root{ --muted:#6b7280; --border:#e5e7eb; --ink:#111827; }
            *{ box-sizing:border-box; }
            body{ margin:0; font-family: Arial, Helvetica, sans-serif; color:var(--ink); background:#f3f4f6; }
            .toolbar{ position:sticky; top:0; z-index:5; background:#111827; color:white; padding:10px 12px; display:flex; gap:10px; align-items:center; justify-content:space-between; }
            .toolbar .btn{ background:white; color:#111827; border:0; border-radius:10px; padding:8px 12px; font-weight:800; cursor:pointer; }
            .toolbar .tip{ font-size:12px; opacity:.9; }
            .wrap{ max-width:960px; margin:0 auto; padding:14px; }
            .invoice{ background:white; border:1px solid var(--border); border-radius:14px; padding:18px; margin:0 0 12px; }
            .top{ display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap; }
            .brand{ display:flex; gap:12px; align-items:center; }
            .logo{ border-radius:10px; border:1px solid var(--border); background:white; }
            .company{ font-weight:1000; font-size:18px; }
            .muted{ color:var(--muted); font-size:12px; line-height:1.45; }
            .meta{ min-width:260px; text-align:right; }
            .title{ font-weight:1000; font-size:16px; }
            .meta-row{ margin-top:6px; display:flex; justify-content:space-between; gap:12px; font-size:12px; }
            .meta-row .k{ color:var(--muted); font-weight:800; }
            .meta-row .v{ font-weight:900; }
            .billto{ margin-top:14px; }
            .section-title{ font-weight:1000; margin-bottom:6px; }
            table{ width:100%; border-collapse:collapse; }
            .items{ margin-top:12px; }
            .items th{ text-align:left; font-size:12px; color:var(--muted); padding:10px 8px; border-bottom:1px solid var(--border); }
            .items td{ padding:10px 8px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
            .items .qty{ text-align:center; width:70px; }
            .items .num{ text-align:right; width:120px; }
            .items td.item{ font-weight:900; }
            .totals{ margin-top:12px; width:340px; margin-left:auto; }
            .totals td{ padding:8px 0; font-size:13px; }
            .totals td.num{ text-align:right; font-weight:900; }
            .totals .grand td{ padding-top:10px; border-top:1px solid var(--border); font-size:15px; }

            @media print{
              body{ background:white; }
              .toolbar{ display:none; }
              .wrap{ max-width:none; padding:0; }
              .invoice{ border:0; border-radius:0; padding:0; margin:0 0 18px; page-break-after:always; }
              .invoice:last-child{ page-break-after:auto; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <div class="tip">${esc(tt("invoice.tip_pdf", "Tip: choose “Save as PDF” in your print dialog."))}</div>
            <button class="btn" type="button" onclick="window.print()">${esc(tt("invoice.print", "Print / Save as PDF"))}</button>
          </div>
          <div class="wrap">${bodyHtml}</div>
          <script>
            (function(){
              const auto = ${autoPrint ? "true" : "false"};
              if(!auto) return;
              setTimeout(()=>{
                try{ window.focus(); }catch(e){}
                try{ window.print(); }catch(e){}
              }, 350);
              try{
                window.onafterprint = ()=>{ try{ window.close(); }catch(e){} };
              }catch(e){}
            })();
          </script>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function downloadInvoicesForOrders(orders, opts = {}) {
    const list = Array.isArray(orders) ? orders.filter(Boolean) : [];
    if (!list.length) return;
    const logoUrl = new URL("./assets/poly%20logo%20without%20background.png", window.location.href).href;
    const strings = {
      invoiceTitle: tt("invoice.title", "Invoice"),
      order: tt("invoice.order", "Order"),
      date: tt("invoice.date", "Date"),
      status: tt("invoice.status", "Status"),
      payment: tt("invoice.payment", "Payment method"),
      province: tt("invoice.province", "Province"),
      billTo: tt("invoice.bill_to", "Bill to"),
      email: tt("invoice.email", "Email"),
      phone: tt("invoice.phone", "Phone"),
      item: tt("invoice.item", "Item"),
      qty: tt("invoice.qty", "Qty"),
      unitPrice: tt("invoice.unit_price", "Unit price"),
      lineTotal: tt("invoice.line_total", "Line total"),
      subtotal: tt("invoice.subtotal", "Subtotal"),
      discount: tt("invoice.discount", "Discount"),
      shipping: tt("invoice.shipping", "Shipping"),
      tax: tt("invoice.tax", "Tax"),
      total: tt("invoice.total", "Total")
    };
    const body = list.map((o) => buildInvoiceSection(o, strings, logoUrl)).join("");
    openInvoiceWindow({
      title: opts.title || (list.length === 1 ? `Invoice ${list[0].id}` : "Invoices"),
      bodyHtml: body,
      autoPrint: opts.autoPrint !== false
    });
  }

  window.downloadInvoice = (orderId) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    downloadInvoicesForOrders([order], { title: `Invoice ${order.id}`, autoPrint: true });
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
    const defaultId = resolveDefaultAddressId(list);
    els.addressesGrid.innerHTML = `
      <div class="profile-grid">
        ${list
          .map(
            (a) => `
              <div class="profile-item">
                <div class="k" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                  <span>${esc(a.label || "Address")}</span>
                  ${String(a.id) === String(defaultId) ? `<span class="count-badge count-badge-muted" title="Default delivery address">Default</span>` : ""}
                </div>
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
                    <button class="btn btn-outline btn-sm" type="button" data-addr-default="${esc(a.id)}" ${String(a.id) === String(defaultId) ? "disabled" : ""}>Set default</button>
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
    const next = safe.filter((x) => String(x.id) !== String(id));
    writeJson(key, next);
    const defaultId = getStoredDefaultAddressId();
    if (defaultId && String(defaultId) === String(id)) {
      const nextDefault = next[0]?.id ? String(next[0].id) : "";
      setStoredDefaultAddressId(nextDefault);
    }
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
      renderInvoices();
      renderTemplates();
      renderCombos();
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
      renderInvoices();
      renderFrequent();
      renderTemplates();
      renderCombos();
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
      const makeDefault = els.addAddressForm.querySelector('[name="makeDefault"]');
      if (makeDefault) makeDefault.checked = String(resolveDefaultAddressId(list)) === String(id);
      toast("Editing address...");
      window.location.hash = "#addresses";
      return;
    }

    const addrDefault = e.target.closest("[data-addr-default]");
    if (addrDefault) {
      const id = String(addrDefault.getAttribute("data-addr-default") || "").trim();
      if (!id) return;
      setStoredDefaultAddressId(id);
      toast("Default address updated.");
      renderAddresses();
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

  if (els.templateSaveFromCart) {
    els.templateSaveFromCart.addEventListener("click", () => {
      const cart = window.PPS?.getCart?.() || [];
      if (!Array.isArray(cart) || !cart.length) {
        toast(tt("account.templates.empty_cart", "Cart is empty."));
        return;
      }
      const name = String(els.templateName?.value || "").trim() || "Weekly Stock";
      saveTemplate({ name, items: cart.map((c) => ({ id: c.id, name: c.name, qty: c.qty })) });
      if (els.templateName) els.templateName.value = "";
    });
  }

  document.addEventListener("click", (e) => {
    const tReorder = e.target.closest("[data-template-reorder]");
    if (tReorder) {
      const id = tReorder.getAttribute("data-template-reorder");
      const t = readTemplates().find((x) => String(x.id) === String(id));
      if (!t) return;
      addItemsAndConfirm(t.items);
      return;
    }

    const tDelete = e.target.closest("[data-template-delete]");
    if (tDelete) {
      const id = tDelete.getAttribute("data-template-delete");
      const next = readTemplates().filter((x) => String(x.id) !== String(id));
      writeTemplates(next);
      renderTemplates();
      toast(tt("account.templates.deleted", "Template deleted."));
      return;
    }

    const tRename = e.target.closest("[data-template-rename]");
    if (tRename) {
      const id = tRename.getAttribute("data-template-rename");
      state.templateEditingId = String(id || "");
      renderTemplates();
      return;
    }

    const tRenameSave = e.target.closest("[data-template-rename-save]");
    if (tRenameSave) {
      const id = tRenameSave.getAttribute("data-template-rename-save");
      const card = tRenameSave.closest(".card");
      const input = card ? card.querySelector("[data-template-edit-name]") : null;
      const nextName = String(input?.value || "").trim();
      if (!nextName) {
        toast(tt("account.templates.enter_name", "Enter a template name."));
        return;
      }
      const templates = readTemplates();
      const t = templates.find((x) => String(x.id) === String(id));
      if (!t) return;
      t.name = nextName;
      t.updatedAt = new Date().toISOString();
      writeTemplates(templates);
      state.templateEditingId = "";
      renderTemplates();
      toast(tt("account.templates.renamed", "Template renamed."));
      return;
    }

    const tRenameCancel = e.target.closest("[data-template-rename-cancel]");
    if (tRenameCancel) {
      state.templateEditingId = "";
      renderTemplates();
      return;
    }

    const cReorder = e.target.closest("[data-combo-reorder]");
    if (cReorder) {
      const sig = cReorder.getAttribute("data-combo-reorder");
      const combo = computeCombos().find((c) => String(c.sig) === String(sig));
      if (!combo) return;
      addItemsAndConfirm(combo.items);
      return;
    }

    const cSave = e.target.closest("[data-combo-save]");
    if (cSave) {
      const sig = cSave.getAttribute("data-combo-save");
      const combo = computeCombos().find((c) => String(c.sig) === String(sig));
      if (!combo) return;
      const defaultName = combo.title.replace(/^Your usual:\s*/i, "").slice(0, 40);
      const nameFromInput = String(els.templateName?.value || "").trim();
      const name = nameFromInput || (defaultName ? `Weekly Stock - ${defaultName}` : "Weekly Stock");
      saveTemplate({ name, items: combo.items });
      if (els.templateName) els.templateName.value = "";
      return;
    }
  });

  window.addEventListener("hashchange", setActiveNavByHash);
  setActiveNavByHash();

  if (els.orderSearch) els.orderSearch.addEventListener("input", renderOrders);
  if (els.orderStatus) els.orderStatus.addEventListener("change", renderOrders);
  if (els.orderRange) els.orderRange.addEventListener("change", renderOrders);
  if (els.exportOrdersBtn) els.exportOrdersBtn.addEventListener("click", exportOrdersCsv);

  if (els.invoiceSearch) els.invoiceSearch.addEventListener("input", renderInvoices);
  if (els.invoiceStatus) els.invoiceStatus.addEventListener("change", renderInvoices);
  if (els.invoiceFrom) els.invoiceFrom.addEventListener("change", renderInvoices);
  if (els.invoiceTo) els.invoiceTo.addEventListener("change", renderInvoices);
  if (els.downloadInvoicesRangeBtn) els.downloadInvoicesRangeBtn.addEventListener("click", downloadInvoicesRangeFromFilters);

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
      const wantsDefault = Boolean(els.addAddressForm.querySelector('[name="makeDefault"]')?.checked);
      const existingDefault = getStoredDefaultAddressId();
      if (wantsDefault || !existingDefault) setStoredDefaultAddressId(id);
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

  const addrCancel = document.getElementById("addrCancelEdit");
  if (addrCancel && els.addAddressForm) {
    addrCancel.addEventListener("click", () => {
      els.addAddressForm.reset();
      delete els.addAddressForm.dataset.editId;
      toast("Address edit cancelled.");
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
