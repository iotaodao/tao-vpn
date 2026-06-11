// TAO SuperApp Service Worker — Unified Push
const VERSION = "v2";
const CACHE_STATIC = `tao-static-${VERSION}`;

const STATIC_ASSETS = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_STATIC).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_STATIC).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // API calls — always network, never cache
  // (cached API without auth tokens causes 500 errors)
  if (url.pathname.startsWith("/api/")) return;

  // Matrix calls — never cache
  if (url.pathname.startsWith("/_matrix/")) return;

  // App shell — cache-first with network fallback
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

// ═══════════════════════════════════════════════════════
// PUSH — Unified handler for VPN alerts + Matrix
// ═══════════════════════════════════════════════════════

self.addEventListener("push", (event) => {
  let data = { title: "TAO VPN", body: "" };
  try { data = event.data ? event.data.json() : data; } catch {}

  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge.png",
    tag: data.tag || "tao-vpn",
    renotify: true,
    data: {
      url: data.url || "/",
      tab: data.tab || null,
      roomId: data.roomId || null,
    },
    vibrate: [80, 40, 80],
  };

  // Different styling for Matrix vs VPN notifications
  if (data.tag?.startsWith("matrix-")) {
    options.vibrate = [60, 30, 60];
  }

  event.waitUntil(self.registration.showNotification(data.title || "TAO VPN", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, tab, roomId } = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      // Try to focus existing window
      for (const c of list) {
        if ("focus" in c) {
          c.focus();
          // Send message to switch tab / open room
          if (tab || roomId) {
            c.postMessage({ type: "notification-click", tab, roomId });
          }
          return;
        }
      }
      // Open new window
      if (self.clients.openWindow) return self.clients.openWindow(url || "/");
    })
  );
});
