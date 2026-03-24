// Frontend -> Backend API base URL.
// - Leave empty for same-origin deployments (frontend + backend on same domain).
// - Set to your backend URL when deployed separately.
// - Local static preview (127.0.0.1:5500, Live Server, etc.): use Render by default.
(function(){
  const host = String(window.location.hostname || "").toLowerCase();
  const port = String(window.location.port || "").trim();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const isRender = host.endsWith("onrender.com");
  const isLocalBackend = isLocal && port === "5000";
  window.API_BASE_URL = (isRender || isLocalBackend) ? "" : "https://powerpolysupplies.onrender.com";
})();

// Backwards-compat: older scripts read `window.PPS_API_BASE`.
window.PPS_API_BASE = window.API_BASE_URL;

// Square Web Payments SDK (for saving cards on file).
// These are safe to expose publicly.
// Set SQUARE_ENV to "sandbox" while testing.
window.SQUARE_ENV = "sandbox";
window.SQUARE_APP_ID = "";
window.SQUARE_LOCATION_ID = "";

// Google reCAPTCHA (site key is safe to expose publicly; secret key must stay in backend env).
// Create a key in Google reCAPTCHA admin and paste the *site key* here.
window.RECAPTCHA_SITE_KEY = "";

// AI chat proxy endpoint (server-side). Keep API keys on the backend.
// Example: "https://your-api.example.com/api/ai-chat"
window.PPS_AI_CHAT_ENDPOINT = "";
