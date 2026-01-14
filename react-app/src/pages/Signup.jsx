import { useEffect, useState } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [status, setStatus] = useState({ text: "", type: "muted" });
  const [codeSent, setCodeSent] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.PPS_I18N?.applyTranslations?.();
  }, []);

  const sendCode = async (event) => {
    event.preventDefault();
    const form = event.target.closest("form");
    const email = form.email.value.trim();
    const name = form.first.value.trim();
    if (!email) {
      setStatus({
        text: window.PPS_I18N?.t("signup.status.email_first") || "Please enter an email first.",
        type: "error"
      });
      return;
    }
    setBusy(true);
    setStatus({ text: window.PPS_I18N?.t("signup.status.sending") || "Sending code...", type: "muted" });
    try {
      const apiBase = window.PPS?.API_BASE || "";
      const res = await fetch(`${apiBase}/api/auth/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("Failed");
      setCodeSent(true);
      setStatus({
        text: data?.devMode
          ? (window.PPS_I18N?.t("signup.status.dev") || "Dev mode: use code") + ` ${data.code}`
          : (window.PPS_I18N?.t("signup.status.sent") || "Verification code sent. Check your email."),
        type: "success"
      });
    } catch (err) {
      setStatus({
        text: window.PPS_I18N?.t("signup.status.failed_send") || "Failed to send code.",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    const form = event.target.closest("form");
    const email = form.email.value.trim();
    const code = form.code.value.trim();
    if (!email || !code) {
      setStatus({
        text: window.PPS_I18N?.t("signup.status.enter_code") || "Enter the 4-digit code.",
        type: "error"
      });
      return;
    }
    setBusy(true);
    setStatus({ text: window.PPS_I18N?.t("signup.status.verifying") || "Verifying code...", type: "muted" });
    try {
      const apiBase = window.PPS?.API_BASE || "";
      const res = await fetch(`${apiBase}/api/auth/check-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("Failed");
      setCodeVerified(true);
      setStatus({
        text: window.PPS_I18N?.t("signup.status.verified") || "Verification completed. Create your password.",
        type: "success"
      });
    } catch (err) {
      setStatus({
        text: window.PPS_I18N?.t("signup.status.invalid") || "Invalid code. You can resend it.",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  };

  const register = async (event) => {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value.trim();
    const code = form.code.value.trim();
    const name = form.first.value.trim();
    const password = form.password.value.trim();
    const confirm = form.confirm.value.trim();
    if (password.length < 6) {
      setStatus({
        text: window.PPS_I18N?.t("signup.status.pass_len") || "Password must be at least 6 characters.",
        type: "error"
      });
      return;
    }
    if (password !== confirm) {
      setStatus({
        text: window.PPS_I18N?.t("signup.status.pass_match") || "Passwords do not match.",
        type: "error"
      });
      return;
    }
    setBusy(true);
    setStatus({ text: window.PPS_I18N?.t("signup.status.creating") || "Creating account...", type: "muted" });
    try {
      const apiBase = window.PPS?.API_BASE || "";
      const res = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.message || "Failed");
      window.PPS?.setSession?.({
        token: data.token,
        email: data.email,
        name: data.name || "",
        expiresAt: data.expiresAt,
      });
      navigate("/account");
    } catch (err) {
      setStatus({
        text: err.message || (window.PPS_I18N?.t("signup.status.failed") || "Account creation failed."),
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card fade-in" style={{ padding: "18px" }}>
      <p style={{ margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--muted)" }} data-i18n="signup.kicker">
        Account
      </p>
      <h1 data-i18n="signup.title">Create your account</h1>
      <p data-i18n="signup.subtitle">Set up your profile to save your details, view orders, and check out faster.</p>
      <form onSubmit={register} style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
        <input className="input" name="first" placeholder="First name" data-i18n-placeholder="signup.form.first" />
        <input className="input" name="last" placeholder="Last name" data-i18n-placeholder="signup.form.last" />
        <input className="input" name="email" type="email" placeholder="Email address" data-i18n-placeholder="signup.form.email" required />
        <div className="code-inputs">
          <input className="code-box" name="code" placeholder="1234" aria-label="Verification code" />
          <button className="btn btn-outline" type="button" onClick={sendCode} disabled={busy} data-i18n="signup.code.send">
            Send verification code
          </button>
          <button className="btn" type="button" onClick={verifyCode} disabled={!codeSent || busy} data-i18n="signup.code.verify">
            Verify code
          </button>
        </div>
        <input className="input" name="password" type="password" placeholder="Create password" data-i18n-placeholder="signup.form.password" disabled={!codeVerified} />
        <input className="input" name="confirm" type="password" placeholder="Re-enter password" data-i18n-placeholder="signup.form.confirm" disabled={!codeVerified} />
        <button className="btn btn-primary" type="submit" disabled={!codeVerified || busy} data-i18n="signup.form.create">
          {busy
            ? (window.PPS_I18N?.t("signup.status.creating") || "Creating account...")
            : (window.PPS_I18N?.t("signup.form.create") || "Create account")}
        </button>
        {status.text ? <div className={`status ${status.type || "muted"}`}>{status.text}</div> : null}
      </form>
    </section>
  );
}
