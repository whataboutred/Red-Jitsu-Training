const CACHE_NAME='ironlog-v1';const OFFLINE_URLS=['/','/dashboard'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE_NAME);await c.addAll(OFFLINE_URLS);self.skipWaiting()})())});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  if(r.url.includes('/api/')){
    e.respondWith((async()=>{try{const n=await fetch(r);const c=await caches.open(CACHE_NAME);c.put(r,n.clone());return n}catch{const cached=await caches.match(r);return cached||new Response(JSON.stringify({offline:true}),{headers:{'Content-Type':'application/json'}})}})()); return;
  }
  e.respondWith((async()=>{const c=await caches.match(r); if(c) return c; try{const n=await fetch(r); const cache=await caches.open(CACHE_NAME); cache.put(r,n.clone()); return n;}catch(err){ if(r.mode==='navigate'){const root=await caches.match('/'); return root||Response.error()} return Response.error() }})())
})
