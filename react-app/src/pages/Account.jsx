import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Account() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const tryRedirect = async () => {
      try {
        const res = await fetch("/account.html", { method: "HEAD", cache: "no-store" });
        if (!cancelled && res.ok) window.location.href = "/account.html";
      } catch {
        // ignore
      }
    };
    tryRedirect();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
    const session = window.PPS?.getSession?.();
    if (!session) {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const loadOrders = async () => {
      setStatus(window.PPS_I18N?.t("account.status.loading") || "Loading orders...");
      try {
        const apiBase = window.PPS?.API_BASE || "";
        const session = window.PPS?.getSession?.();
        const res = await fetch(`${apiBase}/api/orders`, {
          headers: { Authorization: `Bearer ${session?.token || ""}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          window.PPS?.clearSession?.();
          navigate("/login");
          return;
        }
        if (!res.ok || !data.ok) {
          setStatus(data?.message || (window.PPS_I18N?.t("account.status.failed") || "Unable to load orders."));
          return;
        }
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setStatus("");
      } catch (err) {
        setStatus(window.PPS_I18N?.t("account.status.unreachable") || "Server unreachable. Start the backend to load your orders.");
      }
    };
    loadOrders();
  }, [navigate]);

  const logout = async () => {
    try {
      const apiBase = window.PPS?.API_BASE || "";
      const session = window.PPS?.getSession?.();
      await fetch(`${apiBase}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.token || ""}` },
      });
    } catch (err) {
      // ignore
    }
    window.PPS?.clearSession?.();
    navigate("/login");
  };

  const lang = window.PPS_I18N?.getLang?.() || "en";

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="account.kicker">
          Account
        </p>
        <h1 data-i18n="account.title">Your dashboard</h1>
        <p data-i18n="account.subtitle">Track orders, reorder fast, and see your member savings.</p>
        <div className="account-highlight">
          <span className="verified-badge">
            <span className="tick">{"\u2713"}</span>
            <span data-i18n="account.verified">Verified Power Poly Member</span>
          </span>
          <button className="btn btn-outline" type="button" onClick={logout} data-i18n="account.logout">
            Log out
          </button>
        </div>
      </section>

      {status ? <div className="status muted">{status}</div> : null}

      <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
        {orders.length === 0 && !status ? (
          <div className="card" style={{ padding: "14px" }}>
            {window.PPS_I18N?.t("account.status.empty") || "No orders found for this account yet."}
          </div>
        ) : null}
        {orders.map((order) => {
          const date = new Date(order.createdAt).toLocaleString();
          const items = (order.items || []).map((item, idx) => {
            const desc = lang === "fr"
              ? (item.description_fr || item.description || "")
              : lang === "ko"
                ? (item.description_ko || item.description || "")
                : lang === "hi"
                  ? (item.description_hi || item.description || "")
                  : lang === "ta"
                    ? (item.description_ta || item.description || "")
                    : lang === "es"
                      ? (window.PPS_I18N?.autoTranslate?.(item.description_es || item.description || "", "es") || (item.description_es || item.description || ""))
                      : item.description || "";
            const displayName = lang === "es"
              ? (window.PPS_I18N?.autoTranslate?.(item.name || "", "es") || item.name)
              : item.name;
            return (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                <div>
                  <div>{displayName} <span style={{ color: "var(--muted)" }}>x{item.qty}</span></div>
                  {desc ? <div style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }}>{desc}</div> : null}
                </div>
                <div style={{ fontWeight: 700 }}>{window.PPS?.money?.(item.priceCents * item.qty, item.currency)}</div>
              </div>
            );
          });

          return (
            <div key={order.id} className="card fade-in" style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{window.PPS_I18N?.t("account.order") || "Order"} {order.id}</div>
                  <div style={{ color: "var(--muted)", fontSize: "13px" }}>{date}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800 }}>{window.PPS?.money?.(order.totalCents || 0, order.currency || "CAD")}</div>
                  <div style={{ color: "var(--muted)", fontSize: "13px" }}>{order.status || (window.PPS_I18N?.t("account.status.pending") || "pending")}</div>
                </div>
              </div>
              <div style={{ marginTop: "12px", display: "grid", gap: "6px" }}>
                {items}
              </div>
              <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link className="btn btn-primary" to="/products" data-i18n="account.reorder">Reorder</Link>
                <Link className="btn btn-outline" to="/products" data-i18n="account.browse">Browse products</Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
