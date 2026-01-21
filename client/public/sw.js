const CACHE_NAME = 'zk-geo-v2';

// Core assets that must be available offline
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/sql-wasm.wasm',
  '/circuits/Main.wasm',
  '/circuits/verification_key.json'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching core assets');
      // Cache each asset individually so one failure doesn't break all
      return Promise.all(
        CORE_ASSETS.map(asset =>
          cache.add(asset).catch(e => console.warn(`[SW] Failed to cache ${asset}:`, e))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // For navigation requests, try cache first (critical for iOS offline)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
    );
    return;
  }

  // For other requests: cache-first, then network
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).then(networkResponse => {
        // Cache successful GET responses
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
