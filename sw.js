// Sushi POS Service Worker (stable, safe for Firebase)
const CACHE_NAME = 'sushi-pos-cache-v3';
const OFFLINE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(OFFLINE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) && caches.delete(k)));
    await self.clients.claim();
  })());
});

const FIREBASE_HOSTS = [
  'firestore.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'securetoken.googleapis.com',
  'www.googleapis.com'
];

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Firebase traffic completely
  if (FIREBASE_HOSTS.includes(url.hostname)) return;

  // Only cache GET
  if (request.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const resp = await fetch(request);
      if (resp && resp.status === 200 && resp.type === 'basic') {
        cache.put(request, resp.clone());
      }
      return resp;
    } catch (e) {
      return cache.match('./index.html');
    }
  })());
});