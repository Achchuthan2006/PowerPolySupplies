// Wishlists UI (separate from Favorites).
// Requires login (per-account localStorage).

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

  const fmtDate = (value) => {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const state = {
    orders: [],
    products: [],
    productsById: new Map(),
    activeListId: ""
  };

  const els = {
    listSelect: $("#wishlistSelect"),
    createInput: $("#wishlistName"),
    createBtn: $("#wishlistCreate"),
    renameInput: $("#wishlistRename"),
    renameBtn: $("#wishlistRenameBtn"),
    deleteBtn: $("#wishlistDelete"),
    msg: $("#wishlistsMsg"),
    items: $("#wishlistItems"),
    soon: $("#wishlistSoon"),
    soonMsg: $("#wishlistSoonMsg")
  };

  const getSession = () => window.PPS?.getSession?.() || null;

  const ensureLogin = () => {
    const session = getSession();
    if (!session) return false;
    if (!window.PPS?.getWishlists) return false;
    return true;
  };

  const setInlineMsg = (text) => {
    const msg = document.getElementById("accountMsg");
    if (msg) msg.textContent = String(text || "");
  };

  const setActiveList = (id) => {
    state.activeListId = String(id || "");
    render();
  };

  const getWishlists = () => window.PPS?.getWishlists?.();

  const activeList = () => {
    const data = getWishlists();
    if (!data?.lists?.length) return null;
    const chosen = data.lists.find((l) => l.id === state.activeListId) || data.lists[0];
    if (!chosen) return null;
    if (state.activeListId !== chosen.id) state.activeListId = chosen.id;
    return chosen;
  };

  const money = (cents, currency) => window.PPS?.money?.(Number(cents) || 0, currency || "CAD") || "";

  const renderListPicker = () => {
    if (!els.listSelect) return;
    const data = getWishlists();
    if (!data?.lists?.length) {
      els.listSelect.innerHTML = `<option value="">Wishlist</option>`;
      return;
    }
    els.listSelect.innerHTML = data.lists
      .map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`)
      .join("");
    const list = activeList();
    if (list) els.listSelect.value = list.id;
    if (els.renameInput) els.renameInput.value = list?.name || "";
  };

  const renderItems = () => {
    if (!els.items) return;
    const list = activeList();
    if (!list) {
      els.items.innerHTML = `<div style="color:var(--muted); font-size:13px;">Log in to use wishlists.</div>`;
      return;
    }
    const ids = (list.items || []).map((it) => String(it.productId || "")).filter(Boolean);
    const rows = ids
      .map((id) => {
        const p = state.productsById.get(id);
        if (!p) return null;
        const stock = Number(p.stock || 0);
        const stockLabel = stock <= 0 ? "Out of stock" : stock <= 10 ? "Almost out" : "In stock";
        const priceCents = window.PPS?.getTieredPriceCents?.(p, 1) ?? p.priceCents;
        return `
          <div class="wishlist-item">
            <div style="display:flex; gap:12px; align-items:flex-start;">
              <img class="wishlist-thumb" src="${esc(p.image || "")}" alt="" loading="lazy" decoding="async" width="70" height="54">
              <div style="flex:1 1 auto;">
                <div style="font-weight:1000;">${esc(p.name || "Item")}</div>
                <div style="color:var(--muted); font-size:13px; margin-top:4px;">${esc(p.category || "")} · ${esc(stockLabel)}</div>
                <div style="font-weight:900; margin-top:6px;">${money(priceCents, p.currency)}</div>
                <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                  <a class="btn btn-outline btn-sm" href="./product.html?slug=${encodeURIComponent(p.slug || "")}">View</a>
                  <button class="btn btn-primary btn-sm" type="button" data-wl-addcart="${esc(p.id)}">Add to cart</button>
                  <button class="btn btn-outline btn-sm" type="button" data-wl-remove="${esc(p.id)}">Remove</button>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .filter(Boolean);

    if (els.msg) {
      els.msg.textContent = ids.length ? "" : "No items in this wishlist yet.";
    }
    els.items.innerHTML = rows.length ? rows.join("") : `<div style="color:var(--muted); font-size:13px;">No items in this wishlist yet.</div>`;
  };

  const daysBetween = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));

  const computeNeedSoon = () => {
    // Heuristic: items ordered 2+ times where time since last order is near their median reorder interval.
    const byId = new Map();
    state.orders.forEach((o) => {
      const ts = new Date(o.createdAt).getTime();
      if (!Number.isFinite(ts)) return;
      (o.items || []).forEach((it) => {
        const id = String(it.id || "");
        if (!id) return;
        if (!byId.has(id)) byId.set(id, []);
        byId.get(id).push(ts);
      });
    });

    const now = Date.now();
    const suggestions = [];
    byId.forEach((times, id) => {
      const unique = Array.from(new Set(times)).sort((a, b) => a - b);
      if (unique.length < 2) return;
      const gaps = [];
      for (let i = 1; i < unique.length; i++) gaps.push(daysBetween(unique[i - 1], unique[i]));
      gaps.sort((a, b) => a - b);
      const median = gaps[Math.floor(gaps.length / 2)] || 0;
      if (median < 14) return; // ignore very frequent noise
      const last = unique[unique.length - 1];
      const since = daysBetween(last, now);
      if (since < Math.max(7, Math.round(median * 0.6))) return;
      if (since > Math.round(median * 1.8)) return;
      suggestions.push({ id, score: since / median, sinceDays: since, cadenceDays: median });
    });

    // Remove items already in any wishlist or already in cart.
    const cartIds = new Set((window.PPS?.getCart?.() || []).map((x) => String(x?.id || "")).filter(Boolean));
    const filtered = suggestions
      .filter((s) => !cartIds.has(s.id))
      .filter((s) => !(window.PPS?.isInAnyWishlist?.(s.id)));

    filtered.sort((a, b) => b.score - a.score);
    return filtered.slice(0, 6);
  };

  const renderNeedSoon = () => {
    if (!els.soon) return;
    const list = activeList();
    if (!list) {
      els.soon.innerHTML = "";
      if (els.soonMsg) els.soonMsg.textContent = "";
      return;
    }
    const suggestions = computeNeedSoon();
    if (els.soonMsg) {
      els.soonMsg.textContent = suggestions.length ? "" : "No suggestions right now.";
    }
    els.soon.innerHTML = suggestions
      .map((s) => {
        const p = state.productsById.get(s.id);
        if (!p) return "";
        return `
          <div class="card" style="padding:14px;">
            <div style="font-weight:1000;">${esc(p.name || "Item")}</div>
            <div style="color:var(--muted); font-size:13px; margin-top:6px;">Last ordered ${esc(String(s.sinceDays))} days ago</div>
            <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
              <a class="btn btn-outline btn-sm" href="./product.html?slug=${encodeURIComponent(p.slug || "")}">View</a>
              <button class="btn btn-primary btn-sm" type="button" data-wl-add="${esc(p.id)}">Add to wishlist</button>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const render = () => {
    if (!ensureLogin()) {
      if (els.msg) els.msg.textContent = "Log in to use wishlists.";
      if (els.items) els.items.innerHTML = "";
      if (els.soon) els.soon.innerHTML = "";
      return;
    }
    renderListPicker();
    renderItems();
    renderNeedSoon();
  };

  const setContext = ({ orders, products }) => {
    state.orders = Array.isArray(orders) ? orders : [];
    state.products = Array.isArray(products) ? products : [];
    state.productsById = new Map(state.products.map((p) => [String(p?.id || ""), p]).filter((x) => x[0]));
    render();
  };

  const init = () => {
    if (window.__pps_wishlists_inited) return;
    const root = $("#wishlistItems");
    if (!root) return;
    window.__pps_wishlists_inited = true;

    if (els.listSelect) {
      els.listSelect.addEventListener("change", (e) => setActiveList(e.target.value));
    }

    els.createBtn?.addEventListener("click", () => {
      const name = String(els.createInput?.value || "").trim();
      if (!name) return;
      const out = window.PPS?.createWishlist?.(name);
      els.createInput.value = "";
      if (out?.lists?.length) setInlineMsg("Wishlist created.");
      render();
    });

    els.renameBtn?.addEventListener("click", () => {
      const list = activeList();
      if (!list) return;
      const name = String(els.renameInput?.value || "").trim();
      if (!name) return;
      window.PPS?.renameWishlist?.(list.id, name);
      setInlineMsg("Wishlist renamed.");
      render();
    });

    els.deleteBtn?.addEventListener("click", () => {
      const data = getWishlists();
      const list = activeList();
      if (!data?.lists?.length || !list) return;
      if (data.lists.length <= 1) {
        setInlineMsg("Keep at least one wishlist.");
        return;
      }
      window.PPS?.deleteWishlist?.(list.id);
      setInlineMsg("Wishlist deleted.");
      state.activeListId = "";
      render();
    });

    document.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-wl-remove]");
      if (removeBtn) {
        const list = activeList();
        if (!list) return;
        window.PPS?.removeFromWishlist?.(removeBtn.getAttribute("data-wl-remove"), list.id);
        render();
        return;
      }

      const addCartBtn = e.target.closest("[data-wl-addcart]");
      if (addCartBtn) {
        const id = String(addCartBtn.getAttribute("data-wl-addcart") || "");
        const p = state.productsById.get(id);
        if (p) window.PPS?.addToCart?.(p, 1);
        renderNeedSoon();
        setInlineMsg("Added to cart.");
        return;
      }

      const addBtn = e.target.closest("[data-wl-add]");
      if (addBtn) {
        const list = activeList();
        if (!list) return;
        window.PPS?.addToWishlist?.(addBtn.getAttribute("data-wl-add"), list.id);
        render();
        setInlineMsg("Added to wishlist.");
      }
    });

    window.addEventListener("pps:wishlists", render);
    window.addEventListener("pps:currency", render);
    window.addEventListener("pps:lang", render);
  };

  window.PPS_WISHLISTS = { init, setContext, render };
})();

