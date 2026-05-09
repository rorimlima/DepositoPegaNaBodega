const CACHE_NAME = 'sdo-pwa-v2';
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
      .then(() => self.skipWaiting()) // Ativa imediatamente
  );
});

self.addEventListener('activate', (event) => {
  // Limpa caches antigos
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim()) // Toma controle de todas as abas
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NUNCA cacheia chamadas ao Supabase
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('{"error":"offline"}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Para navegação (HTML pages): Network-first, fallback para cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Para assets estáticos: Cache-first, fallback para network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) return response;

        return fetch(event.request).then((response) => {
          // Só cacheia respostas válidas de assets
          if (!response || response.status !== 200) return response;

          // Cacheia assets estáticos (JS, CSS, imagens, fonts)
          const contentType = response.headers.get('content-type') || '';
          const isAsset = contentType.includes('javascript') ||
                         contentType.includes('css') ||
                         contentType.includes('image') ||
                         contentType.includes('font') ||
                         url.pathname.startsWith('/_next/');

          if (isAsset) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }

          return response;
        });
      })
      .catch(() => {
        // Fallback offline
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
        return new Response('', { status: 503 });
      })
  );
});

// ── Background Sync API ─────────────────────────────────────────────────────
// Quando a conectividade volta, o browser dispara este evento
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        // Notifica todas as abas abertas para disparar o sync
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_SYNC' });
        });
      })
    );
  }
});

// Recebe mensagens do app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'REGISTER_SYNC') {
    // Registra background sync se suportado
    if (self.registration.sync) {
      self.registration.sync.register('sync-queue').catch(() => {});
    }
  }
});
