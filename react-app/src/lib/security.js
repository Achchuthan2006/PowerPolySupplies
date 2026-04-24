const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s.]{7,25}$/;

export function sanitizeText(value, { maxLength = 500, multiline = false } = {}) {
  const input = String(value ?? "");
  const withoutAngles = input.replace(/[<>]/g, "");
  const withoutControls = withoutAngles.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const normalized = multiline
    ? withoutControls.replace(/\r\n/g, "\n").replace(/[^\S\n]+/g, " ").trim()
    : withoutControls.replace(/\s+/g, " ").trim();
  return normalized.slice(0, maxLength);
}

export function sanitizeEmail(value) {
  return sanitizeText(String(value || "").toLowerCase(), { maxLength: 254 });
}

export function sanitizePhone(value) {
  return sanitizeText(String(value || "").replace(/[^0-9+()\-\s.]/g, ""), { maxLength: 25 });
}

export function isValidEmail(value) {
  return EMAIL_RE.test(sanitizeEmail(value));
}

export function isValidPhone(value) {
  const cleaned = sanitizePhone(value);
  return !cleaned || PHONE_RE.test(cleaned);
}

export function containsSuspiciousInput(value) {
  return /<script|javascript:|onerror=|onload=|<iframe|data:text\/html/i.test(String(value || ""));
}

export function ensureSecureApiBase(rawBase) {
  const raw = String(rawBase || "").trim().replace(/\/+$/, "").replace(/\/api$/i, "");
  if (!raw) return "";
  let parsed;
  try {
    parsed = new URL(raw, window.location.origin);
  } catch {
    throw new Error("Invalid API base URL.");
  }
  const isLocalhost = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (window.location.protocol === "https:" && parsed.protocol !== "https:" && !isLocalhost) {
    throw new Error("Blocked insecure API endpoint.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

let recaptchaScriptPromise = null;

export function loadRecaptcha(siteKey) {
  const key = String(siteKey || "").trim();
  if (!key) return Promise.resolve(null);
  if (window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
  if (recaptchaScriptPromise) return recaptchaScriptPromise;

  recaptchaScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.grecaptcha);
    script.onerror = () => reject(new Error("reCAPTCHA failed to load."));
    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
}

export async function getRecaptchaToken(action) {
  const siteKey = String(window.RECAPTCHA_SITE_KEY || "").trim();
  if (!siteKey) return "";
  const grecaptcha = await loadRecaptcha(siteKey);
  if (!grecaptcha?.ready || !grecaptcha?.execute) return "";
  return await new Promise((resolve, reject) => {
    grecaptcha.ready(async () => {
      try {
        const token = await grecaptcha.execute(siteKey, { action });
        resolve(String(token || "").trim());
      } catch (error) {
        reject(error);
      }
    });
  });
}
