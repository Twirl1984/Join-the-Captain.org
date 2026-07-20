// [QA-ROUND-6] Aggressive POI/Korridor-Tests: Grenzfälle, Injektionen, DoS
// Fokus auf noch offene Findings aus Runde 5

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { poiImKorridor, bboxUmRoute, poiInBbox, poiIstGueltig } from "../poi";

// ============================================================================
// Korridor-Filter: Grenzfälle mit sehr großen Werten
// ============================================================================

test("[QA-R6] bboxUmRoute: korridorNm = -9999 wirft Fehler [BUG-057 FIXED]", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.5, lon: 13.5 },
  ];

  // BUG-057: Negatives korridorNm sollte einen Fehler werfen
  assert.throws(() => bboxUmRoute(route, -9999), "Negatives korridorNm sollte Fehler werfen");
});

test("[QA-R6] bboxUmRoute: korridorNm = 0 wirft Fehler [BUG-057 FIXED]", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.5, lon: 13.5 },
  ];

  // BUG-057: korridorNm=0 hat keinen Sinn und sollte Fehler werfen
  assert.throws(() => bboxUmRoute(route, 0), "korridorNm=0 sollte Fehler werfen");
});

test("[QA-R6] bboxUmRoute: route mit NaN-Koordinaten wirft Fehler [BUG-058 FIXED]", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: NaN, lon: NaN },
    { lat: 54.5, lon: 13.5 },
  ];

  // BUG-058: Route mit NaN sollte einen Fehler werfen
  assert.throws(() => bboxUmRoute(route, 1), "Route mit NaN sollte Fehler werfen");
});

test("[QA-R6] bboxUmRoute: route mit Infinity-Koordinaten wirft Fehler [BUG-058 FIXED]", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: Infinity, lon: Infinity },
  ];

  // BUG-058: Route mit Infinity sollte einen Fehler werfen
  assert.throws(() => bboxUmRoute(route, 1), "Route mit Infinity sollte Fehler werfen");
});

// ============================================================================
// poiImKorridor: Grenzfälle mit korridorNm
// ============================================================================

test("[QA-R6] poiImKorridor: korridorNm = 0 (sollte immer false sein)", () => {
  const route = [{ lat: 54.0, lon: 13.0 }];
  const poi = { lat: 54.0, lon: 13.0 }; // Direkt auf dem Punkt

  const result = poiImKorridor(poi, route, 0);

  console.log(`[QA-R6] korridorNm=0, POI auf Punkt: ${result}`);

  if (result === true) {
    console.log("[QA-R6-FINDING] korridorNm=0 sollte immer false sein, aber gab true!");
  }

  assert.equal(result, false);
});

test("[QA-R6] poiImKorridor: korridorNm = -0.5 (negativ)", () => {
  const route = [{ lat: 54.0, lon: 13.0 }];
  const poi = { lat: 54.0, lon: 13.0 };

  const result = poiImKorridor(poi, route, -0.5);

  console.log(`[QA-R6] korridorNm=-0.5: ${result}`);

  // Negativ ist ungültig, sollte false sein
  assert.equal(result, false);
});

test("[QA-R6] poiImKorridor: route=[], poi ohne Route", () => {
  const poi = { lat: 54.0, lon: 13.0 };

  const result = poiImKorridor(poi, [], 1);

  console.log(`[QA-R6] Leere Route: ${result}`);
  assert.equal(result, false);
});

// ============================================================================
// Saison/Gültigkeit: Asymmetrische Felder (BUG-QA-003, BUG-QA-004)
// ============================================================================

test("[QA-R6] poiIstGueltig: saison_von=5, saison_bis=null (asymmetrisch)", () => {
  const poi = {
    saison_von: 5,
    saison_bis: null,
    gueltig_von: null,
    gueltig_bis: null,
  };

  const result = poiIstGueltig(poi, { monat: 7 });

  console.log(`[QA-R6] Asymmetrisch (von=5, bis=null): ${result}`);

  // Asymmetrisch sollte false sein (BUG-QA-003)
  if (result === true) {
    console.log("[QA-R6-FINDING] Asymmetrische saison wird akzeptiert!");
  }

  assert.equal(result, false, "Asymmetrische saison sollte false sein");
});

test("[QA-R6] poiIstGueltig: saison_von=null, saison_bis=9 (asymmetrisch)", () => {
  const poi = {
    saison_von: null,
    saison_bis: 9,
    gueltig_von: null,
    gueltig_bis: null,
  };

  const result = poiIstGueltig(poi, { monat: 7 });

  console.log(`[QA-R6] Asymmetrisch (von=null, bis=9): ${result}`);

  if (result === true) {
    console.log("[QA-R6-FINDING] Asymmetrische saison wird akzeptiert!");
  }

  assert.equal(result, false);
});

// ============================================================================
// Gültigkeit: Semantisch ungültige Datumsbereiche
// ============================================================================

test("[QA-R6] poiIstGueltig: gueltig_von > gueltig_bis", () => {
  const poi = {
    saison_von: null,
    saison_bis: null,
    gueltig_von: "2026-12-31",
    gueltig_bis: "2026-01-01", // Vorher!
  };

  const result = poiIstGueltig(poi, { datum: "2026-06-15" });

  console.log(`[QA-R6] gueltig_von > gueltig_bis: monat 6 → ${result}`);

  // Das ist semantisch falsch, aber die Funktion prüft:
  // if (poi.gueltig_von && d < poi.gueltig_von) return false; // 2026-06-15 < 2026-12-31 → false!
  // Das ist korrekt (das Datum ist vor von, also nicht gültig)

  // Der Bereich ist "rückwärts", aber die Funktion gibt eine logisch konsistente Antwort
  assert.equal(result, false, "Datum vor gueltig_von sollte false sein");
});

test("[QA-R6] poiIstGueltig: gueltig_von = gueltig_bis (Single-Day Event)", () => {
  const poi = {
    saison_von: null,
    saison_bis: null,
    gueltig_von: "2026-06-15",
    gueltig_bis: "2026-06-15",
  };

  // Auf den Tag selbst sollte true sein
  let result = poiIstGueltig(poi, { datum: "2026-06-15" });
  console.log(`[QA-R6] Single-Day: Selbstag → ${result}`);
  assert.equal(result, true);

  // Davor sollte false sein
  result = poiIstGueltig(poi, { datum: "2026-06-14" });
  console.log(`[QA-R6] Single-Day: Tag davor → ${result}`);
  assert.equal(result, false);

  // Danach sollte false sein
  result = poiIstGueltig(poi, { datum: "2026-06-16" });
  console.log(`[QA-R6] Single-Day: Tag danach → ${result}`);
  assert.equal(result, false);
});

// ============================================================================
// Bbox-Filter: Edge Cases
// ============================================================================

test("[QA-R6] poiInBbox: bbox mit minLat > maxLat (inverted)", () => {
  const bbox = { minLat: 90, maxLat: 0, minLon: -180, maxLon: 180 };
  const poi = { lat: 45, lon: 0 };

  const result = poiInBbox(poi, bbox);

  console.log(`[QA-R6] Inverted bbox: ${result}`);

  // POI kann nicht in inverted bbox sein
  assert.equal(result, false);
});

test("[QA-R6] poiInBbox: bbox mit minLon > maxLon (Antimeridian edge case)", () => {
  const bbox = { minLat: -90, maxLat: 90, minLon: 170, maxLon: -170 }; // Über Antimeridian
  const poi = { lat: 0, lon: 180 };

  const result = poiInBbox(poi, bbox);

  console.log(`[QA-R6] Antimeridian bbox (170...-170): POI auf 180 → ${result}`);

  // Das ist eine Antimeridian-Bbox, aber unsere einfache Implementierung:
  // poi.lon >= 170 && poi.lon <= -170 ist FALSCH für Antimeridian
  // 180 >= 170 ist true, aber 180 <= -170 ist false → result = false

  // Das ist ein potentielles Finding wenn Antimeridian-Routen unterstützt werden
  if (result === true) {
    console.log("[QA-R6-FINDING] Antimeridian-Bbox wird richtig gehandhabt");
  } else {
    console.log("[QA-R6-FINDING] Antimeridian-Bbox wird NICHT richtig gehandhabt (minLon > maxLon)");
  }
});

test("[QA-R6] poiInBbox: bbox mit NaN-Koordinaten", () => {
  const bbox = { minLat: NaN, maxLat: 90, minLon: -180, maxLon: 180 };
  const poi = { lat: 45, lon: 0 };

  const result = poiInBbox(poi, bbox);

  console.log(`[QA-R6] Bbox mit NaN: ${result}`);

  // NaN Vergleiche sind immer false, also result = false
  assert.equal(result, false);
});

test("[QA-R6] poiInBbox: bbox mit Infinity", () => {
  const bbox = { minLat: -Infinity, maxLat: Infinity, minLon: -Infinity, maxLon: Infinity };
  const poi = { lat: 45, lon: 0 };

  const result = poiInBbox(poi, bbox);

  console.log(`[QA-R6] Bbox mit Infinity: ${result}`);

  // Infinity-Vergleiche sollten OK sein:
  // poi.lat >= -Infinity → true, poi.lat <= Infinity → true, etc.
  assert.equal(result, true);
});

// ============================================================================
// Integration: poiImKorridor + bboxUmRoute Round-Trip
// ============================================================================

test("[QA-R6] Integration: POI genau auf Korridor-Grenze (Distanz = korridorNm)", () => {
  // Route von (0,0) zu (1,0) — 1° Differenz
  const route = [
    { lat: 0.0, lon: 0.0 },
    { lat: 1.0, lon: 0.0 },
  ];

  // POI bei (0.5, 0.5) — sollte eine bekannte Distanz haben
  // Mit haversine: distance ≈ sqrt(0.5^2 + 0.5^2) * 111 km/° ≈ 78.6 km ≈ 42.5 sm
  const poi = { lat: 0.5, lon: 0.5 };

  for (const korridor of [40, 42.5, 45]) {
    const result = poiImKorridor(poi, route, korridor);
    console.log(`[QA-R6] POI auf (0.5,0.5), korridorNm=${korridor}: ${result}`);
  }
});

test("[QA-R6] Integration: bboxUmRoute sollte mit poiImKorridor konsistent sein", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
  ];
  const korridorNm = 10;

  const bbox = bboxUmRoute(route, korridorNm);

  // Ein POI im Korridor sollte auch in bbox sein
  // Aber nicht alle POIs in bbox sind im Korridor (bbox ist größer)

  const poiInBboxButNotKorridor = { lat: bbox.maxLat, lon: bbox.maxLon };
  const inBbox = poiInBbox(poiInBboxButNotKorridor, bbox);
  const inKorridor = poiImKorridor(poiInBboxButNotKorridor, route, korridorNm);

  console.log(
    `[QA-R6] POI auf Bbox-Ecke: inBbox=${inBbox}, inKorridor=${inKorridor}`
  );

  // inBbox sollte true sein, inKorridor kann false sein (oder true, je nach Entfernung)
  assert.equal(inBbox, true, "POI auf Bbox-Ecke sollte in Bbox sein");
});
