/* public/sw.js */
const CACHE = 'rjt-v5'; // bump this to clear old caches

self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // delete old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();

    // tell pages a new SW is active (so they can reload)
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SW_UPDATED' });
    }
  })());
});

// Network-first for navigation requests (HTML)
// Cache-first (with background update) for everything else
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const accept = req.headers.get('accept') || '';

  // Only handle GET
  if (req.method !== 'GET') return;

  // HTML/doc requests
  if (accept.includes('text/html')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const copy = fresh.clone();
        const cache = await caches.open(CACHE);
        cache.put(req, copy);
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Static assets: cache first, then update
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchAndUpdate = fetch(req).then(async (res) => {
      const copy = res.clone();
      const cache = await caches.open(CACHE);
      cache.put(req, copy);
      return res;
    }).catch(() => cached);
    return cached || fetchAndUpdate;
  })());
});
