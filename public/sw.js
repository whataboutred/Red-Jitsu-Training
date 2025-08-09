/* public/sw.js */
// Bump this to force clients to fetch the latest assets
const CACHE = 'rjt-v15';

self.addEventListener('install', () => {
  // Take control immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Purge old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
    // Control all open tabs
    await self.clients.claim();
    // Tell pages a new SW is active (our app will reload)
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SW_UPDATED' });
    }
  })());
});

// Network-first for HTML, don't hijack Next.js chunks, cache-first for other files
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';
  if (req.method !== 'GET') return;

  // Let the browser handle Next's hashed assets completely (safer, no staleness)
  if (url.pathname.startsWith('/_next/')) return;

  // HTML/doc requests: network-first, fallback to cache if offline
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

  // Static assets: cache-first, then update in background
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchAndUpdate = fetch(req).then(async (res) => {
      try {
        const copy = res.clone();
        const cache = await caches.open(CACHE);
        cache.put(req, copy);
      } catch {}
      return res;
    }).catch(() => cached);
    return cached || fetchAndUpdate;
  })());
});
