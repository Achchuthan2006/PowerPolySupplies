import { useState } from "react";

export default function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState({ text: "", type: "muted" });
  const [busy, setBusy] = useState(false);

  const submitForm = async (event) => {
    event.preventDefault();
    const form = event.target;
    const name = String(form.name.value || "").trim();
    const email = String(form.email.value || "").trim();
    const message = String(form.message.value || "").trim();
    if (!name || !email || !message) {
      setStatus({
        text: window.PPS_I18N?.t("help.required") || "Please fill all required fields.",
        type: "error"
      });
      return;
    }

    const sending = window.PPS_I18N?.t("help.sending") || "Sending...";
    const sent = window.PPS_I18N?.t("help.sent") || "Thanks! We'll be in touch.";
    const error = window.PPS_I18N?.t("help.error") || "Unable to send right now. Please try again.";
    setBusy(true);
    setStatus({ text: sending, type: "muted" });

    try {
      const apiBase = window.PPS?.API_BASE || "";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${apiBase}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ name, email, message }),
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error("Failed");
      }
      setStatus({ text: sent, type: "success" });
      form.reset();
    } catch (err) {
      setStatus({ text: error, type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="help-widget" id="helpWidget">
      <button
        className="help-fab"
        type="button"
        aria-expanded={open ? "true" : "false"}
        aria-controls="helpPanel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="help-fab-icon" aria-hidden="true">?</span>
        <span data-i18n="help.fab">Help</span>
      </button>
      <div className={`help-panel ${open ? "open" : ""}`} id="helpPanel" aria-hidden={!open}>
        <div className="help-panel-header">
          <div data-i18n="help.title">Live customer support</div>
          <button className="help-close" type="button" aria-label="Close" onClick={() => setOpen(false)}>
            X
          </button>
        </div>
        <div className="help-panel-body">
          <p data-i18n="help.subtitle">We're offline right now. Leave a message and we'll get back to you.</p>
          <form className="help-form" onSubmit={submitForm}>
            <label>
              <span data-i18n="help.name">Name</span>
              <input className="input" name="name" required />
            </label>
            <label>
              <span data-i18n="help.email">Email</span>
              <input className="input" type="email" name="email" required />
            </label>
            <label>
              <span data-i18n="help.message">Message</span>
              <textarea className="input" name="message" rows="4" required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy} data-i18n="help.send">
              {busy
                ? (window.PPS_I18N?.t("help.sending") || "Sending...")
                : (window.PPS_I18N?.t("help.send") || "Send message")}
            </button>
            {status.text ? <div className={`status ${status.type || "muted"}`}>{status.text}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
