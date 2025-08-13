// public/service-worker.js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

// (Optional) very light cache passthrough:
// self.addEventListener('fetch', () => {});