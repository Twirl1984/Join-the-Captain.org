// Unit-Tests für die reine POI-Filterlogik (REQ-EXP-001).
// Lauf: node --import tsx --test src/lib/erlebnis/__tests__/poi.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { poiIstGueltig, poiInBbox, poiHatPflichtquellen, poiImKorridor, bboxUmRoute } from "../poi";

test("[REQ-EXP-001] POI ohne Saison/Gueltigkeit ist immer gueltig", () => {
  assert.equal(
    poiIstGueltig({ saison_von: null, saison_bis: null, gueltig_von: null, gueltig_bis: null }, { monat: 3 }),
    true,
  );
});

test("[REQ-EXP-001] Saisonfilter schliesst Monate ausserhalb des Bereichs aus", () => {
  const poi = { saison_von: 5, saison_bis: 9, gueltig_von: null, gueltig_bis: null };
  assert.equal(poiIstGueltig(poi, { monat: 7 }), true);
  assert.equal(poiIstGueltig(poi, { monat: 1 }), false);
  assert.equal(poiIstGueltig(poi, { monat: 12 }), false);
});

test("[REQ-EXP-001] Saisonfilter erlaubt Wrap-Around ueber den Jahreswechsel", () => {
  const poi = { saison_von: 11, saison_bis: 2, gueltig_von: null, gueltig_bis: null };
  assert.equal(poiIstGueltig(poi, { monat: 12 }), true);
  assert.equal(poiIstGueltig(poi, { monat: 1 }), true);
  assert.equal(poiIstGueltig(poi, { monat: 6 }), false);
});

test("[REQ-EXP-001] ohne angefragten Monat wird ein Saison-POI nicht ausgeschlossen", () => {
  const poi = { saison_von: 5, saison_bis: 9, gueltig_von: null, gueltig_bis: null };
  assert.equal(poiIstGueltig(poi), true);
});

test("[REQ-EXP-001] Event-Gueltigkeitsfenster (gueltig_von/gueltig_bis) inklusive Grenzen", () => {
  const poi = { saison_von: null, saison_bis: null, gueltig_von: "2026-08-14", gueltig_bis: "2026-08-16" };
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-14" }), true);
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-16" }), true);
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-17" }), false);
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-13" }), false);
});

test("[REQ-EXP-001] ohne angefragtes Stichdatum wird ein Event-POI nicht ausgeschlossen", () => {
  const poi = { saison_von: null, saison_bis: null, gueltig_von: "2026-08-14", gueltig_bis: "2026-08-16" };
  assert.equal(poiIstGueltig(poi), true);
});

test("[REQ-EXP-001] poiInBbox erkennt Treffer und Ausreisser", () => {
  const bbox = { minLat: 54.0, maxLat: 55.0, minLon: 13.0, maxLon: 14.0 };
  assert.equal(poiInBbox({ lat: 54.5, lon: 13.5 }, bbox), true);
  assert.equal(poiInBbox({ lat: 43.0, lon: 16.0 }, bbox), false);
});

test("[REQ-EXP-004] poiImKorridor: Treffer nah an einem Routenpunkt, Ausreisser weit weg", () => {
  // Kap Arkona liegt praktisch auf dem Routenpunkt, Split ist weit entfernt.
  const route = [
    { lat: 54.68, lon: 13.4 },
    { lat: 54.5, lon: 13.6 },
  ];
  assert.equal(poiImKorridor({ lat: 54.679611, lon: 13.432611 }, route, 3), true);
  assert.equal(poiImKorridor({ lat: 43.5, lon: 16.44 }, route, 3), false);
});

test("[REQ-EXP-004] poiImKorridor: leere Route ergibt nie einen Treffer", () => {
  assert.equal(poiImKorridor({ lat: 54.68, lon: 13.4 }, [], 5), false);
});

test("[REQ-EXP-004] bboxUmRoute umschliesst alle Routenpunkte plus Rand", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.5, lon: 13.6 },
  ];
  const bbox = bboxUmRoute(route, 6); // 6 sm ≈ 0.1°
  assert.ok(bbox.minLat < 54.0 && bbox.maxLat > 54.5);
  assert.ok(bbox.minLon < 13.0 && bbox.maxLon > 13.6);
});

test("[REQ-EXP-001] Quellenpflicht: mindestens eine Quelle mit URL und Abrufdatum", () => {
  assert.equal(
    poiHatPflichtquellen({
      quellen_json: [{ url: "https://de.wikipedia.org/wiki/Leuchtturm_Kap_Arkona", titel: "Kap Arkona", abgerufen_am: "2026-07-15" }],
    }),
    true,
  );
  assert.equal(poiHatPflichtquellen({ quellen_json: [] }), false);
  assert.equal(
    poiHatPflichtquellen({ quellen_json: [{ url: "", titel: "x", abgerufen_am: "2026-07-15" }] }),
    false,
  );
});

// --- QA-ADVERSARIAL EDGE CASES ---

test("[QA] bboxUmRoute mit leerer Route gibt kaputte bbox zurück", () => {
  const bbox = bboxUmRoute([], 5);
  assert.equal(Number.isFinite(bbox.minLat), false, "minLat sollte nicht endlich sein bei leerer Route");
  assert.equal(Number.isFinite(bbox.maxLat), false, "maxLat sollte nicht endlich sein bei leerer Route");
});

test("[QA] poiImKorridor mit korridorNm=0 gibt immer false zurück", () => {
  const route = [{ lat: 54.68, lon: 13.4 }];
  const result = poiImKorridor({ lat: 54.68, lon: 13.4 }, route, 0);
  assert.equal(result, false, "Korridor mit Radius 0 sollte nie treffen");
});

test("[QA] poiImKorridor mit negativem korridorNm gibt immer false zurück", () => {
  const route = [{ lat: 54.68, lon: 13.4 }];
  const result = poiImKorridor({ lat: 54.68, lon: 13.4 }, route, -5);
  assert.equal(result, false, "Negativ Korridor sollte nie treffen");
});

test("[QA] Route mit nur 1 Punkt: poiImKorridor arbeitet korrekt", () => {
  const route = [{ lat: 54.68, lon: 13.4 }];
  const poi = { lat: 54.68, lon: 13.4 };
  assert.equal(poiImKorridor(poi, route, 5), true, "POI exakt auf Punkt sollte treffen");
});

test("[QA] Route mit identischen Punkten: poiImKorridor dupliziert nicht", () => {
  const route = [
    { lat: 54.68, lon: 13.4 },
    { lat: 54.68, lon: 13.4 },
    { lat: 54.68, lon: 13.4 },
  ];
  const poi = { lat: 54.68, lon: 13.4 };
  assert.equal(poiImKorridor(poi, route, 5), true, "Sollte trotz Duplikaten treffen");
});

test("[QA] POI genau auf Bbox-Grenze wird korrekt erkannt", () => {
  const bbox = { minLat: 54.0, maxLat: 55.0, minLon: 13.0, maxLon: 14.0 };
  assert.equal(poiInBbox({ lat: 54.0, lon: 13.0 }, bbox), true, "Ecke minLat/minLon");
  assert.equal(poiInBbox({ lat: 55.0, lon: 14.0 }, bbox), true, "Ecke maxLat/maxLon");
  assert.equal(poiInBbox({ lat: 54.5, lon: 13.0 }, bbox), true, "Kante minLon");
  assert.equal(poiInBbox({ lat: 54.5, lon: 14.0 }, bbox), true, "Kante maxLon");
  assert.equal(poiInBbox({ lat: 54.0, lon: 13.5 }, bbox), true, "Kante minLat");
  assert.equal(poiInBbox({ lat: 55.0, lon: 13.5 }, bbox), true, "Kante maxLat");
});

test("[QA] poiHatPflichtquellen mit null-Werten in Array", () => {
  // Simuliert: wenn quellen_json unerwartete Strukturen hat
  assert.equal(
    poiHatPflichtquellen({
      quellen_json: [{ url: null, abgerufen_am: "2026-07-15", titel: "" }] as unknown as Array<{ url: string; abgerufen_am: string; titel: string }>,
    }),
    false,
    "null als url sollte abgelehnt werden",
  );
  assert.equal(
    poiHatPflichtquellen({
      quellen_json: [{ url: "https://example.com", abgerufen_am: null, titel: "" }] as unknown as Array<{ url: string; abgerufen_am: string; titel: string }>,
    }),
    false,
    "null als abgerufen_am sollte abgelehnt werden",
  );
});

test("[QA] poiHatPflichtquellen mit undefined-Werten", () => {
  assert.equal(
    poiHatPflichtquellen({ quellen_json: undefined as unknown as Array<{ url: string; abgerufen_am: string; titel: string }> }),
    false,
    "undefined statt Array sollte false sein",
  );
});

test("[QA] poiIstGueltig mit Antimeridian-Koordinaten (lon > 180)", () => {
  // Das ist kein direkter Test von poi.ts, aber Edge Case
  const poi = { saison_von: 5, saison_bis: 9, gueltig_von: null, gueltig_bis: null };
  assert.equal(poiIstGueltig(poi, { monat: 7 }), true, "Saison 5-9 sollte Monat 7 treffen");
});

test("[QA] Saisonfilter mit Grenzfälle monat=1 und monat=12", () => {
  const poi = { saison_von: 11, saison_bis: 2, gueltig_von: null, gueltig_bis: null };
  assert.equal(poiIstGueltig(poi, { monat: 1 }), true, "Wrap-around 11-2, monat=1 sollte treffen");
  assert.equal(poiIstGueltig(poi, { monat: 11 }), true, "Wrap-around 11-2, monat=11 sollte treffen");
  assert.equal(poiIstGueltig(poi, { monat: 2 }), true, "Wrap-around 11-2, monat=2 sollte treffen");
  assert.equal(poiIstGueltig(poi, { monat: 3 }), false, "Wrap-around 11-2, monat=3 sollte nicht treffen");
});

test("[QA] Gültigkeit: nur gueltig_von ohne gueltig_bis", () => {
  const poi = { saison_von: null, saison_bis: null, gueltig_von: "2026-08-14", gueltig_bis: null };
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-13" }), false, "Vor gueltig_von sollte falsch sein");
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-14" }), true, "Ab gueltig_von sollte wahr sein");
  assert.equal(poiIstGueltig(poi, { datum: "2026-12-31" }), true, "Weit nach gueltig_von sollte wahr sein");
});

test("[QA] Gültigkeit: nur gueltig_bis ohne gueltig_von", () => {
  const poi = { saison_von: null, saison_bis: null, gueltig_von: null, gueltig_bis: "2026-08-16" };
  assert.equal(poiIstGueltig(poi, { datum: "2026-01-01" }), true, "Weit vor gueltig_bis sollte wahr sein");
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-16" }), true, "Bis gueltig_bis sollte wahr sein");
  assert.equal(poiIstGueltig(poi, { datum: "2026-08-17" }), false, "Nach gueltig_bis sollte falsch sein");
});

// --- BUG-057, BUG-058: bboxUmRoute Regressionstests ---

test("[BUG-057] bboxUmRoute mit negativem korridorNm validiert korridorNm > 0", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.5, lon: 13.5 },
  ];
  assert.throws(() => bboxUmRoute(route, -9999), "Negatives korridorNm sollte einen Fehler werfen");
  assert.throws(() => bboxUmRoute(route, -1), "Negatives korridorNm=-1 sollte einen Fehler werfen");
  assert.throws(() => bboxUmRoute(route, 0), "korridorNm=0 sollte einen Fehler werfen (kein Sinn)");
});

test("[BUG-058] bboxUmRoute mit NaN-Koordinaten gibt einen Fehler statt inverted bbox", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: NaN, lon: NaN },
  ];
  assert.throws(() => bboxUmRoute(route, 5), "Route mit NaN-Koordinaten sollte einen Fehler werfen");
});

test("[BUG-058] bboxUmRoute mit nur NaN-Route gibt einen Fehler", () => {
  const route = [
    { lat: NaN, lon: NaN },
  ];
  assert.throws(() => bboxUmRoute(route, 5), "Route mit nur NaN sollte einen Fehler werfen");
});
