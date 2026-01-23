// Notification center (in-app only).
// No browser notifications, no alerts, no popups.

(() => {
  "use strict";

  const MAX_NOTIFS = 250;
  const STORAGE_SUFFIX_NOTIFS = "notifications_v1";
  const STORAGE_SUFFIX_PREFS = "notif_prefs_v1";
  const STORAGE_SUFFIX_SNAPSHOT = "notif_snapshot_v1";

  const DEFAULT_PREFS = {
    orderUpdates: true,
    backInStock: true,
    memberDeals: true,
    lowStock: true,
    priceDrops: true,
    lowStockThreshold: 20,
    priceDropPercent: 5,
    watchedProductIds: []
  };

  const TYPE_META = {
    order_update: { label: "Order update" },
    back_in_stock: { label: "Back in stock" },
    member_deal: { label: "Member deal" },
    low_stock: { label: "Low stock" },
    price_drop: { label: "Price drop" }
  };

  const stateByEmail = new Map();

  const nowIso = () => new Date().toISOString();
  const safeEmail = (value) => String(value || "").trim().toLowerCase();
  const userKey = (email, suffix) => `pps_account_${safeEmail(email)}_${suffix}`;

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
      return true;
    } catch {
      return false;
    }
  };

  const normalizePrefs = (prefs) => {
    const out = { ...DEFAULT_PREFS, ...(prefs || {}) };
    out.lowStockThreshold = Math.max(0, Math.round(Number(out.lowStockThreshold) || DEFAULT_PREFS.lowStockThreshold));
    out.priceDropPercent = Math.max(0, Math.min(90, Math.round(Number(out.priceDropPercent) || DEFAULT_PREFS.priceDropPercent)));
    out.watchedProductIds = Array.from(new Set((out.watchedProductIds || []).map((x) => String(x || "").trim()).filter(Boolean)));
    out.orderUpdates = Boolean(out.orderUpdates);
    out.backInStock = Boolean(out.backInStock);
    out.memberDeals = Boolean(out.memberDeals);
    out.lowStock = Boolean(out.lowStock);
    out.priceDrops = Boolean(out.priceDrops);
    return out;
  };

  const getPrefs = (email) => normalizePrefs(readJson(userKey(email, STORAGE_SUFFIX_PREFS), DEFAULT_PREFS));
  const setPrefs = (email, prefs) => {
    const normalized = normalizePrefs(prefs);
    writeJson(userKey(email, STORAGE_SUFFIX_PREFS), normalized);
    emitChanged(email);
    return normalized;
  };

  const getNotifications = (email) => {
    const list = readJson(userKey(email, STORAGE_SUFFIX_NOTIFS), []);
    return Array.isArray(list) ? list : [];
  };

  const setNotifications = (email, list) => {
    const safe = (Array.isArray(list) ? list : [])
      .filter(Boolean)
      .slice(0, MAX_NOTIFS);
    writeJson(userKey(email, STORAGE_SUFFIX_NOTIFS), safe);
    emitChanged(email);
    return safe;
  };

  const computeUnreadCount = (email) => {
    const list = getNotifications(email);
    return list.reduce((sum, n) => sum + (!n?.readAt ? 1 : 0), 0);
  };

  const emitChanged = (email) => {
    const unread = computeUnreadCount(email);
    window.dispatchEvent(new CustomEvent("pps:notifs", { detail: { email: safeEmail(email), unread } }));
  };

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const hasDuplicate = (existing, type, dedupeKey) =>
    existing.some((n) => n?.type === type && String(n?.meta?.dedupeKey || "") === String(dedupeKey || ""));

  const refreshFromAccount = ({ session, orders, products, favorites, frequent }) => {
    const email = safeEmail(session?.email);
    if (!email) return { created: 0, unread: 0 };

    const prefs = getPrefs(email);
    const existing = getNotifications(email);
    const snapshotKey = userKey(email, STORAGE_SUFFIX_SNAPSHOT);
    const snapshot = readJson(snapshotKey, { orders: {}, products: {} });
    const prevOrders = snapshot?.orders && typeof snapshot.orders === "object" ? snapshot.orders : {};
    const prevProducts = snapshot?.products && typeof snapshot.products === "object" ? snapshot.products : {};

    const productList = Array.isArray(products) ? products : [];
    const productsById = new Map(productList.map((p) => [String(p?.id || ""), p]).filter((x) => x[0]));

    const favoriteIds = Array.isArray(favorites) ? favorites.map((x) => String(x || "")) : [];
    const frequentIds = Array.isArray(frequent)
      ? frequent
        .filter((x) => (Number(x?.count) || 0) >= 2)
        .map((x) => String(x?.id || ""))
        .filter(Boolean)
      : [];

    const watched = prefs.watchedProductIds.length ? prefs.watchedProductIds : favoriteIds;
    const watchedSet = new Set(watched.filter(Boolean));
    const frequentSet = new Set(frequentIds);

    const created = [];

    // Order updates: compare status snapshot.
    if (prefs.orderUpdates && Array.isArray(orders)) {
      orders.forEach((order) => {
        const id = String(order?.id || "");
        if (!id) return;
        const nextStatus = String(order?.status || "pending");
        const prevStatus = String(prevOrders[id] || "");
        prevOrders[id] = nextStatus;
        if (!prevStatus || prevStatus === nextStatus) return;

        const dedupeKey = `order:${id}:${prevStatus}->${nextStatus}`;
        if (hasDuplicate(existing, "order_update", dedupeKey)) return;

        created.push({
          id: makeId("n"),
          type: "order_update",
          title: `Order ${id} updated`,
          message: `Status changed from ${prevStatus} to ${nextStatus}.`,
          createdAt: nowIso(),
          readAt: "",
          meta: { orderId: id, prevStatus, nextStatus, dedupeKey }
        });
      });
    }

    // Product-based signals: stock + price snapshots.
    productList.forEach((p) => {
      const id = String(p?.id || "");
      if (!id) return;
      const stock = Math.max(0, Math.round(Number(p?.stock) || 0));
      const priceCents = Math.max(0, Math.round(Number(p?.priceCents) || 0));
      const special = Boolean(p?.special);

      const prev = prevProducts[id] && typeof prevProducts[id] === "object" ? prevProducts[id] : {};
      const prevStock = Math.max(0, Math.round(Number(prev.stock) || 0));
      const prevPrice = Math.max(0, Math.round(Number(prev.priceCents) || 0));
      const prevSpecial = Boolean(prev.special);

      prevProducts[id] = { stock, priceCents, special };

      const name = String(p?.name || "Item");
      const slug = String(p?.slug || "");
      const productMeta = { productId: id, slug, name };

      const isWatched = watchedSet.has(id);
      const isFrequent = frequentSet.has(id);

      if (prefs.backInStock && isWatched && prevStock === 0 && stock > 0) {
        const dedupeKey = `back:${id}:${prevStock}->${stock}`;
        if (!hasDuplicate(existing, "back_in_stock", dedupeKey)) {
          created.push({
            id: makeId("n"),
            type: "back_in_stock",
            title: "Back in stock",
            message: `${name} is available again (${stock} in stock).`,
            createdAt: nowIso(),
            readAt: "",
            meta: { ...productMeta, dedupeKey }
          });
        }
      }

      if (prefs.lowStock && isFrequent) {
        const threshold = Math.max(0, Math.round(Number(prefs.lowStockThreshold) || 0));
        const crossed = prevStock > threshold && stock <= threshold;
        if (threshold > 0 && crossed) {
          const dedupeKey = `low:${id}:${prevStock}->${stock}:t${threshold}`;
          if (!hasDuplicate(existing, "low_stock", dedupeKey)) {
            created.push({
              id: makeId("n"),
              type: "low_stock",
              title: "Low stock warning",
              message: `${name} is low on stock (${stock} left).`,
              createdAt: nowIso(),
              readAt: "",
              meta: { ...productMeta, stock, threshold, dedupeKey }
            });
          }
        }
      }

      if (prefs.priceDrops && isWatched && prevPrice > 0 && priceCents > 0 && priceCents < prevPrice) {
        const pct = Math.round(((prevPrice - priceCents) / prevPrice) * 100);
        const minPct = Math.max(0, Math.round(Number(prefs.priceDropPercent) || 0));
        if (pct >= minPct) {
          const dedupeKey = `price:${id}:${prevPrice}->${priceCents}`;
          if (!hasDuplicate(existing, "price_drop", dedupeKey)) {
            created.push({
              id: makeId("n"),
              type: "price_drop",
              title: "Price drop",
              message: `${name} dropped by ${pct}% (from ${(prevPrice / 100).toFixed(2)} to ${(priceCents / 100).toFixed(2)}).`,
              createdAt: nowIso(),
              readAt: "",
              meta: { ...productMeta, prevPriceCents: prevPrice, priceCents, pct, dedupeKey }
            });
          }
        }
      }

      // Member-only deals: notify once when a product becomes special (or first time we see it special).
      if (prefs.memberDeals && (isWatched || isFrequent) && special && !prevSpecial) {
        const dedupeKey = `deal:${id}:${prevSpecial ? 1 : 0}->${special ? 1 : 0}`;
        if (!hasDuplicate(existing, "member_deal", dedupeKey)) {
          created.push({
            id: makeId("n"),
            type: "member_deal",
            title: "Member-only deal",
            message: `${name} is now in Special Offers.`,
            createdAt: nowIso(),
            readAt: "",
            meta: { ...productMeta, dedupeKey }
          });
        }
      }
    });

    writeJson(snapshotKey, { orders: prevOrders, products: prevProducts });

    if (created.length) {
      const merged = [...created, ...existing].slice(0, MAX_NOTIFS);
      setNotifications(email, merged);
    } else {
      emitChanged(email);
    }

    stateByEmail.set(email, {
      email,
      productsById,
      favorites: favoriteIds,
      frequentIds
    });

    return { created: created.length, unread: computeUnreadCount(email) };
  };

  const getCurrentEmail = () => safeEmail(window.PPS?.getSession?.()?.email);

  const updateBadgesInDom = (email) => {
    const unread = computeUnreadCount(email);
    const badges = Array.from(document.querySelectorAll("[data-notif-badge], #notifCountBadge"));
    badges.forEach((el) => {
      el.textContent = String(unread);
      el.style.display = unread ? "" : "none";
    });
  };

  const renderAccountCenter = () => {
    const email = getCurrentEmail();
    if (!email) return;
    const root = document;
    const listEl = root.getElementById("notificationsList");
    const msgEl = root.getElementById("notificationsMsg");
    const typeFilterEl = root.getElementById("notifTypeFilter");
    const tabs = Array.from(root.querySelectorAll("[data-notif-tab]"));
    if (!listEl) return;

    const tab = String(root.body?.dataset?.notifTab || "all");
    const type = String(typeFilterEl?.value || "");
    const notifs = getNotifications(email);

    let shown = notifs.slice();
    if (tab === "unread") shown = shown.filter((n) => !n?.readAt);
    if (type) shown = shown.filter((n) => String(n?.type || "") === type);

    tabs.forEach((b) => b.classList.toggle("active", String(b.getAttribute("data-notif-tab")) === tab));

    if (msgEl) {
      msgEl.textContent = shown.length
        ? ""
        : (tab === "unread" ? "No unread updates right now." : "No notifications yet.");
    }

    const ctx = stateByEmail.get(email);
    const productHref = (n) => {
      const slug = String(n?.meta?.slug || "");
      if (!slug) return "";
      return `./product.html?slug=${encodeURIComponent(slug)}`;
    };

    listEl.innerHTML = shown
      .map((n) => {
        const typeKey = String(n?.type || "");
        const label = TYPE_META[typeKey]?.label || typeKey;
        const isUnread = !n?.readAt;
        const time = formatTime(n?.createdAt);
        const title = String(n?.title || "");
        const message = String(n?.message || "");
        const href = typeKey === "order_update" ? "./account.html#orders" : productHref(n);
        const primaryText = typeKey === "order_update" ? "View orders" : (href ? "View item" : "");
        const pillClass = `notif-pill ${typeKey}`;
        return `
          <div class="notif-item ${isUnread ? "unread" : ""}" data-notif-id="${String(n?.id || "")}">
            <div class="notif-top">
              <span class="${pillClass}">${label}</span>
              <span class="notif-time">${time}</span>
            </div>
            <div class="notif-title">${escapeHtml(title)}</div>
            <div class="notif-body">${escapeHtml(message)}</div>
            <div class="notif-row">
              ${primaryText ? `<a class="btn btn-outline btn-sm" href="${href}">${primaryText}</a>` : ""}
              <div class="notif-row-spacer"></div>
              <button class="btn btn-outline btn-sm" type="button" data-notif-toggle-read>${isUnread ? "Mark read" : "Mark unread"}</button>
              <button class="btn btn-outline btn-sm" type="button" data-notif-delete>Remove</button>
            </div>
          </div>
        `;
      })
      .join("");

    // Preferences & watchlist
    renderPrefs(email, ctx?.productsById, ctx?.favorites || []);

    updateBadgesInDom(email);
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

  const renderPrefs = (email, productsById, favoriteIds) => {
    const prefs = getPrefs(email);
    const form = document.getElementById("notifPrefsForm");
    if (!form) return;

    const setChecked = (name, checked) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.checked = Boolean(checked);
    };
    const setValue = (name, value) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.value = String(value ?? "");
    };

    setChecked("orderUpdates", prefs.orderUpdates);
    setChecked("backInStock", prefs.backInStock);
    setChecked("memberDeals", prefs.memberDeals);
    setChecked("lowStock", prefs.lowStock);
    setChecked("priceDrops", prefs.priceDrops);
    setValue("lowStockThreshold", prefs.lowStockThreshold);
    setValue("priceDropPercent", prefs.priceDropPercent);

    const watchWrap = document.getElementById("notifWatchlist");
    const hint = document.getElementById("notifWatchHint");
    if (!watchWrap) return;

    const favorites = Array.isArray(favoriteIds) ? favoriteIds : [];
    const ids = favorites.filter(Boolean);

    if (!productsById || !ids.length) {
      if (hint) hint.textContent = "Tip: favorite items to watch them for back-in-stock and price drops.";
      watchWrap.innerHTML = "";
      return;
    }

    const current = new Set(prefs.watchedProductIds || []);
    const items = ids
      .map((id) => {
        const p = productsById.get(String(id));
        if (!p) return null;
        return {
          id: String(p.id),
          name: String(p.name || "Item")
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (hint) {
      hint.textContent = prefs.watchedProductIds.length
        ? "Watched items are used for back-in-stock + price-drop alerts."
        : "No custom watchlist set. Favorites are watched by default.";
    }

    watchWrap.innerHTML = items
      .map((it) => {
        const checked = current.size ? current.has(it.id) : true;
        return `
          <label class="notif-watch-item">
            <input type="checkbox" data-watch-id="${it.id}" ${checked ? "checked" : ""}/>
            <span>${escapeHtml(it.name)}</span>
          </label>
        `;
      })
      .join("");
  };

  const initAccountCenter = () => {
    if (window.__pps_notif_center_inited) return;
    const root = document;
    const listEl = root.getElementById("notificationsList");
    if (!listEl) return;
    window.__pps_notif_center_inited = true;

    const email = getCurrentEmail();
    if (email) updateBadgesInDom(email);

    root.addEventListener("click", (e) => {
      const tabBtn = e.target.closest("[data-notif-tab]");
      if (tabBtn) {
        root.body.dataset.notifTab = String(tabBtn.getAttribute("data-notif-tab") || "all");
        renderAccountCenter();
        return;
      }

      const toggleRead = e.target.closest("[data-notif-toggle-read]");
      if (toggleRead) {
        const row = e.target.closest("[data-notif-id]");
        const id = String(row?.getAttribute("data-notif-id") || "");
        if (!id) return;
        const email2 = getCurrentEmail();
        if (!email2) return;
        const list = getNotifications(email2).map((n) => {
          if (String(n?.id || "") !== id) return n;
          const nextUnread = Boolean(n?.readAt);
          return { ...n, readAt: nextUnread ? "" : nowIso() };
        });
        setNotifications(email2, list);
        renderAccountCenter();
        return;
      }

      const del = e.target.closest("[data-notif-delete]");
      if (del) {
        const row = e.target.closest("[data-notif-id]");
        const id = String(row?.getAttribute("data-notif-id") || "");
        if (!id) return;
        const email2 = getCurrentEmail();
        if (!email2) return;
        setNotifications(email2, getNotifications(email2).filter((n) => String(n?.id || "") !== id));
        renderAccountCenter();
        return;
      }

      const markAll = e.target.closest("#notifMarkAllRead");
      if (markAll) {
        const email2 = getCurrentEmail();
        if (!email2) return;
        const list = getNotifications(email2).map((n) => (n?.readAt ? n : { ...n, readAt: nowIso() }));
        setNotifications(email2, list);
        renderAccountCenter();
        return;
      }

      const clearRead = e.target.closest("#notifClearRead");
      if (clearRead) {
        const email2 = getCurrentEmail();
        if (!email2) return;
        setNotifications(email2, getNotifications(email2).filter((n) => !n?.readAt));
        renderAccountCenter();
        return;
      }

      const clearAll = e.target.closest("#notifClearAll");
      if (clearAll) {
        const email2 = getCurrentEmail();
        if (!email2) return;
        setNotifications(email2, []);
        renderAccountCenter();
      }
    });

    const typeFilterEl = root.getElementById("notifTypeFilter");
    if (typeFilterEl) typeFilterEl.addEventListener("change", renderAccountCenter);

    const form = root.getElementById("notifPrefsForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const email2 = getCurrentEmail();
        if (!email2) return;

        const next = normalizePrefs({
          orderUpdates: Boolean(form.querySelector("[name=orderUpdates]")?.checked),
          backInStock: Boolean(form.querySelector("[name=backInStock]")?.checked),
          memberDeals: Boolean(form.querySelector("[name=memberDeals]")?.checked),
          lowStock: Boolean(form.querySelector("[name=lowStock]")?.checked),
          priceDrops: Boolean(form.querySelector("[name=priceDrops]")?.checked),
          lowStockThreshold: Number(form.querySelector("[name=lowStockThreshold]")?.value),
          priceDropPercent: Number(form.querySelector("[name=priceDropPercent]")?.value),
          watchedProductIds: [] // populated below
        });

        const watchWrap = root.getElementById("notifWatchlist");
        const checkedIds = Array.from(watchWrap?.querySelectorAll("[data-watch-id]") || [])
          .filter((input) => input.checked)
          .map((input) => String(input.getAttribute("data-watch-id") || ""))
          .filter(Boolean);

        // If user explicitly manages the list, store it; otherwise fall back to favorites.
        next.watchedProductIds = checkedIds.length ? checkedIds : [];
        setPrefs(email2, next);
        renderAccountCenter();
      });
    }

    window.addEventListener("pps:notifs", (event) => {
      const email2 = safeEmail(event?.detail?.email);
      if (!email2 || email2 !== getCurrentEmail()) return;
      updateBadgesInDom(email2);
    });

    renderAccountCenter();
  };

  window.PPS_NOTIFS = {
    getPrefs,
    setPrefs,
    getNotifications,
    setNotifications,
    computeUnreadCount,
    refreshFromAccount,
    renderAccountCenter,
    initAccountCenter
  };
})();
