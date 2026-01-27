/* Power Poly Supplies service worker (notifications + future offline support) */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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

