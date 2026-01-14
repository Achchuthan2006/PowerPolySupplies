import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const PROVINCE_RATES = {
  ON: { rate: 0.13, label: "HST 13%" },
  NS: { rate: 0.15, label: "HST 15%" },
  NB: { rate: 0.15, label: "HST 15%" },
  NL: { rate: 0.15, label: "HST 15%" },
  PE: { rate: 0.15, label: "HST 15%" },
  AB: { rate: 0.05, label: "GST 5%" },
  BC: { rate: 0.05, label: "GST 5%" },
  SK: { rate: 0.05, label: "GST 5%" },
  MB: { rate: 0.05, label: "GST 5%" },
  QC: { rate: 0.05, label: "GST 5%", qstRate: 0.09975, qstLabel: "QST 9.975%" },
  YT: { rate: 0.05, label: "GST 5%" },
  NT: { rate: 0.05, label: "GST 5%" },
  NU: { rate: 0.05, label: "GST 5%" }
};

function provinceLabel(code, lang) {
  const namesEn = {
    ON: "Ontario", NS: "Nova Scotia", NB: "New Brunswick", NL: "Newfoundland and Labrador", PE: "Prince Edward Island",
    AB: "Alberta", BC: "British Columbia", SK: "Saskatchewan", MB: "Manitoba", QC: "Quebec",
    YT: "Yukon", NT: "Northwest Territories", NU: "Nunavut"
  };
  const namesFr = {
    ON: "Ontario", NS: "Nouvelle-Ecosse", NB: "Nouveau-Brunswick", NL: "Terre-Neuve-et-Labrador", PE: "Ile-du-Prince-Edouard",
    AB: "Alberta", BC: "Colombie-Britannique", SK: "Saskatchewan", MB: "Manitoba", QC: "Quebec",
    YT: "Yukon", NT: "Territoires du Nord-Ouest", NU: "Nunavut"
  };
  const map = lang === "fr" ? namesFr : namesEn;
  return map[code] || code || "";
}

function provinceName(code, lang) {
  return provinceLabel(code, lang) || code || "";
}

function calculateTax(subtotalCents, provinceCode, lang) {
  const defaultLabel = window.PPS_I18N?.t("checkout.tax", lang) || "Tax";
  const info = PROVINCE_RATES[provinceCode] || { rate: 0, label: defaultLabel };
  const gstAmount = Math.round(subtotalCents * info.rate);
  const qstAmount = info.qstRate ? Math.round(subtotalCents * info.qstRate) : 0;
  const taxAmount = gstAmount + qstAmount;
  return {
    taxRate: info.rate,
    taxLabel: info.label,
    taxAmount,
    gstAmount,
    qstAmount,
    qstLabel: info.qstLabel || "",
    total: subtotalCents + taxAmount
  };
}

function normalizePostal(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getShippingForPostal(postal, lang) {
  const clean = normalizePostal(postal);
  const gtaLabel = window.PPS_I18N?.t("checkout.shipping.label.gta", lang) || "Standard delivery (GTA)";
  const contactLabel = window.PPS_I18N?.t("checkout.shipping.label.contact", lang) || "Delivery charges";
  const freeLabel = window.PPS_I18N?.t("checkout.shipping.free", lang) || "Free";
  const contactValue = window.PPS_I18N?.t("checkout.shipping.contact", lang) || "Contact us";
  if (!clean) {
    return { zone: "Unknown", label: contactLabel, amountCents: 0, displayAmount: contactValue };
  }
  const prefix = clean[0];
  if (prefix === "M" || prefix === "L") {
    return { zone: "GTA", label: gtaLabel, amountCents: 0, displayAmount: freeLabel };
  }
  return { zone: "Canada", label: contactLabel, amountCents: 0, displayAmount: contactValue };
}

export default function Checkout() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [cart, setCart] = useState([]);
  const [productMap, setProductMap] = useState(new Map());
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [province, setProvince] = useState("");
  const [postal, setPostal] = useState("");
  const [status, setStatusState] = useState({ text: "", type: "muted" });
  const [backendError, setBackendError] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [payPending, setPayPending] = useState(false);

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
    window.PPS?.updateCartBadge?.();
    setCart(window.PPS?.getCart?.() || []);
  }, []);

  useEffect(() => {
    let active = true;
    window.PPS?.loadProducts?.()
      .then((products) => {
        if (!active) return;
        const map = new Map((products || []).map((p) => [p.id, p]));
        setProductMap(map);
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const ok = await window.PPS?.pingBackend?.();
      if (!mounted) return;
      if (ok) {
        setBackendError("");
      } else {
        setBackendError(
          window.PPS_I18N?.t("checkout.status.backend") ||
            "Backend unreachable. Start it with: cd backend && npm run dev (expected on 127.0.0.1:5000)."
        );
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const lang = window.PPS_I18N?.getLang?.() || "en";
  const targetCurrency = window.PPS?.getCurrency?.() || "CAD";

  const getUnitBasePrice = (item) => {
    const product = productMap.get(item.id);
    if (product) {
      return window.PPS?.getTieredPriceCents?.(product, item.qty) ?? item.priceCentsBase ?? item.priceCents ?? 0;
    }
    return item.priceCentsBase ?? item.priceCents ?? 0;
  };

  const getUnitCurrency = (item) => {
    const product = productMap.get(item.id);
    return product?.currency || item.currencyBase || item.currency || "CAD";
  };

  const summary = useMemo(() => {
    const savingsCents = cart.reduce((sum, item) => {
      const product = productMap.get(item.id);
      const baseUnit = product?.priceCents ?? item.priceCentsBase ?? item.priceCents ?? 0;
      const unitCents = getUnitBasePrice(item);
      const baseCurrency = getUnitCurrency(item);
      const diff = Math.max(0, baseUnit - unitCents) * item.qty;
      return sum + (window.PPS?.convertCents?.(diff, baseCurrency, targetCurrency) ?? 0);
    }, 0);

    const subtotalCents = cart.reduce((sum, item) => {
      const unitCents = getUnitBasePrice(item);
      const baseCents = unitCents * item.qty;
      const baseCurrency = getUnitCurrency(item);
      return sum + (window.PPS?.convertCents?.(baseCents, baseCurrency, targetCurrency) ?? 0);
    }, 0);

    const taxData = calculateTax(subtotalCents, province, lang);
    const shipping = getShippingForPostal(postal, lang);
    const shippingCents = window.PPS?.convertCents?.(shipping.amountCents, "CAD", targetCurrency) ?? 0;
    const totalCents = taxData.total + shippingCents;

    return { savingsCents, subtotalCents, taxData, shipping, shippingCents, totalCents };
  }, [cart, productMap, province, postal, lang, targetCurrency]);

  const updateStatus = (text, type = "muted") => {
    setStatusState({ text, type });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!cart.length) return;
    const form = formRef.current;
    if (!form?.checkValidity()) {
      form?.reportValidity();
      updateStatus(window.PPS_I18N?.t("checkout.status.required") || "Please fill all required fields.", "error");
      return;
    }

    updateStatus(window.PPS_I18N?.t("checkout.status.submitting") || "Submitting order...", "muted");
    setSubmitPending(true);
    setPayPending(true);

    const customer = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
      postal: form.postal?.value?.trim() || "",
      province,
      language: lang
    };

    const subtotalCents = summary.subtotalCents;
    const taxData = calculateTax(subtotalCents, province, lang);
    const shipping = getShippingForPostal(postal, lang);
    const shippingCents = window.PPS?.convertCents?.(shipping.amountCents, "CAD", targetCurrency) ?? 0;
    const totalCents = taxData.total + shippingCents;

    const enrichedCart = cart.map((item) => {
      const product = productMap.get(item.id);
      const unitCents = getUnitBasePrice(item);
      const baseCurrency = getUnitCurrency(item);
      return {
        ...item,
        description: item.description || product?.description || "",
        description_fr: item.description_fr || product?.description_fr || "",
        description_ko: item.description_ko || product?.description_ko || "",
        description_hi: item.description_hi || product?.description_hi || "",
        description_ta: item.description_ta || product?.description_ta || "",
        description_es: item.description_es || product?.description_es || "",
        priceCentsBase: unitCents,
        currencyBase: baseCurrency,
        priceCents: window.PPS?.convertCents?.(unitCents, baseCurrency, targetCurrency) ?? unitCents,
        currency: targetCurrency
      };
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${window.PPS?.API_BASE}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          customer,
          items: enrichedCart,
          totalCents,
          currency: targetCurrency,
          paymentMethod: "pay_later",
          shipping: {
            zone: shipping.zone,
            label: shipping.label,
            costCents: shippingCents
          }
        })
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        updateStatus(
          data?.message || (window.PPS_I18N?.t("checkout.status.failed") || "Order failed. Check backend is running."),
          "error"
        );
        return;
      }

      window.PPS?.setCart?.([]);
      navigate("/thank-you");
    } catch (err) {
      if (err && err.name === "AbortError") {
        updateStatus("Request timed out. Please try again.", "error");
      } else {
        updateStatus(
          window.PPS_I18N?.t("checkout.status.unreachable") || "Server unreachable. Is the backend running on 127.0.0.1:5000?",
          "error"
        );
      }
    } finally {
      setSubmitPending(false);
      setPayPending(false);
    }
  };

  const handlePayOnline = async () => {
    if (!cart.length) return;
    const form = formRef.current;
    if (!form?.checkValidity()) {
      form?.reportValidity();
      updateStatus(
        window.PPS_I18N?.t("checkout.status.required_province") || "Please fill all required fields including province.",
        "error"
      );
      return;
    }

    updateStatus(window.PPS_I18N?.t("checkout.status.redirect") || "Redirecting to Stripe...", "muted");
    setPayPending(true);
    setSubmitPending(true);

    try {
      const customer = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        address: form.address.value.trim(),
        postal: form.postal?.value?.trim() || "",
        province,
        language: lang
      };

      const subtotalCents = summary.subtotalCents;
      const taxData = calculateTax(subtotalCents, province, lang);
      const shipping = getShippingForPostal(postal, lang);
      const shippingCents = window.PPS?.convertCents?.(shipping.amountCents, "CAD", targetCurrency) ?? 0;

      const taxLine = taxData.taxAmount > 0 ? [
        {
          id: "tax",
          name: `${taxData.taxLabel} (${provinceName(province, lang)})`,
          priceCents: taxData.taxAmount,
          currency: targetCurrency,
          qty: 1
        }
      ] : [];
      const shippingLine = shippingCents > 0 ? [
        {
          id: "shipping",
          name: shipping.label,
          priceCents: shippingCents,
          currency: targetCurrency,
          qty: 1
        }
      ] : [];

      const enrichedCart = cart.map((item) => {
        const product = productMap.get(item.id);
        const unitCents = getUnitBasePrice(item);
        const baseCurrency = getUnitCurrency(item);
        return {
          ...item,
          description: item.description || product?.description || "",
          description_fr: item.description_fr || product?.description_fr || "",
          description_ko: item.description_ko || product?.description_ko || "",
          description_hi: item.description_hi || product?.description_hi || "",
          description_ta: item.description_ta || product?.description_ta || "",
          description_es: item.description_es || product?.description_es || "",
          priceCentsBase: unitCents,
          currencyBase: baseCurrency,
          priceCents: window.PPS?.convertCents?.(unitCents, baseCurrency, targetCurrency) ?? unitCents,
          currency: targetCurrency
        };
      });

      const itemsWithTax = [...enrichedCart, ...taxLine, ...shippingLine];
      const res = await fetch(`${window.PPS?.API_BASE}/api/stripe-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsWithTax, customer })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        window.location.href = data.url;
      } else {
        updateStatus(
          data?.message || (window.PPS_I18N?.t("checkout.status.stripe") || "Stripe not configured (set STRIPE_SECRET_KEY)."),
          "error"
        );
      }
    } catch (err) {
      updateStatus(
        window.PPS_I18N?.t("checkout.status.unreachable") || "Server unreachable. Is the backend running on 127.0.0.1:5000?",
        "error"
      );
    } finally {
      setPayPending(false);
      setSubmitPending(false);
    }
  };

  const disabled = Boolean(backendError) || !cart.length || submitPending || payPending;

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="checkout.kicker">
          Checkout
        </p>
        <h1 data-i18n="checkout.title">Secure checkout</h1>
        <p data-i18n="checkout.subtitle">
          Confirm your order details. Choose to pay online or place the order now and pay later.
        </p>
      </section>

      <section className="grid grid-split" style={{ gap: "16px", marginTop: "16px" }}>
        <div className="card fade-in" style={{ padding: "18px" }}>
          <h2 style={{ margin: "0 0 10px" }} data-i18n="checkout.billing.title">Billing & Delivery</h2>
          <form ref={formRef} onSubmit={handleSubmit} className="grid" style={{ gap: "10px" }}>
            <input className="input" name="name" placeholder="Full Name" data-i18n-placeholder="checkout.form.name" required />
            <input className="input" type="email" name="email" placeholder="Email" data-i18n-placeholder="checkout.form.email" required />
            <input className="input" name="phone" placeholder="Phone (optional)" data-i18n-placeholder="checkout.form.phone" />
            <input
              className="input"
              name="postal"
              placeholder="Postal code"
              value={postal}
              onChange={(event) => setPostal(event.target.value)}
              required
            />
            <select
              className="input"
              name="province"
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              required
            >
              <option value="" data-i18n="checkout.form.province">Select province/territory</option>
              <option value="ON">{provinceLabel("ON", lang)}</option>
              <option value="NS">{provinceLabel("NS", lang)}</option>
              <option value="NB">{provinceLabel("NB", lang)}</option>
              <option value="NL">{provinceLabel("NL", lang)}</option>
              <option value="PE">{provinceLabel("PE", lang)}</option>
              <option value="AB">{provinceLabel("AB", lang)}</option>
              <option value="BC">{provinceLabel("BC", lang)}</option>
              <option value="SK">{provinceLabel("SK", lang)}</option>
              <option value="MB">{provinceLabel("MB", lang)}</option>
              <option value="QC">{provinceLabel("QC", lang)}</option>
              <option value="YT">{provinceLabel("YT", lang)}</option>
              <option value="NT">{provinceLabel("NT", lang)}</option>
              <option value="NU">{provinceLabel("NU", lang)}</option>
            </select>
            <textarea
              className="input"
              name="address"
              placeholder="Address / Delivery instructions"
              data-i18n-placeholder="checkout.form.address"
              style={{ minHeight: "120px" }}
              required
            />
            <button className="btn btn-primary" type="submit" data-i18n="checkout.pay_later" disabled={disabled}>
              {submitPending
                ? (window.PPS_I18N?.t("checkout.status.submitting_btn") || "Submitting...")
                : (window.PPS_I18N?.t("checkout.pay_later") || "Place order (pay later)")}
            </button>
          </form>
        </div>

        <div className="card fade-in" style={{ padding: "18px" }}>
          <h2 style={{ margin: "0 0 10px" }} data-i18n="checkout.summary.title">Order summary</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {!cart.length ? (
              <div style={{ color: "var(--muted)" }}>{window.PPS_I18N?.t("checkout.summary.empty") || "Your cart is empty."}</div>
            ) : (
              cart.map((item) => {
                const product = productMap.get(item.id);
                const desc = lang === "fr"
                  ? (item.description_fr || item.description || product?.description_fr || product?.description || "")
                  : lang === "ko"
                    ? (item.description_ko || item.description || product?.description_ko || product?.description || "")
                    : lang === "hi"
                      ? (item.description_hi || item.description || product?.description_hi || product?.description || "")
                      : lang === "ta"
                        ? (item.description_ta || item.description || product?.description_ta || product?.description || "")
                        : lang === "es"
                          ? (window.PPS_I18N?.autoTranslate?.(item.description_es || item.description || product?.description_es || product?.description || "", "es")
                              || (item.description_es || item.description || product?.description_es || product?.description || ""))
                          : (item.description || item.description_fr || item.description_ko || item.description_hi || item.description_ta || item.description_es || product?.description || "");
                const unitCents = getUnitBasePrice(item);
                const baseCents = unitCents * item.qty;
                const baseCurrency = getUnitCurrency(item);
                const lineTotal = window.PPS?.convertCents?.(baseCents, baseCurrency, targetCurrency) ?? baseCents;
                const displayName = lang === "es"
                  ? (window.PPS_I18N?.autoTranslate?.(item.name || "", "es") || item.name)
                  : item.name;

                return (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                    <div>
                      <div>
                        {displayName} <span style={{ color: "var(--muted)" }}>x{item.qty}</span>
                      </div>
                      {desc ? <div style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }}>{desc}</div> : null}
                    </div>
                    <div style={{ fontWeight: 800 }}>
                      {window.PPS?.money?.(lineTotal, targetCurrency, targetCurrency)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="summary-totals">
            <div className="summary-row">
              <span data-i18n="checkout.summary.subtotal">Subtotal</span>
              <span>{window.PPS?.money?.(summary.subtotalCents, targetCurrency, targetCurrency)}</span>
            </div>
            <div className="summary-row">
              <span>
                {province === "QC"
                  ? `${summary.taxData.taxLabel} - ${provinceName(province, lang)}`
                  : `${summary.taxData.taxLabel}${province ? ` - ${provinceName(province, lang)}` : ""}`}
              </span>
              <span>{window.PPS?.money?.(summary.taxData.gstAmount || summary.taxData.taxAmount, targetCurrency, targetCurrency)}</span>
            </div>
            {province === "QC" ? (
              <div className="summary-row">
                <span>{`${summary.taxData.qstLabel} - ${provinceName(province, lang)}`}</span>
                <span>{window.PPS?.money?.(summary.taxData.qstAmount, targetCurrency, targetCurrency)}</span>
              </div>
            ) : null}
            <div className="summary-row">
              <span>{summary.shipping.label}</span>
              <span>
                {summary.shipping.displayAmount
                  ? summary.shipping.displayAmount
                  : window.PPS?.money?.(summary.shippingCents, targetCurrency, targetCurrency)}
              </span>
            </div>
            <div className="summary-row summary-total">
              <span data-i18n="checkout.summary.total">Total</span>
              <span>{window.PPS?.money?.(summary.totalCents, targetCurrency, targetCurrency)}</span>
            </div>
            {summary.savingsCents > 0 ? (
              <div className="summary-row">
                <span>{window.PPS_I18N?.t("checkout.summary.savings") || "You saved"}</span>
                <span>{window.PPS?.money?.(summary.savingsCents, targetCurrency, targetCurrency)}</span>
              </div>
            ) : null}
          </div>
          <div className="status muted" style={{ marginTop: "10px" }} data-i18n="checkout.shipping.note">
            Standard GTA delivery is free. Express delivery and non-GTA delivery charges are confirmed by our team.
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn btn-outline" type="button" onClick={handlePayOnline} disabled={disabled} data-i18n="checkout.pay_online">
              {payPending
                ? (window.PPS_I18N?.t("checkout.status.redirect_btn") || "Redirecting...")
                : (window.PPS_I18N?.t("checkout.pay_online") || "Pay online with Stripe")}
            </button>
            <Link className="btn" to="/cart" data-i18n="checkout.back">Back to cart</Link>
          </div>
          {backendError ? (
            <div className="status error" style={{ marginTop: "10px" }}>{backendError}</div>
          ) : null}
          {status.text ? (
            <div className={`status ${status.type || "muted"}`} style={{ marginTop: "10px" }}>{status.text}</div>
          ) : null}
        </div>
      </section>
    </>
  );
}


