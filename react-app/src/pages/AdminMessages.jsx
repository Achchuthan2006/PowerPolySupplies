import { useEffect, useState } from "react";

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("");

  const loadMessages = async () => {
    setStatus(window.PPS_I18N?.t("admin.messages.loading") || "Loading messages...");
    try {
      const res = await fetch(`${window.PPS?.API_BASE}/api/admin/messages`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus(data?.message || (window.PPS_I18N?.t("admin.messages.failed") || "Unable to load messages."));
        setMessages([]);
        return;
      }
      const list = Array.isArray(data.messages) ? data.messages : [];
      if (list.length === 0) {
        setStatus(window.PPS_I18N?.t("admin.messages.empty") || "No messages yet.");
        setMessages([]);
        return;
      }
      setStatus("");
      setMessages(list);
    } catch (_err) {
      setStatus(window.PPS_I18N?.t("admin.messages.unreachable") || "Server unreachable. Is the backend running?");
      setMessages([]);
    }
  };

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
    loadMessages();
  }, []);

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="admin.kicker">
          Admin
        </p>
        <h1 data-i18n="admin.messages.title">Messages</h1>
        <p data-i18n="admin.messages.subtitle">View contact form submissions in one place.</p>
      </section>

      {status ? (
        <div style={{ color: "var(--muted)", fontSize: "13px", margin: "12px 0" }}>{status}</div>
      ) : null}

      <div className="grid" style={{ gap: "12px" }}>
        {messages.map((msg) => (
          <div key={msg.id || msg.createdAt} className="card fade-in" style={{ padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
              <div style={{ fontWeight: 800 }}>
                {msg.name || (window.PPS_I18N?.t("admin.messages.anonymous") || "Anonymous")}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "12px" }}>
                {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}
              </div>
            </div>
            <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "6px" }}>
              <div>
                {window.PPS_I18N?.t("admin.messages.email") || "Email:"} {" "}
                {msg.email ? <a href={`mailto:${msg.email}`}>{msg.email}</a> : ""}
              </div>
              {msg.phone ? (
                <div>
                  {window.PPS_I18N?.t("admin.messages.phone") || "Phone:"} {" "}
                  <a href={`tel:${msg.phone}`}>{msg.phone}</a>
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: "10px" }}>{msg.message}</div>
          </div>
        ))}
      </div>
    </>
  );
}

