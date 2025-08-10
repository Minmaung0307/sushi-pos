// Sushi POS Service Worker (safe with Firebase)
// v3

const VERSION = 'v3';
const STATIC_CACHE = `sushi-pos-static-${VERSION}`;
const STATIC_ASSETS = [
  '/',               // nav fallback
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Hosts we never touch (Firebase + Google infra)
const BYPASS_HOST_RE = /(firestore\.googleapis\.com|googleapis\.com|firebaseio\.com|gstatic\.com|googleusercontent\.com|identitytoolkit\.googleapis\.com)/i;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(STATIC_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(k => (k.startsWith('sushi-pos-static-') && k !== STATIC_CACHE) ? caches.delete(k) : null)
    );
    await self.clients.claim();
  })());
});

// Optional: navigation preload (slightly faster first paint)
self.addEventListener('activate', (event) => {
  if (self.registration.navigationPreload) {
    event.waitUntil(self.registration.navigationPreload.enable());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1) Never handle non-GET (fixes "Cache.put" error)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 2) Bypass Firebase/Google traffic entirely (fixes Listen 400/backoff)
  if (BYPASS_HOST_RE.test(url.host)) return;

  // 3) App shell: cache-first for our static files
  const isStatic = url.origin === self.location.origin &&
                   (STATIC_ASSETS.includes(url.pathname) ||
                    url.pathname.startsWith('/icons/') ||
                    url.pathname.endsWith('/styles.css') ||
                    url.pathname.endsWith('/app.js'));

  if (isStatic) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(req, { ignoreVary: true, ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        // only cache OK responses
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (_) {
        // last-resort fallback to cached shell
        return cache.match('/index.html') || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // 4) Navigations: network-first, fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // If navigation preload is available, prefer it
        const preload = await event.preloadResponse;
        if (preload) return preload;
        const res = await fetch(req);
        return res;
      } catch (_) {
        const cache = await caches.open(STATIC_CACHE);
        return cache.match('/index.html');
      }
    })());
    return;
  }

  // 5) Everything else same-origin GET: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || network || new Response('Offline', { status: 503 });
    })());
  }
});