/* Service worker cleanup: unregister old cached versions so the site serves fresh files. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // ignore cache cleanup failures
    }

    try {
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "PPS_SW_DISABLED" });
      }
    } catch {
      // ignore client update failures
    }

    try {
      await self.registration.unregister();
    } catch {
      // ignore unregister failures
    }
  })());
});
