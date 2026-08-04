const CACHE_NAME = 'nearme-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event: any) => {
  const request = event.request;
  const url = new URL(request.url);

  // CRITICAL: Cache ONLY http: and https: protocols to prevent Chrome extension errors
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Bypass non-GET requests and API requests from static caching
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            cache.put(request, responseToCache).catch(() => {});
          }
        });
        return response;
      });
    })
  );
});
