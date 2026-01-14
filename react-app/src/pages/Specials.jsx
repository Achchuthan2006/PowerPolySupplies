import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { categoryLabel, stockClass, stockLabel } from "../lib/catalog.js";

export default function Specials() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    window.PPS?.loadProducts?.()
      .then((data) => {
        if (!active) return;
        setProducts(Array.isArray(data) ? data.filter((p) => p.special) : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const lang = window.PPS_I18N?.getLang?.() || "en";

  const addToCart = (product, qty = 1) => {
    if (!product || product.stock <= 0) return;
    window.PPS?.addToCart?.(product, qty);
    window.PPS?.updateCartBadge?.();
  };

  if (loading) {
    return (
      <div className="grid grid-4" style={{ marginTop: "16px" }}>
        {new Array(8).fill(0).map((_, idx) => (
          <div key={idx} className="card skeleton" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="card" style={{ padding: "14px" }}>
        {window.PPS_I18N?.t("specials.none") || "No specials yet."}
      </div>
    );
  }

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="specials.kicker">
          Specials
        </p>
        <h1 data-i18n="specials.title">Special offers</h1>
        <p data-i18n="specials.subtitle">Limited offers on select items.</p>
      </section>

      <div className="grid grid-4" style={{ marginTop: "16px" }}>
        {products.map((p) => {
          const compareCents = (Number(p.priceCents) || 0) + 1000;
          const memberCents = Number(p.priceCents) || 0;
          const savingsCents = Math.max(0, compareCents - memberCents);
          const isMember = Boolean(window.PPS?.getSession?.());
          const bannerTemplate = window.PPS_I18N?.t("member.banner") || "Log in to save {{amount}} with Power Poly Member Pricing";
          const bannerText = bannerTemplate.replace("{{amount}}", window.PPS?.money?.(savingsCents, p.currency));
          const displayName = lang === "es"
            ? (window.PPS_I18N?.autoTranslate?.(p.name || "", "es") || p.name)
            : p.name;
          return (
            <div key={p.id} className="card fade-in">
              <Link to={`/product?slug=${encodeURIComponent(p.slug)}`}>
                <img src={p.image} alt={displayName} loading="lazy" decoding="async" />
              </Link>
              <div className="card-body">
                <Link className="card-title" style={{ textDecoration: "none", display: "inline-block" }} to={`/product?slug=${encodeURIComponent(p.slug)}`}>
                  {displayName}
                </Link>
                <div className="card-meta">{categoryLabel(lang, p.category)}</div>
                <div className="member-pricing">
                  <div>
                    <div className="market-label" data-i18n="market.price.label">Market price</div>
                    <span className="compare-price">{window.PPS?.money?.(compareCents, p.currency)}</span>
                  </div>
                  <div>
                    <div className="member-label" data-i18n="member.price.label">Power Poly Member Price</div>
                    <span className="price">{window.PPS?.money?.(memberCents, p.currency)}</span>
                  </div>
                </div>
                {!isMember && savingsCents > 0 ? (
                  <Link className="member-banner" to="/login">{bannerText}</Link>
                ) : null}
                <div className={`stock ${stockClass(p.stock)}`}>
                  <span className="dot" />
                  {stockLabel(p.stock)}
                </div>
                <div style={{ marginTop: "12px", display: "flex", gap: "10px" }}>
                  <Link className="btn" to={`/product?slug=${encodeURIComponent(p.slug)}`}>
                    {window.PPS_I18N?.t("specials.view") || "View"}
                  </Link>
                  <button className="btn btn-primary" disabled={p.stock <= 0} onClick={() => addToCart(p)}>
                    {window.PPS_I18N?.t("specials.add") || "Add"}
                  </button>
                  <Link className="btn btn-outline" to="/cart" data-i18n="specials.action.cart">
                    {window.PPS_I18N?.t("specials.action.cart") || "Go to cart"}
                  </Link>
                </div>
                <div className="bulk-quick">
                  <button className="btn btn-outline" disabled={p.stock <= 0} onClick={() => addToCart(p, 10)}>
                    {window.PPS_I18N?.t("specials.bulk.10") || "10+ boxes"}
                  </button>
                  <button className="btn btn-outline" disabled={p.stock <= 0} onClick={() => addToCart(p, 15)}>
                    {window.PPS_I18N?.t("specials.bulk.15") || "15+ boxes"}
                  </button>
                  <button className="btn btn-outline" disabled={p.stock <= 0} onClick={() => addToCart(p, 20)}>
                    {window.PPS_I18N?.t("specials.bulk.20") || "20+ boxes"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
