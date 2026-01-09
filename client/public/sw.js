const CACHE_NAME = 'zk-geo-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/src/main.ts',
  '/src/style.css',
  '/circuits/Main.wasm',
  '/circuits/Main_final.zkey',
  '/circuits/verification_key.json',
  '/sql-wasm.wasm'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching assets including circuit files');
      return cache.addAll(ASSETS).catch(err => {
        console.error('[SW] Failed to cache assets:', err);
        // Try to cache individually to identify problem files
        return Promise.all(
          ASSETS.map(asset =>
            cache.add(asset).catch(e => console.error(`[SW] Failed to cache ${asset}:`, e))
          )
        );
      });
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
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        console.log('[SW] Serving from cache:', event.request.url);
        return response;
      }
      console.log('[SW] Fetching from network:', event.request.url);
      return fetch(event.request).then(networkResponse => {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.error('[SW] Fetch failed:', event.request.url, err);
        throw err;
      });
    })
  );
});
