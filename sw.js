// Service Worker do Portal CD Grupo
// Cache estratégico: app shell + offline fallback

const CACHE_NAME = 'cd-grupo-v1';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './icones/icon-192.png',
  './icones/icon-512.png',
  './icones/apple-touch-icon.png'
];

// Install: cachear arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando app shell');
      return cache.addAll(URLS_TO_CACHE).catch((err) => {
        console.warn('[SW] Erro ao cachear:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first pra HTMLs (sempre fresco), cache-first pra assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Não interceptar requests do Firebase, YouTube, fonts, etc.
  if (url.origin !== self.location.origin) return;

  // Network-first pra HTMLs
  if (req.destination === 'document' || req.url.endsWith('.html')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((res) => res || caches.match('./app.html')))
    );
    return;
  }

  // Cache-first pra assets (imagens, ícones)
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((res) => {
        // Cachear novos assets
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// Push notifications (Firebase Cloud Messaging vai usar isso)
self.addEventListener('push', (event) => {
  let data = { title: 'CD Grupo', body: 'Você tem uma nova notificação' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  const options = {
    body: data.body,
    icon: './icones/icon-192.png',
    badge: './icones/icon-192.png',
    tag: data.tag || 'cd-grupo-notification',
    data: { url: data.url || './app.html' },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Click na notificação abre o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './app.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/portal-cdgrupo') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
