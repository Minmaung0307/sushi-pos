/* Inventory PWA Service Worker */
const CACHE = 'inv-cache-v1.0.0';

const CORE_ASSETS = [
  '/',                    // if you deploy to a subpath, change this to the correct start path
  '/index.html',
  '/css/styles.css',
  '/js/app.js',          // if you use a query string (e.g. ?v=dev5) we still cache at runtime
  '/contact.html',
  '/policy.html',
  '/license.html',
  '/setup-guide.html',
  '/guide.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // HTML/navigation: Network-first, fall back to cache, then to root
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(()=>{});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Static assets: Cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // only cache basic/opaque ok responses
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(()=>{});
          }
          return res;
        })
        .catch(() => cached); // if fetch fails entirely
    })
  );
});

// Optional: allow page to trigger immediate activation
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});