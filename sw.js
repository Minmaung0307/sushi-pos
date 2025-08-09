// Sushi POS Service Worker (app shell + instant updates)

const CACHE = 'sushi-pos-v2';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE))
  );
  // Keep the new worker in "waiting" until page tells us to skip
});

// Allow page to request immediate activation
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
     self.skipWaiting();
  }
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Strategy:
// - HTML: network first (falls back to cache)
// - Static assets: stale-while-revalidate
// - Otherwise: cache-first fallback to network
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isHTML = req.destination === 'document' || req.headers.get('accept')?.includes('text/html');
  const isStatic = ['style', 'script', 'image', 'font'].includes(req.destination);

  if (isHTML) {
    event.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req) || caches.match('./index.html'))
    );
    return;
  }

  if (isStatic) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const net = fetch(req).then(r => { cache.put(req, r.clone()); return r; }).catch(() => null);
      return cached || net || Response.error();
    })());
    return;
  }

  event.respondWith(caches.match(req).then(c => c || fetch(req)));
});