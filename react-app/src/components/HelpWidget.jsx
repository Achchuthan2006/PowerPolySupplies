import { useEffect, useId, useRef, useState } from "react";
import { containsSuspiciousInput, ensureSecureApiBase, getRecaptchaToken, isValidEmail, sanitizeEmail, sanitizeText } from "../lib/security.js";

export default function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState({ text: "", type: "muted" });
  const [busy, setBusy] = useState(false);
  const fabRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        fabRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const submitForm = async (event) => {
    event.preventDefault();
    const form = event.target;
    const name = sanitizeText(form.name.value, { maxLength: 100 });
    const email = sanitizeEmail(form.email.value);
    const message = sanitizeText(form.message.value, { maxLength: 2000, multiline: true });
    if (!name || !email || !message || !isValidEmail(email)) {
      setStatus({
        text: window.PPS_I18N?.t("help.required") || "Please fill all required fields.",
        type: "error"
      });
      return;
    }
    if ([name, email, message].some(containsSuspiciousInput)) {
      setStatus({ text: "Submission blocked due to unsafe input.", type: "error" });
      return;
    }

    const sending = window.PPS_I18N?.t("help.sending") || "Sending...";
    const sent = window.PPS_I18N?.t("help.sent") || "Thanks! We'll be in touch.";
    const error = window.PPS_I18N?.t("help.error") || "Unable to send right now. Please try again.";
    setBusy(true);
    setStatus({ text: sending, type: "muted" });

    try {
      const apiBase = ensureSecureApiBase(window.PPS?.API_BASE || window.API_BASE_URL || "");
      const recaptchaToken = await getRecaptchaToken("help_form");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${apiBase}/api/help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ name, email, message, recaptchaToken }),
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error("Failed");
      }
      setStatus({ text: sent, type: "success" });
      form.reset();
    } catch (_err) {
      setStatus({ text: error, type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="help-widget" id="helpWidget">
      <button
        ref={fabRef}
        className="help-fab"
        type="button"
        aria-expanded={open ? "true" : "false"}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="help-fab-icon" aria-hidden="true">?</span>
        <span data-i18n="help.fab">Help</span>
      </button>
      <div
        className={`help-panel ${open ? "open" : ""}`}
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-hidden={!open}
      >
        <div className="help-panel-header">
          <div id={titleId} data-i18n="help.title">Live customer support</div>
          <button
            ref={closeButtonRef}
            className="help-close"
            type="button"
            aria-label="Close help panel"
            onClick={() => {
              setOpen(false);
              fabRef.current?.focus();
            }}
          >
            X
          </button>
        </div>
        <div className="help-panel-body">
          <p data-i18n="help.subtitle">We're offline right now. Leave a message and we'll get back to you.</p>
          <form className="help-form" onSubmit={submitForm}>
            <label>
              <span data-i18n="help.name">Name</span>
              <input className="input" name="name" minLength="2" maxLength="100" required />
            </label>
            <label>
              <span data-i18n="help.email">Email</span>
              <input className="input" type="email" name="email" autoComplete="email" maxLength="254" required />
            </label>
            <label>
              <span data-i18n="help.message">Message</span>
              <textarea className="input" name="message" rows="4" minLength="5" maxLength="2000" required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy} data-i18n="help.send">
              {busy
                ? (window.PPS_I18N?.t("help.sending") || "Sending...")
                : (window.PPS_I18N?.t("help.send") || "Send message")}
            </button>
            {status.text ? <div className={`status ${status.type || "muted"}`} role="status" aria-live="polite">{status.text}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
