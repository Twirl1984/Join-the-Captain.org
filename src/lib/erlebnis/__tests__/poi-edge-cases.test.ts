// Aggressive Edge-Case-Tests für POI-Filterlogik — QA Runde 2
// Lauf: node --import tsx --test src/lib/erlebnis/__tests__/poi-edge-cases.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { poiImKorridor, bboxUmRoute, poiInBbox, poiIstGueltig } from "../poi";

test("[QA-R2] poiImKorridor: korridorNm EXAKT Null gibt false", () => {
  const route = [{ lat: 54.68, lon: 13.4 }];
  const poi = { lat: 54.68, lon: 13.4 }; // Exakt auf Punkt
  assert.equal(poiImKorridor(poi, route, 0), false, "korridorNm=0 sollte IMMER false sein");
});

test("[QA-R2] poiImKorridor: korridorNm -0.0001 (JavaScript Floating-Point)", () => {
  const route = [{ lat: 54.68, lon: 13.4 }];
  const poi = { lat: 54.68, lon: 13.4 };
  assert.equal(poiImKorridor(poi, route, -0.0001), false, "Negativ sollte false sein");
});

test("[QA-R2] poiImKorridor: korridorNm sehr klein aber positiv (1e-10)", () => {
  const route = [{ lat: 54.68, lon: 13.4 }];
  const poi = { lat: 54.68, lon: 13.4 }; // Exakt auf Punkt
  const result = poiImKorridor(poi, route, 1e-10);
  assert.equal(result, true, "1e-10 sm sollte Punkt auf Punkt treffen (haversine <= 1e-10)");
});

test("[QA-R2] bboxUmRoute: leere Route sollte NICHT NaN haben", () => {
  const bbox = bboxUmRoute([], 5);
  // Der aktuelle Code macht Math.min/max auf leeres Array → -Infinity / Infinity
  console.log("bboxUmRoute([],5):", bbox);
  assert.equal(Number.isFinite(bbox.minLat), false, "minLat sollte -Infinity sein");
  assert.equal(Number.isFinite(bbox.maxLat), false, "maxLat sollte Infinity sein");
});

test("[QA-R2] bboxUmRoute: Route mit 1 Punkt + sehr großem Korridor", () => {
  const route = [{ lat: 54.68, lon: 13.4 }];
  const bbox = bboxUmRoute(route, 999); // 999 sm = ~16.65°
  console.log("bboxUmRoute mit 999sm:", bbox);
  assert.ok(bbox.minLat < 54.68, "minLat sollte < Punkt sein");
  assert.ok(bbox.maxLat > 54.68, "maxLat sollte > Punkt sein");
});

test("[QA-R2] bboxUmRoute: Antimeridian-Grenzfall (lon nahe 180/-180)", () => {
  const route = [{ lat: 54.68, lon: 179.9 }];
  const bbox = bboxUmRoute(route, 10);
  // Grenzfall-Logik: lon kann über 180 gehen, was zu Wrap-around führt
  console.log("bboxUmRoute nahe Antimeridian:", bbox);
  assert.ok(Number.isFinite(bbox.maxLon), "maxLon sollte endlich sein");
});

test("[QA-R2] poiInBbox: POI AUSSEN (knapp außerhalb)", () => {
  const bbox = { minLat: 54.0, maxLat: 55.0, minLon: 13.0, maxLon: 14.0 };
  // Knapp außerhalb
  assert.equal(poiInBbox({ lat: 54.0 - 0.00001, lon: 13.5 }, bbox), false);
  assert.equal(poiInBbox({ lat: 55.0 + 0.00001, lon: 13.5 }, bbox), false);
  assert.equal(poiInBbox({ lat: 54.5, lon: 13.0 - 0.00001 }, bbox), false);
  assert.equal(poiInBbox({ lat: 54.5, lon: 14.0 + 0.00001 }, bbox), false);
});

test("[QA-R2] poiInBbox: NaN/Infinity in POI-Koordinaten", () => {
  const bbox = { minLat: 54.0, maxLat: 55.0, minLon: 13.0, maxLon: 14.0 };
  // NaN ist niemals >= oder <=, daher sollte false sein
  assert.equal(poiInBbox({ lat: NaN, lon: 13.5 }, bbox), false);
  assert.equal(poiInBbox({ lat: 54.5, lon: NaN }, bbox), false);
  assert.equal(poiInBbox({ lat: Infinity, lon: 13.5 }, bbox), false);
});

test("[QA-R2] poiIstGueltig: Saisongrenze exakt (saison_von=5, monat=5)", () => {
  const poi = { saison_von: 5, saison_bis: 9, gueltig_von: null, gueltig_bis: null };
  assert.equal(poiIstGueltig(poi, { monat: 5 }), true, "Grenze inklusive");
});

test("[QA-R2] poiIstGueltig: Saisongrenze exakt am oberen Ende (saison_bis=9, monat=9)", () => {
  const poi = { saison_von: 5, saison_bis: 9, gueltig_von: null, gueltig_bis: null };
  assert.equal(poiIstGueltig(poi, { monat: 9 }), true, "Obere Grenze inklusive");
});

test("[QA-R2] poiIstGueltig: saison_von null, saison_bis nicht null (Asymmetrie)", () => {
  const poi = { saison_von: null, saison_bis: 9, gueltig_von: null, gueltig_bis: null };
  // Beide null → true, nur eins null → unsicher!
  const result = poiIstGueltig(poi, { monat: 5 });
  // Aktuell: wenn saison_von == null && saison_bis == null → true
  // aber Asymmetrie sollte auch behandelt werden
  console.log("saison_von=null, saison_bis=9, monat=5:", result);
});

test("[QA-R2] poiIstGueltig: monat=0 (ungültig)", () => {
  const poi = { saison_von: 5, saison_bis: 9, gueltig_von: null, gueltig_bis: null };
  // monat 0 ist keine JS-Validierung, aber semantisch falsch
  const result = poiIstGueltig(poi, { monat: 0 });
  console.log("monat=0:", result);
});

test("[QA-R2] poiIstGueltig: monat=13 (außerhalb 1-12)", () => {
  const poi = { saison_von: 5, saison_bis: 9, gueltig_von: null, gueltig_bis: null };
  const result = poiIstGueltig(poi, { monat: 13 });
  console.log("monat=13:", result);
});

test("[QA-R2] poiIstGueltig: gueltig_von > gueltig_bis (logischer Fehler)", () => {
  const poi = { saison_von: null, saison_bis: null, gueltig_von: "2026-08-20", gueltig_bis: "2026-08-10" };
  // Wenn from > to, sollte IMMER false sein
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-15" }), false, "Ungültiges Fenster sollte alles ausschließen");
});

test("[QA-R2] poiIstGueltig: gueltig_von == gueltig_bis (1 Tag Event)", () => {
  const poi = { saison_von: null, saison_bis: null, gueltig_von: "2026-08-15", gueltig_bis: "2026-08-15" };
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-15" }), true, "Exakter Tag sollte treffen");
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-14" }), false, "Tag davor sollte nicht treffen");
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-16" }), false, "Tag danach sollte nicht treffen");
});

test("[QA-R2] poiIstGueltig: Datums-String Vergleiche (Lexikalisch, nicht chronologisch)", () => {
  // Strings vergleichen sich lexikalisch, ISO-Format ist deshalb sicher
  const poi = { saison_von: null, saison_bis: null, gueltig_von: "2026-01-15", gueltig_bis: "2026-12-15" };
  assert.equal(poiIstGueltig(poi, { datum: "2026-06-15" }), true, "Mitte des Jahres sollte treffen");
  assert.equal(poiIstGueltig(poi, { datum: "2025-12-31" }), false, "Vorher sollte nicht treffen");
  assert.equal(poiIstGueltig(poi, { datum: "2027-01-01" }), false, "Nachher sollte nicht treffen");
});
