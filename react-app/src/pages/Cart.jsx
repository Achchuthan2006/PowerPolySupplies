import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Cart() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
    setItems(window.PPS?.getCart?.() || []);
  }, []);

  const updateCart = (next) => {
    window.PPS?.setCart?.(next);
    setItems(next);
  };

  const inc = (id) => {
    const next = items.map((item) =>
      item.id === id ? { ...item, qty: item.qty + 1 } : item
    );
    updateCart(next);
  };

  const dec = (id) => {
    const next = items
      .map((item) =>
        item.id === id ? { ...item, qty: item.qty - 1 } : item
      )
      .filter((item) => item.qty > 0);
    updateCart(next);
  };

  const removeItem = (id) => {
    const next = items.filter((item) => item.id !== id);
    updateCart(next);
  };

  const total = items.reduce((sum, item) => {
    const unit = window.PPS?.getTieredPriceCents?.(item, item.qty) ?? item.priceCents;
    const baseCurrency = item.currencyBase || item.currency || "CAD";
    const baseCents = unit * item.qty;
    return sum + window.PPS?.convertCents?.(baseCents, baseCurrency, window.PPS?.getCurrency?.());
  }, 0);

  if (!items.length) {
    return (
      <div className="card" style={{ padding: "16px" }}>
        {window.PPS_I18N?.t("cart.empty") || "Your cart is empty."}
      </div>
    );
  }

  const lang = window.PPS_I18N?.getLang?.() || "en";

  return (
    <>
      <section className="hero fade-in">
        <h1 data-i18n="cart.title">Your Cart</h1>
      </section>
      <div style={{ display: "grid", gap: "12px" }}>
        {items.map((item) => {
          const desc = lang === "fr"
            ? (item.description_fr || item.description || "")
            : lang === "ko"
              ? (item.description_ko || item.description || "")
              : lang === "hi"
                ? (item.description_hi || item.description || "")
                : lang === "ta"
                  ? (item.description_ta || item.description || "")
                  : lang === "es"
                    ? (window.PPS_I18N?.autoTranslate?.(item.description_es || item.description || "", "es") || (item.description_es || item.description || ""))
                    : item.description || "";
          const displayName = lang === "es"
            ? (window.PPS_I18N?.autoTranslate?.(item.name || "", "es") || item.name)
            : item.name;
          return (
            <div key={item.id} className="card fade-in" style={{ padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{displayName}</div>
                <div style={{ color: "var(--muted)", fontSize: "13px" }}>{window.PPS?.money?.(item.priceCents, item.currency)}</div>
                {desc ? <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>{desc}</div> : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button className="btn" onClick={() => dec(item.id)}>-</button>
                <div style={{ minWidth: "30px", textAlign: "center", fontWeight: 800 }}>{item.qty}</div>
                <button className="btn" onClick={() => inc(item.id)}>+</button>
                <button className="btn btn-outline" onClick={() => removeItem(item.id)}>
                  {window.PPS_I18N?.t("cart.remove") || "Remove"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong data-i18n="cart.total">Total</strong>
        <strong>{window.PPS?.money?.(total, window.PPS?.getCurrency?.())}</strong>
      </div>
      <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
        <Link className="btn btn-outline" to="/products">
          {window.PPS_I18N?.t("cart.browse") || "Browse products"}
        </Link>
        <Link className="btn btn-primary" to="/checkout">
          {window.PPS_I18N?.t("cart.checkout") || "Checkout"}
        </Link>
      </div>
    </>
  );
}
