/* Power Poly Supplies service worker (offline + notifications) */

const CACHE_VERSION = "pps-v2";
const CORE_CACHE = `pps-core-${CACHE_VERSION}`;
const RUNTIME_CACHE = `pps-runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./products.html",
  "./product.html",
  "./cart.html",
  "./checkout.html",
  "./account.html",
  "./resources.html",
  "./offline.html",
  "./css/styles.css",
  "./js/ui.js",
  "./js/store.js",
  "./js/i18n.js",
  "./js/notifications.js",
  "./assets/poly%20logo%20without%20background.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => {
          if (![CORE_CACHE, RUNTIME_CACHE].includes(key)) return caches.delete(key);
          return null;
        }))
      )
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification?.close?.();
  const url = event.notification?.data?.url || "./account.html#notifications";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          try {
            if (client.url && "focus" in client) {
              client.focus();
              client.navigate(url);
              return;
            }
          } catch {
            // ignore
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});

function isNavigationRequest(request) {
  return request.mode === "navigate" || (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigationRequest(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./offline.html"))
        )
    );
    return;
  }

  const isAsset = /\.(?:css|js|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetcher = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || fetcher;
      })
    );
  }
});

// Placeholder for future server-driven push notifications (requires backend + VAPID keys).
self.addEventListener("push", (event) => {
  try {
    const data = event.data?.json?.() || {};
    const title = String(data.title || "Power Poly Supplies");
    const opts = {
      body: String(data.body || ""),
      icon: "./assets/poly%20logo%20without%20background.png",
      badge: "./assets/poly%20logo%20without%20background.png",
      data: { url: String(data.url || "./account.html#notifications") }
    };
    event.waitUntil(self.registration.showNotification(title, opts));
  } catch {
    // ignore
  }
});
