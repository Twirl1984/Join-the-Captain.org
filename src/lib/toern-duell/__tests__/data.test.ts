// Unit-Tests: Kartendaten, Manifest, Service-Worker-Drift, Flag.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { appDateien, sollSw, APP_DIR } from "../../../../scripts/duell-precache";
import { duellEnabled } from "../../flags";

const lies = (f: string) => fs.readFileSync(path.join(APP_DIR, f), "utf8");
const karten = JSON.parse(lies("cards.json"));

test("[REQ-DUEL-005] cards.json: 15 Karten, 6 Schritte, Pflichtfelder, IDs 1–15 lückenlos", () => {
  assert.equal(karten.length, 15);
  karten.forEach((k: Record<string, unknown>, i: number) => {
    assert.equal(k.id, i + 1);
    for (const f of ["title", "tag", "intro", "error"]) assert.equal(typeof k[f], "string");
    assert.equal((k.steps as string[]).length, 6);
    assert.ok((k.steps as string[]).every((s) => s.trim()));
  });
});

test("[REQ-DUEL-005] Bilder: Karten 1–13 je 6 Einzelbilder, 14/15 je 2 große; alle Dateien existieren", () => {
  for (const k of karten) {
    const erwartet = k.id >= 14 ? 2 : 6;
    assert.equal(k.images.length, erwartet, `Karte ${k.id}`);
    assert.equal(k.stepCaptions.length, erwartet, `Karte ${k.id} Captions`);
    for (const img of k.images) assert.ok(fs.existsSync(path.join(APP_DIR, img)), `${img} fehlt`);
  }
  assert.deepEqual(karten[13].images, ["img/k14_p1.png", "img/k14_p2.png"]);
  assert.deepEqual(karten[14].images, ["img/k15_p1.png", "img/k15_p2.png"]);
});

test("[REQ-DUEL-005] Manifest: relative Pfade, standalone, Icons existieren", () => {
  const m = JSON.parse(lies("manifest.webmanifest"));
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "./index.html");
  assert.equal(m.scope, "./");
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(APP_DIR, i.src)), i.src);
  assert.ok(m.icons.some((i: { sizes: string }) => i.sizes === "512x512"));
});

test("[REQ-DUEL-005] Service Worker: Precache-Liste und Version passen zum Dateistand (Drift)", () => {
  const sw = lies("sw.js");
  assert.equal(sw, sollSw(sw), "sw.js veraltet → `npm run duell:sw` ausführen");
});

test("[REQ-DUEL-005] Precache enthält Shell, alle Module, Karten, Bilder, Manifest; nicht sw.js/Doku", () => {
  const d = appDateien();
  for (const f of ["index.html", "app.js", "style.css", "scoring.js", "store.js", "cards.json", "manifest.webmanifest", "views/rangliste.js", "img/k14_p1.png"]) {
    assert.ok(d.includes(f), `${f} fehlt im Precache`);
  }
  assert.ok(!d.includes("sw.js") && !d.some((f) => f.endsWith(".md")));
  assert.ok(d.every((f) => !f.startsWith("/") && !f.includes("..")));
});

test("[REQ-DUEL-005] Alle Pfade in HTML/JS sind relativ (Unterpfad-Deploy)", () => {
  const html = lies("index.html");
  assert.doesNotMatch(html, /(?:src|href)="\//);
  for (const f of appDateien().filter((x) => x.endsWith(".js"))) {
    assert.doesNotMatch(lies(f), /from\s+["']\/|fetch\(\s*["']\//, `${f} nutzt absolute Pfade`);
  }
});

test("[REQ-DUEL-005] Keine externen Ressourcen/CDNs/Tracking, keine Jahreszahl im UI", () => {
  for (const f of appDateien().filter((x) => /\.(js|html|css)$/.test(x))) {
    assert.doesNotMatch(lies(f), /https?:\/\/(?!www\.w3\.org)/, `${f} enthält externe URL`);
  }
  assert.doesNotMatch(lies("index.html"), /\b20\d{2}\b/);
});

test("[REQ-DUEL-005] App ohne Bilder bleibt unter 100 KB", () => {
  const bytes = appDateien().filter((f) => !f.startsWith("img/") && !f.startsWith("icons/"))
    .reduce((s, f) => s + fs.statSync(path.join(APP_DIR, f)).size, 0);
  assert.ok(bytes < 100 * 1024, `${bytes} Bytes`);
});

test("[REQ-DUEL-005] Flag NEXT_PUBLIC_FEATURE_DUELL: Default an, off/false/0 aus", () => {
  const alt = process.env.NEXT_PUBLIC_FEATURE_DUELL;
  try {
    delete process.env.NEXT_PUBLIC_FEATURE_DUELL;
    assert.equal(duellEnabled(), true);
    for (const v of ["off", "false", "0", "OFF"]) { process.env.NEXT_PUBLIC_FEATURE_DUELL = v; assert.equal(duellEnabled(), false, v); }
    process.env.NEXT_PUBLIC_FEATURE_DUELL = "on";
    assert.equal(duellEnabled(), true);
  } finally {
    if (alt === undefined) delete process.env.NEXT_PUBLIC_FEATURE_DUELL; else process.env.NEXT_PUBLIC_FEATURE_DUELL = alt;
  }
});
