/* ============================================================
   MAVE / MUREZA — Progressive Web App Service Worker (v1)
   Enables offline fallback, asset caching, and PWA installation.
   ============================================================ */

const CACHE_NAME = "mave-pwa-v1.1";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/cms.html",
  "/admin.html",
  "/manifest.json",
  "/manifest-admin.json",
  "/css/style.css",
  "/css/portal-sections.css",
  "/css/cms.css",
  "/assets/brand/mave_logo.png",
  "/assets/brand/favicon-mave.jpg",
  "/assets/brand/icon.svg",
  "/assets/brand/mave_icon_192.png",
  "/assets/brand/mave_icon_512.png"
];

// Install: precache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[PWA SW] Precache partial error (non-fatal):", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for APIs and Firestore, Stale-while-revalidate for static assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass non-GET and chrome extensions
  if (req.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // Network-first for external APIs, serverless functions, or dynamic Firebase calls
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebaseio.com")
  ) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Stale-while-revalidate for local static assets (CSS, JS, images, fonts)
  event.respondWith(
    caches.match(req).then((cachedResp) => {
      const fetchPromise = fetch(req)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200 && networkResp.type === "basic") {
            const respToCache = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, respToCache);
            });
          }
          return networkResp;
        })
        .catch(() => cachedResp);

      return cachedResp || fetchPromise;
    })
  );
});
