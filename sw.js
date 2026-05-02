const CACHE_NAME = 'pegabodega-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/css/index.css',
  '/js/config.js',
  '/js/db.js',
  '/js/supabaseClient.js',
  '/js/syncEngine.js',
  '/js/store.js',
  '/js/toast.js',
  '/js/modal.js',
  '/js/router.js',
  '/js/receipt.js',
  '/js/pages/dashboard.js',
  '/js/pages/pdv.js',
  '/js/pages/vendas.js',
  '/js/pages/clientes.js',
  '/js/pages/produtos.js',
  '/js/pages/empresa.js',
  '/js/app.js',
  '/assets/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network first for API calls, cache first for assets
  if (e.request.url.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    // Network-first strategy for app files to ensure updates propagate
    e.respondWith(
      fetch(e.request).then((response) => {
        // Update cache with fresh response
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match(e.request))
    );
  }
});
