// Frontend -> Backend API base URL.
// - Leave empty for same-origin deployments (frontend + backend on same domain).
// - Set to your backend URL when deployed separately.
window.API_BASE_URL = "https://powerpolysupplies.onrender.com";

// Backwards-compat: older scripts read `window.PPS_API_BASE`.
window.PPS_API_BASE = window.API_BASE_URL;
