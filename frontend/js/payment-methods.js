// Saved payment methods (Square card-on-file).
// - We do NOT store full card numbers.
// - Cards are tokenized by Square Web Payments SDK, then saved server-side.

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const els = {
    msg: $("#paymentMethodsMsg"),
    list: $("#paymentMethodsList"),
    setupMsg: $("#pmSetupMsg"),
    cardSlot: $("#squareCard"),
    cardholder: $("#pmCardholder"),
    saveBtn: $("#pmSaveCard")
  };

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

  const getSession = () => window.PPS?.getSession?.() || null;
  const apiBase = () => String(window.PPS?.API_BASE || "").trim().replace(/\/+$/, "");

  const setMsg = (text) => {
    if (els.msg) els.msg.textContent = String(text || "");
  };

  const setSetupMsg = (text) => {
    if (els.setupMsg) els.setupMsg.textContent = String(text || "");
  };

  const isSquareConfigured = () => {
    const appId = String(window.SQUARE_APP_ID || "").trim();
    const locationId = String(window.SQUARE_LOCATION_ID || "").trim();
    return !!(appId && locationId);
  };

  const squareEnv = () => {
    const env = String(window.SQUARE_ENV || "").trim().toLowerCase();
    return env === "sandbox" ? "sandbox" : "production";
  };

  const ensureSquareScript = async () => {
    if (window.Square && window.Square.payments) return true;
    const existing = document.querySelector('script[data-square-payments="1"]');
    if (existing) {
      await new Promise((resolve) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", resolve, { once: true });
      });
      return !!(window.Square && window.Square.payments);
    }
    const script = document.createElement("script");
    script.dataset.squarePayments = "1";
    script.src = squareEnv() === "sandbox"
      ? "https://sandbox.web.squarecdn.com/v1/square.js"
      : "https://web.squarecdn.com/v1/square.js";
    script.async = true;
    document.head.appendChild(script);
    await new Promise((resolve) => {
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", resolve, { once: true });
    });
    return !!(window.Square && window.Square.payments);
  };

  const fetchJson = async (path, options = {}) => {
    const base = apiBase();
    if (!base) throw new Error("API base not configured.");
    const res = await fetch(`${base}${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      const msg = data?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  };

  const loadMethods = async () => {
    const session = getSession();
    if (!session) {
      setMsg("Log in to manage payment methods.");
      return [];
    }
    try {
      const data = await fetchJson("/api/account/payment-methods", {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const list = Array.isArray(data.methods) ? data.methods : [];
      return list;
    } catch (err) {
      setMsg(String(err?.message || "Unable to load payment methods."));
      return [];
    }
  };

  const render = async () => {
    if (!els.list) return;
    const methods = await loadMethods();
    if (!methods.length) {
      els.list.innerHTML = `<div style="color:var(--muted); font-size:13px;">No saved cards yet.</div>`;
    } else {
      els.list.innerHTML = methods
        .map((m) => {
          const brand = String(m.brand || m.cardBrand || "Card");
          const last4 = String(m.last4 || "");
          const exp = m.expMonth && m.expYear ? `${String(m.expMonth).padStart(2, "0")}/${String(m.expYear).slice(-2)}` : "";
          const id = String(m.id || "");
          return `
            <div class="pm-item" data-pm-id="${esc(id)}">
              <div class="pm-top">
                <div>
                  <div style="font-weight:1000;">${esc(brand)} ${last4 ? `•••• ${esc(last4)}` : ""}</div>
                  <div class="pm-meta">${exp ? `Expires ${esc(exp)}` : ""}</div>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                  <button class="btn btn-outline btn-sm" type="button" data-pm-remove>Remove</button>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    }
  };

  let payments = null;
  let card = null;

  const setupCard = async () => {
    if (!els.cardSlot || !els.saveBtn) return;

    const session = getSession();
    if (!session) {
      setSetupMsg("Log in to add a card.");
      els.saveBtn.disabled = true;
      return;
    }

    if (!isSquareConfigured()) {
      setSetupMsg("Square card saving is not configured. Set `window.SQUARE_APP_ID`, `window.SQUARE_LOCATION_ID`, and `window.SQUARE_ENV` in `frontend/config.js`.");
      els.saveBtn.disabled = true;
      return;
    }

    const ok = await ensureSquareScript();
    if (!ok) {
      setSetupMsg("Unable to load Square card input.");
      els.saveBtn.disabled = true;
      return;
    }

    try {
      const appId = String(window.SQUARE_APP_ID || "").trim();
      const locationId = String(window.SQUARE_LOCATION_ID || "").trim();
      payments = window.Square.payments(appId, locationId);
      card = await payments.card();
      await card.attach("#squareCard");
      els.saveBtn.disabled = false;
      setSetupMsg("");
    } catch (err) {
      setSetupMsg(String(err?.message || "Unable to initialize card input."));
      els.saveBtn.disabled = true;
    }
  };

  const saveCard = async () => {
    const session = getSession();
    if (!session) return;
    if (!card) return;
    els.saveBtn.disabled = true;
    setSetupMsg("Saving card...");
    try {
      const result = await card.tokenize({ cardholderName: String(els.cardholder?.value || "").trim() || undefined });
      if (result.status !== "OK" || !result.token) {
        throw new Error("Card verification failed.");
      }
      await fetchJson("/api/account/payment-methods", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          sourceId: result.token
        })
      });
      setSetupMsg("Card saved.");
      await render();
    } catch (err) {
      setSetupMsg(String(err?.message || "Unable to save card."));
    } finally {
      els.saveBtn.disabled = false;
    }
  };

  const removeCard = async (id) => {
    const session = getSession();
    if (!session) return;
    setMsg("Removing card...");
    try {
      await fetchJson(`/api/account/payment-methods/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` }
      });
      setMsg("");
      await render();
    } catch (err) {
      setMsg(String(err?.message || "Unable to remove card."));
    }
  };

  const init = async () => {
    if (window.__pps_payment_methods_inited) return;
    if (!els.list) return;
    window.__pps_payment_methods_inited = true;

    await render();
    await setupCard();

    els.saveBtn?.addEventListener("click", saveCard);
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pm-remove]");
      if (!btn) return;
      const row = btn.closest("[data-pm-id]");
      const id = row?.getAttribute("data-pm-id") || "";
      if (!id) return;
      removeCard(id);
    });
  };

  window.PPS_PAYMENT_METHODS = { init, render };
})();

