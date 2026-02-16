import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { categoryLabel, stockClass } from "../lib/catalog.js";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function renderStars(avg) {
  const full = Math.round(avg || 0);
  return new Array(5).fill(0).map((_, i) => (
    <span key={i} className={`star ${i < full ? "filled" : ""}`}>★</span>
  ));
}

export default function ProductDetail() {
  const query = useQuery();
  const slug = query.get("slug") || "";
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewMsg, setReviewMsg] = useState("");
  const [rating, setRating] = useState(5);

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    window.PPS?.loadProducts?.()
      .then((items) => {
        if (!active) return;
        const found = (items || []).find((p) => p.slug === slug);
        setProduct(found || null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!product?.id) return;
    window.PPS?.fetchReviews?.(product.id)
      .then((data) => {
        setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
      })
      .catch(() => {
        setReviews([]);
      });
  }, [product?.id]);

  if (loading) {
    return <div className="card skeleton" style={{ height: "320px" }} />;
  }

  if (!product) {
    return (
      <div className="card" style={{ padding: "14px" }}>
        {window.PPS_I18N?.t("product.not_found") || "Product not found."}
      </div>
    );
  }

  const lang = window.PPS_I18N?.getLang?.() || "en";
  const displayName = lang === "es"
    ? (window.PPS_I18N?.autoTranslate?.(product.name || "", "es") || product.name)
    : product.name;
  const displayCategory = categoryLabel(lang, product.category || "");
  const desc = lang === "fr"
    ? (product.description_fr || product.description)
    : lang === "ko"
      ? (product.description_ko || product.description)
      : lang === "hi"
        ? (product.description_hi || product.description)
        : lang === "ta"
          ? (product.description_ta || product.description)
          : lang === "es"
            ? (window.PPS_I18N?.autoTranslate?.(product.description_es || product.description || "", "es") || (product.description_es || product.description || ""))
            : product.description;

  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
    : 0;

  const addToCart = () => {
    if (product.stock <= 0) return;
    window.PPS?.addToCart?.(product);
    window.PPS?.updateCartBadge?.();
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!product?.id) return;
    setReviewMsg(window.PPS_I18N?.t("product.reviews.submitting") || "Submitting review...");
    const payload = {
      rating,
      name: event.target.name.value.trim(),
      comment: event.target.comment.value.trim(),
    };
    try {
      await window.PPS?.submitReview?.(product.id, payload);
      setReviewMsg(window.PPS_I18N?.t("product.reviews.thanks") || "Thanks! Your review was added.");
      event.target.reset();
      setRating(5);
      const data = await window.PPS?.fetchReviews?.(product.id);
      setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
    } catch (_err) {
      setReviewMsg(window.PPS_I18N?.t("product.reviews.submit_failed") || "Failed to submit review.");
    }
  };

  return (
    <>
      <section className="hero fade-in" style={{ marginBottom: "16px" }}>
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="product.kicker">
          Product detail
        </p>
        <h1 style={{ margin: "4px 0 6px" }}>{displayName}</h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          {window.PPS_I18N?.t("product.category") || "Category:"} {displayCategory || "N/A"}
        </p>
      </section>

      <div className="grid grid-split" style={{ gap: "24px" }}>
        <div className="card fade-in">
          <img src={product.image} alt={displayName} loading="lazy" decoding="async" style={{ height: "420px" }} />
        </div>
        <div className="card fade-in" style={{ padding: "18px" }}>
          <h2 style={{ margin: 0 }}>{displayName}</h2>
          <p style={{ color: "var(--muted)", marginTop: "8px" }}>{displayCategory}</p>
          {(() => {
            const compareCents = (Number(product.priceCents) || 0) + 1000;
            const memberCents = Number(product.priceCents) || 0;
            const savingsCents = Math.max(0, compareCents - memberCents);
            const isMember = Boolean(window.PPS?.getSession?.());
            const bannerTemplate = window.PPS_I18N?.t("member.banner") || "Log in to save {{amount}} with Power Poly Member Pricing";
            const bannerText = bannerTemplate.replace("{{amount}}", window.PPS?.money?.(savingsCents, product.currency));
            return (
              <>
                <div className="member-pricing">
                  <div>
                    <div className="market-label" data-i18n="market.price.label">Market price</div>
                    <span className="compare-price">
                      {window.PPS?.money?.(compareCents, product.currency)}
                    </span>
                  </div>
                  <div>
                    <div className="member-label" data-i18n="member.price.label">Power Poly Member Price</div>
                    <span className="price" style={{ fontSize: "22px" }}>
                      {window.PPS?.money?.(memberCents, product.currency)}
                    </span>
                  </div>
                </div>
                {!isMember && savingsCents > 0 ? (
                  <Link className="member-banner" to="/login">{bannerText}</Link>
                ) : null}
              </>
            );
          })()}
          <div className={`stock ${stockClass(product.stock)}`}>
            <span className="dot" />
            {product.stock <= 0
              ? (window.PPS_I18N?.t("product.stock.out") || "Out of stock")
              : product.stock <= 10
                ? (window.PPS_I18N?.t("product.stock.low") || "Almost out of stock")
                : (window.PPS_I18N?.t("product.stock.in") || "In stock")}
          </div>
          <p style={{ marginTop: "14px", color: "var(--text)", lineHeight: 1.5 }}>{desc || ""}</p>

          <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn btn-primary" disabled={product.stock <= 0} onClick={addToCart} data-i18n="product.add">
              Add to cart
            </button>
            <Link className="btn btn-outline" to="/products" data-i18n="product.view">
              View
            </Link>
          </div>
        </div>
      </div>

      <section className="reviews-section">
        <div className="reviews-header">
          <span>{(window.PPS_I18N?.t("product.reviews.count") || "{{count}} reviews").replace("{{count}}", String(reviews.length))}</span>
          <span className="review-meta">
            {renderStars(average)} ({average.toFixed(1)} / 5)
          </span>
        </div>
        {reviews.length === 0 ? (
          <p className="review-meta">{window.PPS_I18N?.t("product.reviews.none") || "No reviews yet"}</p>
        ) : (
          <div className="testimonial-grid">
            {reviews.map((r, idx) => (
              <div key={idx} className="testimonial-card">
                <div style={{ fontWeight: 800 }}>{r.name || (window.PPS_I18N?.t("product.reviews.anonymous") || "Anonymous")}</div>
                <div className="review-meta">{new Date(r.createdAt).toLocaleString()}</div>
                <p className="testimonial-text">{r.comment}</p>
              </div>
            ))}
          </div>
        )}

        <form className="card" style={{ padding: "16px", marginTop: "12px" }} onSubmit={submitReview}>
          <div className="reviews-header" style={{ marginBottom: "10px" }}>
            <span data-i18n="product.reviews.rate">Rate this product</span>
            <div className="star-input">
              {new Array(5).fill(0).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`star-btn ${i < rating ? "active" : ""}`}
                  onClick={() => setRating(i + 1)}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            <input className="input" name="name" placeholder="Your name (optional)" data-i18n-placeholder="product.reviews.name" />
            <textarea className="input" name="comment" rows="4" placeholder="Leave a review" data-i18n-placeholder="product.reviews.comment" />
            <button className="btn btn-primary" type="submit" data-i18n="product.reviews.submit">
              Submit review
            </button>
            {reviewMsg ? <div className="status muted">{reviewMsg}</div> : null}
          </div>
        </form>
      </section>
    </>
  );
}

