/**
 * Service worker — offline hraní a instalace na plochu (PWA).
 * Strategie: network-first pro navigaci (čerstvý index po deployi),
 * cache-first pro statická aktiva (hashované soubory Vite, obrázky, audio).
 * Hra nemá serverové závislosti — po prvním načtení běží celá offline.
 */
const CACHE = 'wob-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // úklid starých verzí cache
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return

  if (req.mode === 'navigate') {
    // navigace: network-first, offline fallback z cache
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const cache = await caches.open(CACHE)
        cache.put(req, fresh.clone())
        return fresh
      } catch {
        return (await caches.match(req)) ?? Response.error()
      }
    })())
    return
  }

  // statika: cache-first s doplňováním cache ze sítě
  e.respondWith((async () => {
    const hit = await caches.match(req)
    if (hit) return hit
    const res = await fetch(req)
    if (res.ok) {
      const cache = await caches.open(CACHE)
      cache.put(req, res.clone())
    }
    return res
  })())
})
