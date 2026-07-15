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
