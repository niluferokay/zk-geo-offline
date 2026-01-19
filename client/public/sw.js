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
  // Service worker logging disabled in production for security
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        // Try to cache individually to identify problem files
        return Promise.all(
          ASSETS.map(asset =>
            cache.add(asset).catch(e => {
              // Silent failure in production
            })
          )
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Service worker logging disabled in production for security
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
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
        return response;
      }
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
        // Silent failure in production
        throw err;
      });
    })
  );
});
