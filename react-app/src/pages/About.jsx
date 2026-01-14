import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function About() {
  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="about.kicker">
          About
        </p>
        <h1 data-i18n="about.title">About Power Poly Supplies</h1>
        <p>
          <span data-i18n="about.subtitle">
            We supply garment packaging and hanger products built for daily business use. Reliable supply, bulk-friendly ordering, and consistent quality.
          </span>
        </p>
      </section>

      <section className="grid grid-3" style={{ marginTop: "16px" }}>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h3 style={{ margin: "0 0 6px" }} data-i18n="about.card.sell.title">What we sell</h3>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
            <span data-i18n="about.card.sell.desc">
              Plastic garment cover bags for dry cleaning, poly bags, and professional-grade hangers (strut, capped, suit, shirt).
            </span>
          </p>
        </div>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h3 style={{ margin: "0 0 6px" }} data-i18n="about.card.serve.title">Who we serve</h3>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
            <span data-i18n="about.card.serve.desc">
              Dry cleaners, laundromats, retailers, warehouses, uniform suppliers, and distributors across Canada.
            </span>
          </p>
        </div>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h3 style={{ margin: "0 0 6px" }} data-i18n="about.card.why.title">Why choose us</h3>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
            <span data-i18n="about.card.why.desc">
              Clear pricing, dependable stock, and fast response. No unnecessary fluff. Just supply done right.
            </span>
          </p>
        </div>
      </section>

      <section className="card fade-in" style={{ padding: "18px", marginTop: "16px" }}>
        <h2 style={{ margin: "0 0 10px" }} data-i18n="about.approach.title">Our approach</h2>
        <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
          <span data-i18n="about.approach.desc">
            Packaging and hanger supplies should be simple to order, consistent in quality, and delivered on time. That is the whole idea.
          </span>
        </p>
        <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link className="btn btn-primary" to="/products" data-i18n="about.approach.browse">Browse Products</Link>
          <Link className="btn btn-outline" to="/contact" data-i18n="about.approach.contact">Contact Sales</Link>
        </div>
      </section>

      <section className="card fade-in" style={{ padding: "18px", marginTop: "16px" }}>
        <h2 style={{ margin: "0 0 10px" }} data-i18n="about.sales.title">Sales Contacts</h2>
        <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
          Angel - <a href="tel:+16475238645" style={{ color: "inherit", textDecoration: "none" }}>647-523-8645</a>
        </p>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>
          Achchu - <a href="tel:+16475704878" style={{ color: "inherit", textDecoration: "none" }}>647-570-4878</a>
        </p>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>
          Andrew - <a href="tel:+14374256638" style={{ color: "inherit", textDecoration: "none" }}>437-425-6638</a>
        </p>
      </section>
    </>
  );
}
