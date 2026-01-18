import { useEffect, useState } from "react";

export default function Feedback() {
  const [status, setStatus] = useState({ text: "", type: "muted" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  const submitFeedback = async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim(),
    };
    if (!payload.message) {
      setStatus({
        text: window.PPS_I18N?.t("feedback.status.missing") || "Please add your feedback message first.",
        type: "error"
      });
      return;
    }
    setBusy(true);
    setStatus({ text: window.PPS_I18N?.t("feedback.status.sending") || "Sending your feedback...", type: "muted" });
    try {
      const apiBase = window.PPS?.API_BASE || "";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${apiBase}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("Failed");
      setStatus({
        text: window.PPS_I18N?.t("feedback.status.thanks") || "Thanks! Your feedback was received.",
        type: "success"
      });
      form.reset();
    } catch (err) {
      const unreachable = window.PPS_I18N?.t("feedback.status.unreachable")
        || "Server unreachable. Please try again.";
      setStatus({
        text: err && err.name === "AbortError"
          ? unreachable
          : (window.PPS_I18N?.t("feedback.status.failed") || "Failed to send feedback."),
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="feedback.kicker">
          Feedback
        </p>
        <h1 data-i18n="feedback.title">What our customers say</h1>
        <p data-i18n="feedback.subtitle">Real experiences from dry cleaners, laundromats, and retailers who rely on Power Poly Supplies.</p>
      </section>

      <section className="testimonial-grid">
        <div className="testimonial-card">
          <div className="quote-mark">“</div>
          <p className="testimonial-text" data-i18n="feedback.quote.one">
            Fast shipping, consistent quality, and responsive support. We keep coming back for garment covers and hangers.
          </p>
          <div className="testimonial-meta" data-i18n="feedback.quote.one.meta">Operations Manager - Toronto, ON</div>
        </div>
        <div className="testimonial-card">
          <div className="quote-mark">“</div>
          <p className="testimonial-text" data-i18n="feedback.quote.two">
            Reliable stock and clear pricing. The team helped us choose the right sizes for bulk polybags.
          </p>
          <div className="testimonial-meta" data-i18n="feedback.quote.two.meta">Retail Owner - Vancouver, BC</div>
        </div>
        <div className="testimonial-card">
          <div className="quote-mark">“</div>
          <p className="testimonial-text" data-i18n="feedback.quote.three">
            Square checkout was smooth and our order arrived on schedule. Great experience overall.
          </p>
          <div className="testimonial-meta" data-i18n="feedback.quote.three.meta">Laundry Service - Calgary, AB</div>
        </div>
        <div className="testimonial-card">
          <div className="quote-mark">“</div>
          <p className="testimonial-text" data-i18n="feedback.quote.four">
            Support replies quickly and they always have the hangers we need. Highly recommend.
          </p>
          <div className="testimonial-meta" data-i18n="feedback.quote.four.meta">Dry Cleaner - Halifax, NS</div>
        </div>
      </section>

      <section className="card fade-in" style={{ padding: "16px", marginTop: "16px" }}>
        <h3 data-i18n="feedback.form.title">Share your feedback</h3>
        <p data-i18n="feedback.form.desc">Tell us how we're doing - products, service, delivery. Your feedback helps us improve.</p>
        <form onSubmit={submitFeedback} style={{ display: "grid", gap: "10px" }}>
          <input className="input" name="name" placeholder="Your name (optional)" data-i18n-placeholder="feedback.form.name" />
          <input className="input" name="email" type="email" placeholder="Email (optional)" data-i18n-placeholder="feedback.form.email" />
          <textarea className="input" name="message" rows="4" placeholder="Your feedback..." data-i18n-placeholder="feedback.form.message" />
          <button className="btn btn-primary" type="submit" disabled={busy} data-i18n="feedback.form.submit">
            {busy
              ? (window.PPS_I18N?.t("feedback.status.sending") || "Sending your feedback...")
              : (window.PPS_I18N?.t("feedback.form.submit") || "Submit feedback")}
          </button>
          {status.text ? <div className={`status ${status.type || "muted"}`}>{status.text}</div> : null}
        </form>
      </section>
    </>
  );
}
