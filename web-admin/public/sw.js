// Service worker del Kiosco: cachea la app para que abra sin internet.
// No toca las llamadas a Supabase (otro dominio): esas se manejan con la cola offline.
const CACHE = "kiosco-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // deja pasar Supabase/APIs

  // Navegación (abrir una página): red primero, si falla usa el caché.
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, net.clone());
          return net;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(req)) ||
            (await cache.match("/dashboard")) ||
            (await cache.match("/")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Recursos (JS/CSS/imágenes): caché primero, y actualiza en segundo plano.
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const net = fetch(req)
        .then((r) => {
          if (r && r.status === 200) cache.put(req, r.clone());
          return r;
        })
        .catch(() => null);
      return cached || (await net) || Response.error();
    })(),
  );
});
