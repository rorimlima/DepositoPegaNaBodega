const CACHE_NAME = 'peganabodega-pwa-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // Offline First approach for navigation
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Return from cache
        }
        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Clone the response and cache it
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Avoid caching api/supabase calls
                if (!event.request.url.includes('supabase.co')) {
                  cache.put(event.request, responseToCache);
                }
              });
            return response;
          }
        );
      }).catch(() => {
        // Fallback for offline mode if page not cached
        return caches.match('/');
      })
  );
});
