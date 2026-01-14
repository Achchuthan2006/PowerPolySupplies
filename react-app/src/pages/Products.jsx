import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { categoryLabel, stockClass, stockLabel } from "../lib/catalog.js";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function buildQueryTokens(query) {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

function isCloseMatch(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > 1) return false;
  let prev = new Array(bl + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= al; i += 1) {
    let cur = [i];
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[bl] <= 1;
}

export default function Products() {
  const query = useQuery();
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
        setProducts(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cat = query.get("cat") || "";
  const searchQuery = (query.get("q") || "").trim();
  const lang = window.PPS_I18N?.getLang?.() || "en";

  const filtered = useMemo(() => {
    const base = cat
      ? products.filter((p) => (p.category || "").toLowerCase() === cat.toLowerCase())
      : products;
    const normQuery = normalizeSearchText(searchQuery);
    const queryTokens = buildQueryTokens(searchQuery);
    if (!normQuery) return base;
    return base.filter((p) => {
      const haystack = [
        p.name,
        p.category,
        p.description,
        p.description_fr,
        p.description_ko,
        p.description_hi,
        p.description_ta,
        p.description_es,
        p.slug,
      ].map(normalizeSearchText);
      const joined = haystack.join(" ");
      if (joined.includes(normQuery)) return true;
      const hayTokens = Array.from(new Set(joined.split(" ").filter(Boolean)));
      if (!queryTokens.length) return false;
      if (queryTokens.length === 1) {
        const token = queryTokens[0];
        return hayTokens.some((t) => t.startsWith(token) || token.startsWith(t) || isCloseMatch(token, t));
      }
      return queryTokens.every((qt) => hayTokens.some((t) => t.startsWith(qt) || qt.startsWith(t) || isCloseMatch(qt, t)));
    });
  }, [cat, products, searchQuery]);

  const showLabel = window.PPS_I18N?.t("products.hint.show") || "Showing category: {{cat}}";
  const browseLabel = window.PPS_I18N?.t("products.hint.browse") || "Browse all products";
  const catLabel = cat ? categoryLabel(lang, cat) : "";
  const resultsForLabel = lang === "es"
    ? (window.PPS_I18N?.autoTranslate?.("Results for", "es") || "Resultados para")
    : "Results for";

  const hintText = cat && searchQuery
    ? `${showLabel.replace("{{cat}}", catLabel)} - ${resultsForLabel} "${searchQuery}"`
    : searchQuery
      ? `${resultsForLabel} "${searchQuery}"`
      : cat
        ? showLabel.replace("{{cat}}", catLabel)
        : browseLabel;

  const addToCart = (product, qty = 1) => {
    if (!product || product.stock <= 0) return;
    window.PPS?.addToCart?.(product, qty);
    window.PPS?.updateCartBadge?.();
  };

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="products.kicker">
          Products
        </p>
        <h1 data-i18n="products.title">Browse products</h1>
        <p data-i18n="products.subtitle">Browse all available products.</p>
        <span data-i18n="products.filter_hint">Filter by category to jump in.</span>
      </section>

      <div style={{ marginTop: "14px", color: "var(--muted)" }}>{hintText}</div>

      {loading ? (
        <div className="grid grid-4" style={{ marginTop: "16px" }}>
          {new Array(8).fill(0).map((_, idx) => (
            <div key={idx} className="card skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="no-results">
          <img src="/assets/poly%20logo%20without%20background.png" alt="Power Poly Supplies" loading="lazy" decoding="async" />
          <h3>{window.PPS_I18N?.t("products.no_results") || "No results found"}</h3>
          <p>{window.PPS_I18N?.t("products.no_results_body") || "Try a different search, or browse the full catalog."}</p>
          <div className="no-results-actions">
            <Link className="btn btn-primary" to="/products">
              {window.PPS_I18N?.t("products.no_results_all") || "Browse all products"}
            </Link>
            <Link className="btn btn-outline" to="/contact">
              {window.PPS_I18N?.t("products.no_results_help") || "Ask for help"}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-4" style={{ marginTop: "16px" }}>
          {filtered.map((p) => {
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
                      {window.PPS_I18N?.t("products.action.view") || "View"}
                    </Link>
                    <button
                      className="btn btn-primary"
                      disabled={p.stock <= 0}
                      onClick={() => addToCart(p, 1)}
                    >
                      {window.PPS_I18N?.t("products.action.add") || "Add"}
                    </button>
                    <Link className="btn btn-outline" to="/cart" data-i18n="products.action.cart">
                      {window.PPS_I18N?.t("products.action.cart") || "Go to cart"}
                    </Link>
                  </div>
                  <div className="bulk-quick">
                    <button className="btn btn-outline" disabled={p.stock <= 0} onClick={() => addToCart(p, 10)}>
                      {window.PPS_I18N?.t("products.bulk.10") || "10+ boxes"}
                    </button>
                    <button className="btn btn-outline" disabled={p.stock <= 0} onClick={() => addToCart(p, 15)}>
                      {window.PPS_I18N?.t("products.bulk.15") || "15+ boxes"}
                    </button>
                    <button className="btn btn-outline" disabled={p.stock <= 0} onClick={() => addToCart(p, 20)}>
                      {window.PPS_I18N?.t("products.bulk.20") || "20+ boxes"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

