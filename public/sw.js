// Service Worker — Offline-Grundfähigkeit & TWA-Basis (REQ-NAV-014).
//
// Strategie (bewusst konservativ für ein Sicherheits-Tool):
//   - Seiten (navigate):      network-first → Fallback: zuletzt gecachte Seite.
//   - Statische Assets:       cache-first (Next-Assets sind inhalts-gehasht).
//   - Karten-Kacheln (OSM/OpenSeaMap/EMODnet): stale-while-revalidate mit
//     Deckel — die zuletzt angesehene Route bleibt offline sichtbar.
//   - API-Antworten:          NIE gecacht. Offline gibt es keine "aktuellen"
//     Wetter-/Tiefen-Daten — alte Prognosen als frisch anzuzeigen wäre
//     gefährlich (REQ-SAFE-002-Geist).
//
// Update-Verhalten: Version bumpen → alte Caches werden beim Activate geräumt;
// skipWaiting + clients.claim für zügige Rollouts.
const VERSION = "jtc-sw-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const TILES = `${VERSION}-tiles`;
const TILE_LIMIT = 400; // ~ eine Revier-Session; FIFO-Trim

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS, TILES]);
      for (const key of await caches.keys()) {
        if (key.startsWith("jtc-sw-") && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

const isTile = (url) =>
  /tile\.openstreetmap\.org|tiles\.openseamap\.org|emodnet/.test(url.host + url.pathname);
const isStaticAsset = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/assets/"));
const isApi = (url) => url.origin === self.location.origin && url.pathname.startsWith("/api/");

async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isApi(url)) return; // APIs: immer Netz, nie Cache

  // Seiten: network-first, offline die zuletzt gesehene Version.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req, { cacheName: SHELL });
          return (
            cached ??
            new Response(
              "<h1>Offline</h1><p>Diese Seite wurde noch nicht geladen. Bitte einmal online öffnen.</p>",
              { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
            )
          );
        }
      })(),
    );
    return;
  }

  // Gehashte Assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req, { cacheName: ASSETS });
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh.ok) (await caches.open(ASSETS)).put(req, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Karten-Kacheln: stale-while-revalidate mit Deckel.
  if (isTile(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TILES);
        const cached = await cache.match(req);
        const refresh = fetch(req)
          .then((fresh) => {
            if (fresh.ok) {
              cache.put(req, fresh.clone());
              void trimCache(TILES, TILE_LIMIT);
            }
            return fresh;
          })
          .catch(() => null);
        return cached ?? (await refresh) ?? Response.error();
      })(),
    );
  }
});
