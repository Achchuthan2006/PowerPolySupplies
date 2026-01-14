export const API_BASE = "http://localhost:5000"; // Update this when you deploy

export async function fetchProducts() {
  try {
    // cache: 'no-store' ensures we always get fresh stock levels
    const res = await fetch(`${API_BASE}/api/products`, { cache: 'no-store' });
    if (!res.ok) throw new Error("Failed to fetch products");
    return await res.json();
  } catch (error) {
    console.error("API Error:", error);
    return [];
  }
}

export async function fetchProductBySlug(slug) {
  const products = await fetchProducts();
  return products.find((p) => p.slug === slug);
}

export async function fetchReviews(productId) {
  try {
    const res = await fetch(`${API_BASE}/api/reviews?productId=${productId}`, { cache: 'no-store' });
    if (!res.ok) return { reviews: [], average: 0, count: 0 };
    return await res.json();
  } catch (error) {
    return { reviews: [], average: 0, count: 0 };
  }
}

export const formatMoney = (cents, currency = 'CAD') => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100);
};

// --- Auth & User API ---

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function sendVerificationCode(email, name) {
  const res = await fetch(`${API_BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  return res.json();
}

export async function verifyCode(email, code) {
  const res = await fetch(`${API_BASE}/api/auth/check-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  return res.json();
}

export async function registerUser(payload) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchUserOrders(token) {
  const res = await fetch(`${API_BASE}/api/account/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("Unauthorized");
  return res.json();
}

export async function submitContact(payload) {
  const res = await fetch(`${API_BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function submitFeedback(payload) {
  const res = await fetch(`${API_BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// --- Admin API ---

export async function fetchAdminOrders() {
  const res = await fetch(`${API_BASE}/api/admin/orders`, { cache: 'no-store' });
  return res.json();
}

export async function fulfillOrder(orderId) {
  const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/fulfill`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error("Failed to fulfill");
  return res.json();
}

export async function fetchAdminMessages() {
  const res = await fetch(`${API_BASE}/api/admin/messages`, { cache: 'no-store' });
  return res.json();
}