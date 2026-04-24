(function(){
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[0-9+()\-\s.]{7,25}$/;

  function sanitizeText(value, options){
    const settings = options || {};
    const maxLength = Number(settings.maxLength) || 500;
    const multiline = !!settings.multiline;
    const input = String(value ?? "");
    const withoutAngles = input.replace(/[<>]/g, "");
    const withoutControls = withoutAngles.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    const normalized = multiline
      ? withoutControls.replace(/\r\n/g, "\n").replace(/[^\S\n]+/g, " ").trim()
      : withoutControls.replace(/\s+/g, " ").trim();
    return normalized.slice(0, maxLength);
  }

  function sanitizeEmail(value){
    return sanitizeText(String(value || "").toLowerCase(), { maxLength: 254 });
  }

  function sanitizePhone(value){
    return sanitizeText(String(value || "").replace(/[^0-9+()\-\s.]/g, ""), { maxLength: 25 });
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isValidEmail(value){
    return EMAIL_RE.test(sanitizeEmail(value));
  }

  function isValidPhone(value){
    const cleaned = sanitizePhone(value);
    return !cleaned || PHONE_RE.test(cleaned);
  }

  function containsSuspiciousInput(value){
    return /<script|javascript:|onerror=|onload=|<iframe|data:text\/html/i.test(String(value || ""));
  }

  function ensureSecureApiBase(rawBase){
    const raw = String(rawBase || "").trim().replace(/\/+$/, "").replace(/\/api$/i, "");
    if(!raw) return "";
    let parsed;
    try{
      parsed = new URL(raw, window.location.origin);
    }catch{
      throw new Error("Invalid API base URL.");
    }
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if(window.location.protocol === "https:" && parsed.protocol !== "https:" && !isLocalhost){
      throw new Error("Blocked insecure API endpoint.");
    }
    return parsed.toString().replace(/\/+$/, "");
  }

  let recaptchaScriptPromise = null;

  function loadRecaptcha(siteKey){
    const key = String(siteKey || "").trim();
    if(!key) return Promise.resolve(null);
    if(window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
    if(recaptchaScriptPromise) return recaptchaScriptPromise;

    recaptchaScriptPromise = new Promise((resolve, reject)=>{
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
      script.async = true;
      script.defer = true;
      script.onload = ()=> resolve(window.grecaptcha);
      script.onerror = ()=> reject(new Error("reCAPTCHA failed to load."));
      document.head.appendChild(script);
    });

    return recaptchaScriptPromise;
  }

  async function getRecaptchaToken(action){
    const siteKey = String(window.RECAPTCHA_SITE_KEY || "").trim();
    if(!siteKey) return "";
    const grecaptcha = await loadRecaptcha(siteKey);
    if(!grecaptcha?.ready || !grecaptcha?.execute) return "";
    return await new Promise((resolve, reject)=>{
      grecaptcha.ready(async ()=>{
        try{
          const token = await grecaptcha.execute(siteKey, { action });
          resolve(String(token || "").trim());
        }catch(err){
          reject(err);
        }
      });
    });
  }

  window.PPSSecurity = {
    sanitizeText,
    sanitizeEmail,
    sanitizePhone,
    escapeHtml,
    isValidEmail,
    isValidPhone,
    containsSuspiciousInput,
    ensureSecureApiBase,
    getRecaptchaToken
  };
})();
