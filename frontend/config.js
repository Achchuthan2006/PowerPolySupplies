// Frontend -> Backend API base URL.
// - Leave empty for same-origin deployments (frontend + backend on same domain).
// - Set to your backend URL when deployed separately.
window.API_BASE_URL = "https://powerpolysupplies.onrender.com";

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
