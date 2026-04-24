import { useEffect, useState } from "react";
import { containsSuspiciousInput, ensureSecureApiBase, getRecaptchaToken, isValidEmail, isValidPhone, sanitizeEmail, sanitizePhone, sanitizeText } from "../lib/security.js";

export default function Contact() {
  const [status, setStatus] = useState({ text: "", type: "muted" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus({
        text: window.PPS_I18N?.t("contact.status.required") || "Please fill all required fields.",
        type: "error"
      });
      return;
    }
    const payload = {
      name: sanitizeText(form.name.value, { maxLength: 100 }),
      email: sanitizeEmail(form.email.value),
      phone: sanitizePhone(form.phone.value),
      message: sanitizeText(form.message.value, { maxLength: 2000, multiline: true }),
    };
    if (!payload.name || !payload.email || !payload.message || !isValidEmail(payload.email) || !isValidPhone(payload.phone)) {
      setStatus({ text: "Enter a valid name, email, phone, and message.", type: "error" });
      return;
    }
    if ([payload.name, payload.email, payload.phone, payload.message].some(containsSuspiciousInput)) {
      setStatus({ text: "Submission blocked due to unsafe input.", type: "error" });
      return;
    }
    setBusy(true);
    setStatus({ text: window.PPS_I18N?.t("contact.status.sending") || "Sending...", type: "muted" });
    try {
      const apiBase = ensureSecureApiBase(window.PPS?.API_BASE || window.API_BASE_URL || "");
      const recaptchaToken = await getRecaptchaToken("contact_form");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${apiBase}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ ...payload, recaptchaToken }),
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("Failed");
      setStatus({
        text: window.PPS_I18N?.t("contact.status.sent") || "Message sent. We'll get back to you.",
        type: "success"
      });
      form.reset();
    } catch (_err) {
      const unreachable = window.PPS_I18N?.t("contact.status.unreachable")
        || "Server unreachable. Please try again.";
      setStatus({
        text: _err && _err.name === "AbortError"
          ? unreachable
          : (window.PPS_I18N?.t("contact.status.failed") || "Failed to send. Check backend/email settings."),
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="contact.kicker">
          Contact
        </p>
        <h1 data-i18n="contact.title">Contact Us</h1>
        <p data-i18n="contact.subtitle">Need bulk pricing, product info, or help placing an order? Send us a message.</p>
      </section>

      <section className="grid grid-split-wide" style={{ gap: "16px", marginTop: "16px" }}>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h3 data-i18n="contact.form.title">Send a message</h3>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: "10px" }}>
            <input className="input" name="name" placeholder="Full Name" data-i18n-placeholder="contact.form.name" minLength="2" maxLength="100" required />
            <input className="input" name="email" type="email" placeholder="Email" data-i18n-placeholder="contact.form.email" autoComplete="email" maxLength="254" required />
            <input className="input" name="phone" placeholder="Phone (optional)" data-i18n-placeholder="contact.form.phone" inputMode="tel" maxLength="25" />
            <textarea className="input" name="message" rows="5" placeholder="Your message..." data-i18n-placeholder="contact.form.message" minLength="5" maxLength="2000" required />
            {window.RECAPTCHA_SITE_KEY ? <small style={{ color: "var(--muted)" }}>Protected by reCAPTCHA.</small> : null}
            <button className="btn btn-primary" type="submit" disabled={busy} data-i18n="contact.form.send">
              {busy
                ? (window.PPS_I18N?.t("contact.status.sending") || "Sending...")
                : (window.PPS_I18N?.t("contact.form.send") || "Send Message")}
            </button>
            {status.text ? <div className={`status ${status.type || "muted"}`}>{status.text}</div> : null}
          </form>
        </div>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h3 data-i18n="contact.business.title">Business Info</h3>
          <p data-i18n="contact.business.desc">
            Email us for orders, quotes, and product questions. Include your order details for faster support.
          </p>
          <div style={{ marginTop: "10px" }}>
            <strong data-i18n="contact.business.email">Email</strong>
            <div>powerpolysupplies@gmail.com</div>
          </div>
          <div style={{ marginTop: "10px" }}>
            <strong data-i18n="contact.business.sales_rep">Sales Representative</strong>
            <div>Angel 647-523-8645</div>
          </div>
          <div style={{ marginTop: "10px" }}>
            <strong data-i18n="contact.business.sales_assoc">Sales Associate</strong>
            <div>Andrew 437-425-6638</div>
          </div>
          <div style={{ marginTop: "10px" }}>
            <strong data-i18n="contact.business.sales_assoc">Sales Associate</strong>
            <div>Achchu 647-570-4878</div>
          </div>
          <div style={{ marginTop: "10px" }}>
            <strong data-i18n="contact.business.hours">Hours</strong>
            <div data-i18n="contact.business.hours.week">Mon-Fri | 9:00 AM - 6:00 PM</div>
            <div data-i18n="contact.business.hours.wed">Wednesday delivery | 9:00 AM - 10:00 PM</div>
            <div data-i18n="contact.business.hours.sat">Saturday delivery | 9:00 AM - 10:00 PM</div>
          </div>
        </div>
      </section>
    </>
  );
}
