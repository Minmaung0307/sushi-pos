// Sushi POS Service Worker (no POST caching, faster nav fallback)

const CACHE_NAME = 'sushi-pos-v3';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// On install: pre-cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// On activate: clean old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
      )
    ).then(() => self.clients.claim())
  );
});

// Helper: should we bypass SW for this request?
const BYPASS = (url) => {
  // Skip Firebase endpoints and cross-origin opaque stuff
  const u = new URL(url);
  const isFirebase = u.host.includes('firebase') || u.host.includes('googleapis');
  return isFirebase;
};

// Fetch strategy:
// - Non-GET: go straight to network (fixes "put POST" error).
// - Navigations (HTML): network-first with cache fallback.
// - Same-origin GET (assets): cache-first, then network.
// - Cross-origin GET: network-first (don’t cache opaque).
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') {
    return; // Let the browser handle it; no cache.put on POST
  }

  const url = new URL(req.url);

  // Don’t mess with firebase/auth streams
  if (BYPASS(req.url)) {
    return; // default network
  }

  // Navigation requests (HTML)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache a copy of the fresh HTML
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('./', resClone).catch(() => {});
          });
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin static assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          // Only cache OK, basic responses
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // Cross-origin GET (e.g., images/CDNs): network-first, no caching of opaques
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});