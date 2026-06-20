// CACHE_NAME carries a per-deploy version token. In production the server
// replaces __SW_VERSION__ with a hash that changes on every build, so each
// deploy ships a byte-different service worker and the browser treats it as a
// real update. In dev the literal placeholder is fine as a stable cache name.
const CACHE_NAME = 'debtmanagerpro-__SW_VERSION__';
const APP_SHELL = [
  '/',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Don't fail install if a shell asset is unavailable; app can still
        // bootstrap from network on first launch.
        return undefined;
      });
    })
  );
  // NOTE: we intentionally do NOT call skipWaiting() here. A new worker waits
  // until the page tells it to activate (via the SKIP_WAITING message below) or
  // until every tab/window using the old worker is closed. This lets the app
  // show a "new version available" prompt instead of reloading mid-task, while
  // still updating automatically the next time the app is fully relaunched.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Allow the page to activate a waiting worker on demand (the "Reload to update"
// action posts this message).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isHtmlResponse(response) {
  if (!response) return false;
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Never serve API responses from cache.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Always fetch the service worker and manifests fresh.
  if (
    url.pathname === '/sw.js' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/manifest-collector.json'
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Hashed build assets are immutable; cache-first is safe.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests: network-first, validate response, fall back to a
  // known-good cached shell. Only cache real HTML responses so a bad/empty
  // response can't permanently break the launch.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && isHtmlResponse(response)) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/', responseToCache);
            });
            return response;
          }
          // Network returned something unusable (e.g. 5xx, empty body, wrong
          // content-type). Try the cached shell instead of breaking launch.
          return caches.match('/').then((cachedShell) => {
            return cachedShell || response;
          });
        })
        .catch(() => {
          return caches.match('/').then((cachedResponse) => {
            return cachedResponse || new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || new Response('Offline', { status: 503 });
      });
    })
  );
});
