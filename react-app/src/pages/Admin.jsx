import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function itemDescription(item, lang) {
  if (!item) return "";
  if (lang === "ta") {
    const ta = item.description_ta || "";
    if (/[\u0B80-\u0BFF]/.test(ta)) return ta;
    return item.description || "";
  }
  return item.description || "";
}

export default function Admin() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`${window.PPS?.API_BASE}/api/admin/orders`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus(window.PPS_I18N?.t("admin.orders.failed") || "Failed to load orders.");
        setOrders([]);
        return;
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setStatus(window.PPS_I18N?.t("admin.orders.unreachable") || "Server unreachable. Please try again.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fulfill = async (id) => {
    try {
      await fetch(`${window.PPS?.API_BASE}/api/admin/orders/${id}/fulfill`, { method: "POST" });
      load();
    } catch (err) {
      window.alert(window.PPS_I18N?.t("admin.orders.fulfill_failed") || "Failed to mark as fulfilled. Check the backend server.");
    }
  };

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
    load();
  }, []);

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="admin.kicker">
          Admin
        </p>
        <h1 data-i18n="admin.orders.title">Admin Orders</h1>
        <p data-i18n="admin.orders.subtitle">Review incoming orders, confirm payment method, and mark them fulfilled.</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
          <button className="btn btn-outline" type="button" onClick={load} data-i18n="admin.orders.refresh">Refresh</button>
          <Link className="btn" to="/admin-messages" data-i18n="admin.messages.title">Messages</Link>
        </div>
      </section>

      {loading ? (
        <div className="card" style={{ padding: "14px", marginTop: "14px" }}>
          {window.PPS_I18N?.t("admin.orders.loading") || "Loading orders..."}
        </div>
      ) : status ? (
        <div className="card" style={{ padding: "14px", marginTop: "14px" }}>{status}</div>
      ) : orders.length === 0 ? (
        <div className="card" style={{ padding: "14px", marginTop: "14px" }}>
          {window.PPS_I18N?.t("admin.orders.empty") || "No orders yet."}
        </div>
      ) : (
        <div className="grid" style={{ gap: "12px", marginTop: "14px" }}>
          {orders.map((order) => {
            const lang = order.language === "ta" ? "ta" : "en";
            return (
              <div key={order.id} className="card fade-in" style={{ padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ fontWeight: 900 }}>{order.id}</div>
                  <div style={{ color: "var(--muted)" }}>{order.status}</div>
                </div>
                <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
                  {order.customer?.name || ""} | {order.customer?.email || ""}
                </div>
                <div style={{ marginTop: "10px" }}>
                  {order.items?.map((item) => {
                    const desc = itemDescription(item, lang);
                    return (
                      <div key={`${order.id}-${item.id}`} style={{ marginBottom: "6px" }}>
                        <div>{item.name} x{item.qty}</div>
                        {desc ? <div style={{ color: "var(--muted)", fontSize: "12px", marginLeft: "2px" }}>{desc}</div> : null}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: "10px", fontWeight: 900 }}>
                  {(order.totalCents / 100).toFixed(2)} {order.currency}
                </div>
                <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                  <button className="btn btn-primary" type="button" onClick={() => fulfill(order.id)}>
                    {window.PPS_I18N?.t("admin.orders.fulfill") || "Mark Fulfilled"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
