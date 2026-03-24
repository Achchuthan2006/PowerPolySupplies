// Account activity log (in-app only).
// Captures events on this device + backend-observed IP (best-effort).

(() => {
  "use strict";

  const MAX_ITEMS = 200;
  const STORAGE_SUFFIX_ACTIVITY = "activity_v1";
  const STORAGE_SUFFIX_LAST_IP = "last_ip_v1";

  const TYPE_LABELS = {
    login: "Login",
    logout: "Logout",
    password_change: "Password change",
    profile_update: "Profile update",
    settings_update: "Settings update",
    order_placed: "Order placed",
    reward_redeemed: "Reward redeemed",
    reward_used: "Reward used",
    address_saved: "Address saved",
    payment_saved: "Payment saved"
  };

  const safeEmail = (value) => String(value || "").trim().toLowerCase();
  const nowIso = () => new Date().toISOString();
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

  const getSession = () => {
    try {
      return window.PPS?.getSession?.() || null;
    } catch {
      return null;
    }
  };

  const getActivity = (email) => {
    const list = readJson(userKey(email, STORAGE_SUFFIX_ACTIVITY), []);
    return Array.isArray(list) ? list : [];
  };

  const setActivity = (email, list) => {
    const safe = (Array.isArray(list) ? list : []).filter(Boolean).slice(0, MAX_ITEMS);
    writeJson(userKey(email, STORAGE_SUFFIX_ACTIVITY), safe);
    emitChanged(email);
    return safe;
  };

  const getLastIp = (email) => {
    const raw = readJson(userKey(email, STORAGE_SUFFIX_LAST_IP), { ip: "", forwardedFor: "", updatedAt: "" });
    return {
      ip: String(raw?.ip || ""),
      forwardedFor: String(raw?.forwardedFor || ""),
      updatedAt: String(raw?.updatedAt || "")
    };
  };

  const setLastIp = (email, ipInfo) => {
    const safe = {
      ip: String(ipInfo?.ip || "").trim(),
      forwardedFor: String(ipInfo?.forwardedFor || "").trim(),
      updatedAt: nowIso()
    };
    writeJson(userKey(email, STORAGE_SUFFIX_LAST_IP), safe);
    return safe;
  };

  const emitChanged = (email) => {
    window.dispatchEvent(new CustomEvent("pps:activity", { detail: { email: safeEmail(email) } }));
  };

  const prefetchIp = async (email) => {
    const lower = safeEmail(email);
    if (!lower) return null;
    const existing = getLastIp(lower);
    // Refresh at most every ~10 minutes.
    if (existing.updatedAt) {
      const ageMs = Date.now() - new Date(existing.updatedAt).getTime();
      if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 10 * 60 * 1000) return existing;
    }
    try {
      const base = String(window.PPS?.API_BASE || "").trim().replace(/\/+$/, "");
      if (!base) return existing;
      const res = await fetch(`${base}/api/account/ip`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return existing;
      return setLastIp(lower, { ip: data.ip, forwardedFor: data.forwardedFor });
    } catch {
      return existing;
    }
  };

  const record = async (type, meta = {}) => {
    const session = getSession();
    const email = safeEmail(session?.email);
    if (!email) return null;

    // Ensure we have a reasonably fresh backend-observed IP stored.
    const existingIp = getLastIp(email);
    if (!existingIp.ip) {
      // Best-effort: try to fetch quickly, but don't block the UI.
      await Promise.race([
        prefetchIp(email),
        new Promise((resolve) => setTimeout(resolve, 600))
      ]);
    } else {
      void prefetchIp(email);
    }
    const ipInfo = getLastIp(email);

    const item = {
      id: `act_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: String(type || "activity"),
      label: TYPE_LABELS[String(type || "")] || String(type || "Activity"),
      createdAt: nowIso(),
      ip: ipInfo.ip || "",
      meta: meta && typeof meta === "object" ? meta : {}
    };

    const list = getActivity(email);
    setActivity(email, [item, ...list]);
    return item;
  };

  const clear = (email) => setActivity(email, []);

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

  const summarize = (item) => {
    const meta = item?.meta || {};
    if (item?.type === "order_placed" && meta.orderId) return `Order ${meta.orderId}`;
    if (item?.type === "reward_redeemed" && meta.title) return String(meta.title);
    if (item?.type === "reward_used" && meta.code) return `Code ${meta.code}`;
    if (item?.type === "settings_update") return "Preferences updated";
    if (item?.type === "address_saved") return meta.label ? `Address: ${meta.label}` : "Address saved";
    if (item?.type === "payment_saved") return meta.label ? `Payment: ${meta.label}` : "Payment saved";
    if (item?.type === "profile_update") return "Profile updated";
    if (item?.type === "password_change") return "Password updated";
    return "";
  };

  const renderAccountActivity = () => {
    const session = getSession();
    const email = safeEmail(session?.email);
    if (!email) return;

    const listEl = document.getElementById("activityList");
    const msgEl = document.getElementById("activityMsg");
    const filterEl = document.getElementById("activityType");
    const ipEl = document.getElementById("activityIpHint");
    if (!listEl) return;

    const items = getActivity(email);
    const filter = String(filterEl?.value || "");
    const shown = filter ? items.filter((x) => String(x?.type || "") === filter) : items;

    const ipInfo = getLastIp(email);
    if (ipEl) {
      ipEl.textContent = ipInfo.ip
        ? `Last seen IP (by backend): ${ipInfo.ip}`
        : "IP address is shown when available.";
    }

    if (msgEl) {
      msgEl.textContent = shown.length ? "" : "No account activity recorded yet on this device.";
    }

    listEl.innerHTML = shown
      .slice(0, 80)
      .map((it) => {
        const time = formatTime(it.createdAt);
        const summary = summarize(it);
        const ip = String(it.ip || "");
        return `
          <div class="activity-item">
            <div class="activity-top">
              <div style="font-weight:1000;">${escapeHtml(it.label || it.type || "Activity")}</div>
              <div class="activity-time">${escapeHtml(time)}</div>
            </div>
            <div class="activity-sub">
              ${summary ? `<span>${escapeHtml(summary)}</span>` : `<span></span>`}
              <span>${ip ? `IP: ${escapeHtml(ip)}` : ""}</span>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const initAccountActivity = () => {
    if (window.__pps_activity_inited) return;
    const listEl = document.getElementById("activityList");
    if (!listEl) return;
    window.__pps_activity_inited = true;

    const session = getSession();
    const email = safeEmail(session?.email);
    if (email) void prefetchIp(email);

    document.getElementById("activityType")?.addEventListener("change", renderAccountActivity);
    document.getElementById("activityClear")?.addEventListener("click", () => {
      const session2 = getSession();
      const email2 = safeEmail(session2?.email);
      if (!email2) return;
      clear(email2);
      renderAccountActivity();
    });

    window.addEventListener("pps:activity", (e) => {
      const email2 = safeEmail(e?.detail?.email);
      if (!email2) return;
      const current = safeEmail(getSession()?.email);
      if (email2 !== current) return;
      renderAccountActivity();
    });

    renderAccountActivity();
  };

  window.PPS_ACTIVITY = {
    record,
    getActivity,
    clear,
    prefetchIp,
    initAccountActivity,
    renderAccountActivity
  };
})();
