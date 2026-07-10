// Unit-Tests für den Tiefen-Adapter (depth.ts) — TDD: zuerst geschrieben.
// Lauf: node --import tsx --test src/lib/navigation/__tests__/depth.test.ts
//
// Quelle 1: EMODnet Bathymetry REST (Europa, ~115 m, CC-BY 4.0).
// Fallback:  GEBCO via OpenTopoData (global, grob).
// fetch wird injiziert -> Tests laufen komplett offline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchDepth, fetchRouteDepths, flachwasserCheck } from "../depth";

type FetchLike = (url: string) => Promise<Response>;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("[REQ-NAV-003] fetchDepth: EMODnet liefert avg<0 -> positive Tiefe in Metern", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    return jsonResponse({ avg: -17.4, min: -19, max: -15 });
  };
  const d = await fetchDepth(54.5, 13.2, { fetchImpl });
  assert.equal(d.source, "emodnet");
  assert.equal(d.depth_m, 17.4);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("emodnet"), `EMODnet-URL erwartet, war: ${calls[0]}`);
  // WKT ist POINT(lon lat) — Verwechslung wäre ein klassischer Karten-Bug.
  assert.ok(calls[0].includes(encodeURIComponent("POINT(13.2 54.5)")), calls[0]);
});

test("[REQ-NAV-003] fetchDepth: EMODnet avg>=0 (Land) -> depth_m null, kein Fallback nötig", async () => {
  const d = await fetchDepth(52, 10, {
    fetchImpl: async () => jsonResponse({ avg: 42.0 }),
  });
  assert.equal(d.depth_m, null);
  assert.equal(d.source, "emodnet");
});

test("[REQ-NAV-003] fetchDepth: EMODnet down -> GEBCO-Fallback (elevation<0 -> Tiefe)", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    if (url.includes("emodnet")) return jsonResponse({ error: "kaputt" }, 503);
    return jsonResponse({ results: [{ elevation: -230.7 }] });
  };
  const d = await fetchDepth(39.5, 2.6, { fetchImpl });
  assert.equal(d.source, "gebco");
  assert.equal(d.depth_m, 230.7);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes("39.5,2.6"), `GEBCO erwartet lat,lon: ${calls[1]}`);
});

test("[REQ-NAV-003] fetchDepth: beide Quellen down -> Fehler (kein stilles null)", async () => {
  await assert.rejects(
    fetchDepth(39.5, 2.6, { fetchImpl: async () => jsonResponse({}, 500) }),
    /Tiefendaten/,
  );
});

test("[REQ-NAV-003] fetchDepth: validiert Koordinaten", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ avg: -5 });
  await assert.rejects(fetchDepth(91, 0, { fetchImpl }), /Koordinaten/);
  await assert.rejects(fetchDepth(0, 181, { fetchImpl }), /Koordinaten/);
  await assert.rejects(fetchDepth(Number.NaN, 0, { fetchImpl }), /Koordinaten/);
});

test("[REQ-NAV-003] fetchRouteDepths: eine Abfrage je Punkt, Reihenfolge bleibt erhalten", async () => {
  const fetchImpl: FetchLike = async (url) => {
    // Tiefe aus der lat kodieren, damit die Zuordnung prüfbar ist.
    const m = decodeURIComponent(url).match(/POINT\([\d.]+ ([\d.]+)\)/);
    const lat = m ? Number(m[1]) : 0;
    return jsonResponse({ avg: -lat });
  };
  const ds = await fetchRouteDepths(
    [
      { lat: 10, lon: 1 },
      { lat: 20, lon: 2 },
      { lat: 30, lon: 3 },
    ],
    { fetchImpl },
  );
  assert.deepEqual(
    ds.map((d) => d.depth_m),
    [10, 20, 30],
  );
});

test("[REQ-NAV-003] flachwasserCheck: gefahr / knapp / ok / unbekannt", () => {
  // Tiefgang 1.8 m, Sicherheitsmarge default 0.5 m.
  assert.equal(flachwasserCheck(1.7, 1.8), "gefahr"); // flacher als Tiefgang
  assert.equal(flachwasserCheck(1.8, 1.8), "gefahr"); // exakt = aufsetzen
  assert.equal(flachwasserCheck(2.1, 1.8), "knapp"); // unter Tiefgang+Marge
  assert.equal(flachwasserCheck(2.31, 1.8), "ok");
  assert.equal(flachwasserCheck(null, 1.8), "unbekannt");
  // Eigene Marge:
  assert.equal(flachwasserCheck(2.7, 1.8, 1.0), "knapp");
  assert.equal(flachwasserCheck(2.9, 1.8, 1.0), "ok");
});

test("[REQ-NAV-012] Tide-Verrechnung: Niedrigwasser kippt den Flachwasser-Status", () => {
  // Karte 2.6 m, Niedrigstwasser −0.9 m → effektiv 1.7 m bei 1.8 m Tiefgang = GEFAHR.
  assert.equal(flachwasserCheck(2.6 + -0.9, 1.8), "gefahr");
  // Ohne Tide wäre es ok (2.6 > 1.8 + 0.5).
  assert.equal(flachwasserCheck(2.6, 1.8), "ok");
  // Hochwasser (+0.8) entspannt eine knappe Stelle.
  assert.equal(flachwasserCheck(2.2 + 0.8, 1.8), "ok");
});
