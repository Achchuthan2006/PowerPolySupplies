import { useEffect, useRef, useState } from "react";
import { payments } from "@square/web-sdk";

function formatAmount(cents, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format((Number(cents) || 0) / 100);
}

function getBackendUrl() {
  return String(import.meta.env.VITE_BACKEND_URL || "").trim().replace(/\/+$/, "");
}

export default function SquareCardCheckout({
  amountCents,
  currency = "CAD",
  disabled = false,
  onSuccess,
}) {
  const mountRef = useRef(null);
  const cardRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "muted" });

  useEffect(() => {
    let active = true;
    let cardInstance = null;

    const initialize = async () => {
      const applicationId = String(import.meta.env.VITE_SQUARE_APP_ID || "").trim();
      const locationId = String(import.meta.env.VITE_SQUARE_LOCATION_ID || "").trim();

      if (!applicationId || !locationId) {
        setMessage({
          text: "Square is not configured yet. Add VITE_SQUARE_APP_ID and VITE_SQUARE_LOCATION_ID.",
          type: "error",
        });
        return;
      }

      try {
        const paymentsClient = await payments(applicationId, locationId);
        if (!paymentsClient || !mountRef.current || !active) return;

        cardInstance = await paymentsClient.card();
        await cardInstance.attach(mountRef.current);
        if (!active) {
          await cardInstance.destroy().catch(() => {});
          return;
        }

        cardRef.current = cardInstance;
        setReady(true);
        setMessage({ text: "", type: "muted" });
      } catch (error) {
        if (!active) return;
        setMessage({
          text: error?.message || "Unable to load the Square card form.",
          type: "error",
        });
      }
    };

    initialize();

    return () => {
      active = false;
      setReady(false);
      const current = cardRef.current || cardInstance;
      cardRef.current = null;
      if (current?.destroy) {
        current.destroy().catch(() => {});
      }
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (disabled || busy) return;

    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      setMessage({
        text: "VITE_BACKEND_URL is missing. Set it to your Render backend URL.",
        type: "error",
      });
      return;
    }

    if (!cardRef.current) {
      setMessage({
        text: "Square card form is still loading. Please try again in a moment.",
        type: "error",
      });
      return;
    }

    setBusy(true);
    setMessage({ text: "Processing payment...", type: "muted" });

    try {
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        const details = Array.isArray(tokenResult.errors)
          ? tokenResult.errors.map((error) => error.message).filter(Boolean).join(" ")
          : "";
        throw new Error(details || "Card tokenization failed.");
      }

      const response = await fetch(`${backendUrl}/api/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenResult.token,
          amount: Math.round(Number(amountCents) || 0),
          currency,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "Payment failed.");
      }

      setMessage({
        text: `Payment successful for ${formatAmount(amountCents, currency)}.`,
        type: "success",
      });
      await cardRef.current.clear?.().catch(() => {});
      onSuccess?.(data);
    } catch (error) {
      setMessage({
        text: error?.message || "Payment failed. Please try another card.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="square-pay-form" onSubmit={handleSubmit}>
      <div className="square-pay-head">
        <div>
          <div className="square-pay-kicker">Square Card Payment</div>
          <div className="square-pay-amount">{formatAmount(amountCents, currency)}</div>
        </div>
        <div className="square-pay-badge">{ready ? "Secure card entry" : "Loading..."}</div>
      </div>

      <div className="square-card-shell">
        <div ref={mountRef} className="square-card-mount" />
      </div>

      <button
        className="btn btn-outline"
        type="submit"
        disabled={disabled || busy || !ready}
      >
        {busy ? "Processing payment..." : `Pay ${formatAmount(amountCents, currency)}`}
      </button>

      {message.text ? (
        <div className={`status ${message.type || "muted"}`}>{message.text}</div>
      ) : null}
    </form>
  );
}
