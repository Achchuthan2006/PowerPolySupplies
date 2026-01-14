import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export default function ThankYou() {
  const location = useLocation();

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
    window.PPS?.updateCartBadge?.();

    const params = new URLSearchParams(location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;

    fetch(`${window.PPS?.API_BASE}/api/stripe-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    }).catch(() => {});
  }, [location.search]);

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="thankyou.kicker">
          Thank you
        </p>
        <h1 data-i18n="thankyou.title">Order received</h1>
        <p data-i18n="thankyou.subtitle">
          We have your order details. We will review and follow up with confirmation, delivery timing, or payment details.
        </p>
        <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link className="btn btn-primary" to="/products" data-i18n="thankyou.continue">Continue shopping</Link>
          <Link className="btn btn-outline" to="/contact" data-i18n="thankyou.adjust">Need to adjust? Contact us</Link>
        </div>
      </section>
    </>
  );
}
