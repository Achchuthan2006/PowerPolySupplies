import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [status, setStatus] = useState({ text: "", type: "muted" });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  const submitLogin = async (event) => {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value.trim();
    const password = form.password.value.trim();
    if (!email || !password) {
      setStatus({
        text: window.PPS_I18N?.t("login.status.missing") || "Enter email and password.",
        type: "error"
      });
      return;
    }
    setBusy(true);
    setStatus({ text: window.PPS_I18N?.t("login.status.signing") || "Signing in...", type: "muted" });
    try {
      const apiBase = window.PPS?.API_BASE || "";
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus({
          text: data?.message || (window.PPS_I18N?.t("login.status.failed") || "Login failed."),
          type: "error"
        });
      } else {
        window.PPS?.setSession?.({
          token: data.token,
          email: data.email,
          name: data.name || "",
          expiresAt: data.expiresAt,
        });
        navigate("/account");
      }
    } catch (err) {
      setStatus({
        text: window.PPS_I18N?.t("login.status.unreachable") || "Server unreachable. Is the backend running?",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="hero fade-in">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="login.kicker">
          Account
        </p>
        <h1 data-i18n="login.title">Sign in</h1>
        <p data-i18n="login.subtitle">Log in to view your orders and check out faster.</p>
      </section>

      <section className="grid grid-split-even" style={{ gap: "16px", marginTop: "16px" }}>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h2 style={{ margin: "0 0 10px" }} data-i18n="login.form.title">Log in</h2>
          <form onSubmit={submitLogin} className="grid" style={{ gap: "10px" }}>
            <input className="input" type="email" name="email" placeholder="Email" data-i18n-placeholder="login.form.email" required />
            <input className="input" type="password" name="password" placeholder="Password" data-i18n-placeholder="login.form.password" required />
            <button className="btn btn-primary" type="submit" disabled={busy} data-i18n="login.form.submit">
              {busy
                ? (window.PPS_I18N?.t("login.status.signing") || "Signing in...")
                : (window.PPS_I18N?.t("login.form.submit") || "Log in")}
            </button>
            {status.text ? <div className={`status ${status.type || "muted"}`}>{status.text}</div> : null}
          </form>
        </div>
        <div className="card fade-in" style={{ padding: "16px" }}>
          <h2 style={{ margin: "0 0 10px" }} data-i18n="login.create.title">Create account</h2>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }} data-i18n="login.create.desc">
            Create an account to save your details, view orders, and check out faster.
          </p>
          <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link className="btn btn-outline" to="/signup" data-i18n="login.create.signup">Sign up</Link>
            <Link className="btn" to="/products" data-i18n="login.create.browse">Browse products</Link>
          </div>
          <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "12px" }} data-i18n="login.create.note">
            (Signup flows live on the next page.)
          </div>
        </div>
      </section>
    </>
  );
}
