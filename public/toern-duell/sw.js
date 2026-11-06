// sw.js — Service Worker des Törn-Manöver-Duells (REQ-DUEL-005).
// Eigener Scope (/toern-duell/): berührt den Root-SW der Navigation nicht.
// Strategie: Precache ALLER App-Dateien beim Install (atomar – schlägt ein Download
// fehl, bleibt der alte Stand aktiv), danach Cache-First. Daten liegen im
// localStorage der Seite und werden vom SW nie angefasst.
// Liste + Version erzeugt `npm run duell:sw` (Drift-Test sichert das ab).
const VERSION = "duell-b9e9166474"; // SYNC:VERSION
const CACHE = `jtc-${VERSION}`;
const PRECACHE = [
  // SYNC:START
  "app.js",
  "cards.json",
  "csv.js",
  "dom.js",
  "entwurf.js",
  "files.js",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512-maskable.png",
  "icons/icon-512.png",
  "idb.js",
  "img/k01_s1.png",
  "img/k01_s2.png",
  "img/k01_s3.png",
  "img/k01_s4.png",
  "img/k01_s5.png",
  "img/k01_s6.png",
  "img/k02_s1.png",
  "img/k02_s2.png",
  "img/k02_s3.png",
  "img/k02_s4.png",
  "img/k02_s5.png",
  "img/k02_s6.png",
  "img/k03_s1.png",
  "img/k03_s2.png",
  "img/k03_s3.png",
  "img/k03_s4.png",
  "img/k03_s5.png",
  "img/k03_s6.png",
  "img/k04_s1.png",
  "img/k04_s2.png",
  "img/k04_s3.png",
  "img/k04_s4.png",
  "img/k04_s5.png",
  "img/k04_s6.png",
  "img/k05_s1.png",
  "img/k05_s2.png",
  "img/k05_s3.png",
  "img/k05_s4.png",
  "img/k05_s5.png",
  "img/k05_s6.png",
  "img/k06_s1.png",
  "img/k06_s2.png",
  "img/k06_s3.png",
  "img/k06_s4.png",
  "img/k06_s5.png",
  "img/k06_s6.png",
  "img/k07_s1.png",
  "img/k07_s2.png",
  "img/k07_s3.png",
  "img/k07_s4.png",
  "img/k07_s5.png",
  "img/k07_s6.png",
  "img/k08_s1.png",
  "img/k08_s2.png",
  "img/k08_s3.png",
  "img/k08_s4.png",
  "img/k08_s5.png",
  "img/k08_s6.png",
  "img/k09_s1.png",
  "img/k09_s2.png",
  "img/k09_s3.png",
  "img/k09_s4.png",
  "img/k09_s5.png",
  "img/k09_s6.png",
  "img/k10_s1.png",
  "img/k10_s2.png",
  "img/k10_s3.png",
  "img/k10_s4.png",
  "img/k10_s5.png",
  "img/k10_s6.png",
  "img/k11_s1.png",
  "img/k11_s2.png",
  "img/k11_s3.png",
  "img/k11_s4.png",
  "img/k11_s5.png",
  "img/k11_s6.png",
  "img/k12_s1.png",
  "img/k12_s2.png",
  "img/k12_s3.png",
  "img/k12_s4.png",
  "img/k12_s5.png",
  "img/k12_s6.png",
  "img/k13_s1.png",
  "img/k13_s2.png",
  "img/k13_s3.png",
  "img/k13_s4.png",
  "img/k13_s5.png",
  "img/k13_s6.png",
  "img/k14_p1.png",
  "img/k14_p2.png",
  "img/k15_p1.png",
  "img/k15_p2.png",
  "index.html",
  "karten.js",
  "manifest.webmanifest",
  "persistenz.js",
  "router.js",
  "scoring.js",
  "state.js",
  "store.js",
  "style.css",
  "ueberblick.js",
  "views/bewertung.js",
  "views/karte.js",
  "views/karten.js",
  "views/landgang.js",
  "views/rangliste.js",
  "views/start.js",
  "views/ueberblick.js",
  "views/zoom.js",
  // SYNC:END
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("jtc-duell-") && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL("./", self.location).pathname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const treffer = await cache.match(req, { ignoreSearch: true });
      if (treffer) return treffer;
      try {
        return await fetch(req);
      } catch (e) {
        if (req.mode === "navigate") {
          const shell = await cache.match("./index.html");
          if (shell) return shell;
        }
        throw e;
      }
    })(),
  );
});
