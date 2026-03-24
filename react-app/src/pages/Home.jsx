import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  return (
    <>
      <section className="hero fade-in">
        <img
          className="hero-logo"
          src="/assets/poly%20logo%20without%20background.png"
          alt="Power Poly Supplies logo"
        />
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
          data-i18n="index.hero.kicker"
        >
          Power your packaging
        </p>
        <h1 data-i18n="index.hero.title">Power Poly Supplies</h1>
        <p>
          <span data-i18n="index.hero.desc">
            Bulk garment cover bags, poly bags, wraps, racks, and professional-grade hangers. Built for dry cleaners,
            laundromats, and retailers that need reliable stock.
          </span>
        </p>
        <div className="hero-actions" style={{ marginTop: "16px" }}>
          <Link className="btn btn-primary" to="/products" data-i18n="index.hero.browse">
            Browse Products
          </Link>
          <Link className="btn btn-outline" to="/specials" data-i18n="index.hero.specials">
            View Special Offers
          </Link>
        </div>
        <div style={{ marginTop: "14px", display: "flex", gap: "12px", flexWrap: "wrap", color: "var(--muted)", fontSize: "13px" }}>
          <span data-i18n="index.hero.tag.bulk">Bulk pricing ready</span>
          <span>|</span>
          <span data-i18n="index.hero.tag.fast">Fast shipping</span>
          <span>|</span>
          <span data-i18n="index.hero.tag.support">Responsive support</span>
        </div>
        <div className="hero-callouts">
          <div className="callout-pill pulse">
            <span className="callout-icon ship-icon" aria-hidden="true" />
            <span data-i18n="index.hero.callout.ship">Fast shipping</span>
          </div>
          <div className="callout-pill pulse delay-1">
            <span className="callout-icon lock-icon" aria-hidden="true" />
            <span data-i18n="index.hero.callout.checkout">Secure Square checkout</span>
          </div>
          <div className="callout-pill pulse delay-2">
            <span className="callout-icon leaf-icon" aria-hidden="true" />
            <span data-i18n="index.hero.callout.canada">Canada-wide supply</span>
          </div>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginTop: "16px" }}>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h3 style={{ margin: "0 0 6px" }} data-i18n="index.card.garment.title">
            Garment Cover Bags
          </h3>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }} data-i18n="index.card.garment.desc">
            Multiple sizes with clear/plain options for daily dry-cleaning use.
          </p>
        </div>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h3 style={{ margin: "0 0 6px" }} data-i18n="index.card.hangers.title">
            Professional Hangers
          </h3>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }} data-i18n="index.card.hangers.desc">
            Strut, capped, suit, and shirt hangers built for business operations.
          </p>
        </div>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h3 style={{ margin: "0 0 6px" }} data-i18n="index.card.order.title">
            Order Your Way
          </h3>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }} data-i18n="index.card.order.desc">
            Pay online with Square or book the order and pay later after fulfillment.
          </p>
        </div>
      </section>

      <div className="support-band">
        <div className="support-item">
          <div className="support-label" data-i18n="index.support.help">Help line</div>
          <div className="support-value">Angel 647-523-8645</div>
          <div className="support-value">Andrew 437-425-6638</div>
          <div className="support-value">Achchu 647-570-4878</div>
        </div>
        <div className="support-item">
          <div className="support-label" data-i18n="index.support.customer">Customer support</div>
          <div className="support-value">powerpolysupplies@gmail.com</div>
        </div>
        <div className="support-item">
          <div className="support-label" data-i18n="index.support.questions">Questions? We're here.</div>
          <div className="support-value" data-i18n="index.support.fast">
            Fast replies during business hours
          </div>
        </div>
      </div>
    </>
  );
}
