// TAO VPN Service Worker
const VERSION = "v1";
const CACHE_STATIC = `tao-static-${VERSION}`;
const CACHE_API = `tao-api-${VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((c) => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_STATIC && k !== CACHE_API).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // API: network-first, cache fallback (so configs are available offline)
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/configs" || url.pathname === "/api/status" || url.pathname === "/api/notifications") {
      event.respondWith(staleWhileRevalidate(event.request, CACHE_API));
    }
    return; // other API calls go to network as usual
  }

  // App shell: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ||
        fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_STATIC).then((c) => c.put(event.request, clone));
          }
          return res;
        }).catch(() => caches.match("/"))
      )
    );
  }
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || networkPromise;
}

// --- Push ---
self.addEventListener("push", (event) => {
  let data = { title: "TAO VPN", body: "" };
  try { data = event.data ? event.data.json() : data; } catch {}
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge.png",
    tag: data.tag || "tao-vpn",
    renotify: true,
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(data.title || "TAO VPN", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
