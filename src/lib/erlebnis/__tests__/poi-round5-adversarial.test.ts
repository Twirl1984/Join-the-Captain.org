// [QA-ROUND-5] Neue aggressive Tests für POI und Korridor-Filter
// Tests auf Grenzfälle, DoS-Vektoren, Injektionen

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { poiImKorridor, bboxUmRoute, poiInBbox } from "../poi";

// ============================================================================
// Korridor-Filter Edge Cases
// ============================================================================

test("[QA-R5] poiImKorridor: Route mit 1 Punkt + POI direkt auf dem Punkt", () => {
  const route = [{ lat: 54.0, lon: 13.0 }];
  const poi = { lat: 54.0, lon: 13.0 };

  // Mit 1 Punkt sollte eine bbox sehr klein sein, POI sollte noch drin sein
  const result = poiImKorridor(poi, route, 1);

  // POI genau auf der Single-Point Route sollte TRUE sein
  console.log(`[QA-R5] 1-Punkt-Route: POI auf Punkt → ${result}`);
  assert.equal(result, true, "POI genau auf Single-Point Route sollte in Korridor sein");
});

test("[QA-R5] poiImKorridor: Route mit identischen Punkten (0 Distanz)", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.0, lon: 13.0 }, // Identischer Punkt
    { lat: 54.0, lon: 13.0 }, // Nochmal
  ];
  const poi = { lat: 54.01, lon: 13.0 };

  // Identische Punkte sollten nicht crashen, sondern 0-Distanz-Segment ignoren
  const result = poiImKorridor(poi, route, 1);
  console.log(`[QA-R5] Identische Punkte in Route: result=${result}`);

  // Sollte nicht crashen oder NaN zurückgeben
  assert.ok(typeof result === "boolean", "Sollte boolean sein");
});

test("[QA-R5] poiImKorridor: Route über Antimeridian (lon ~180/-180)", () => {
  const route = [
    { lat: 54.0, lon: 179.9 },
    { lat: 54.0, lon: -179.9 }, // Über den Datumswechsel
  ];
  const poi = { lat: 54.0, lon: 180.0 }; // Auf der Antimeridian-Grenze

  // Antimeridian-Routen sind kompliziert; sollten nicht crashen
  const result = poiImKorridor(poi, route, 0.5);
  console.log(`[QA-R5] Antimeridian-Route: POI auf Grenze → ${result}`);

  assert.ok(typeof result === "boolean", "Sollte boolean sein, nicht NaN/Infinity");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.ok(!Number.isNaN(result as any), "Sollte keine NaN sein");
});

test("[QA-R5] bboxUmRoute: korridorNm = Infinity (riesiger Korridor)", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.5, lon: 13.5 },
  ];

  // Infinity als Korridor sollte nicht zu Infinity in bbox führen
  const bbox = bboxUmRoute(route, Infinity);

  console.log(`[QA-R5] korridorNm=Infinity: bbox=${JSON.stringify(bbox)}`);

  // bbox sollte finite Werte haben, nicht Infinity/-Infinity
  assert.ok(Number.isFinite(bbox.minLat), "minLat sollte finite sein");
  assert.ok(Number.isFinite(bbox.maxLat), "maxLat sollte finite sein");
  assert.ok(Number.isFinite(bbox.minLon), "minLon sollte finite sein");
  assert.ok(Number.isFinite(bbox.maxLon), "maxLon sollte finite sein");
});

test("[QA-R5] bboxUmRoute: korridorNm = sehr großer positiver Wert (9999 sm)", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
  ];

  const bbox = bboxUmRoute(route, 9999);

  console.log(`[QA-R5] korridorNm=9999: bbox=${JSON.stringify(bbox)}`);

  // Sollte finite Werte haben, aber bbox kann größer sein
  assert.ok(Number.isFinite(bbox.minLat), "minLat sollte finite sein");
  assert.ok(bbox.maxLat <= 90, "maxLat darf nicht über 90 gehen");
  assert.ok(bbox.minLat >= -90, "minLat darf nicht unter -90 gehen");
});

test("[QA-R5] poiInBbox: POI genau auf der minLat-Grenze (Inklusion)", () => {
  const bbox = { minLat: 54.0, maxLat: 55.0, minLon: 13.0, maxLon: 14.0 };
  const poi = { lat: 54.0, lon: 13.5 }; // Auf der minLat-Grenze

  const result = poiInBbox(poi, bbox);

  console.log(`[QA-R5] POI auf minLat-Grenze: ${result}`);
  assert.equal(result, true, "POI genau auf Grenze sollte included sein (>=, nicht >)");
});

test("[QA-R5] poiInBbox: POI genau auf der maxLat-Grenze (Inklusion)", () => {
  const bbox = { minLat: 54.0, maxLat: 55.0, minLon: 13.0, maxLon: 14.0 };
  const poi = { lat: 55.0, lon: 13.5 }; // Auf der maxLat-Grenze

  const result = poiInBbox(poi, bbox);

  console.log(`[QA-R5] POI auf maxLat-Grenze: ${result}`);
  assert.equal(result, true, "POI genau auf Grenze sollte included sein (<=, nicht <)");
});

test("[QA-R5] poiInBbox: POI auf Ecke der bbox (vier Kombinationen)", () => {
  const bbox = { minLat: 54.0, maxLat: 55.0, minLon: 13.0, maxLon: 14.0 };

  const corners = [
    { lat: 54.0, lon: 13.0, label: "SW" }, // südwest
    { lat: 54.0, lon: 14.0, label: "SE" }, // südost
    { lat: 55.0, lon: 13.0, label: "NW" }, // nordwest
    { lat: 55.0, lon: 14.0, label: "NE" }, // nordost
  ];

  for (const corner of corners) {
    const result = poiInBbox(corner, bbox);
    console.log(`[QA-R5] POI auf Ecke ${corner.label}: ${result}`);
    assert.equal(result, true, `Ecke ${corner.label} sollte included sein`);
  }
});

// ============================================================================
// Parsing Edge Cases (parseRoute, parseBbox)
// ============================================================================

test("[QA-R5] parseRoute: Leere Route (nur Semikolons)", () => {
  // In der API wird das so aussehen: route=;;
  // Das sollte zu undefined oder leerer Route führen

  // Simpler Test der Parsing-Logik:
  const input = ";;";
  const parts = input
    .split(";")
    .map((paar) => paar.split(",").map(Number))
    .filter((p): p is [number, number] => p.length === 2 && p.every((n) => !Number.isNaN(n)));

  console.log(`[QA-R5] parseRoute mit ';;': ${parts.length} Punkte`);
  assert.equal(parts.length, 0, "Leere Semikolons sollten 0 Punkte geben");
});

test("[QA-R5] parseRoute: Nur Kommas (keine gültigen Paare)", () => {
  const input = ",,,";
  const parts = input
    .split(";")
    .map((paar) => paar.split(",").map(Number))
    .filter((p): p is [number, number] => p.length === 2 && p.every((n) => !Number.isNaN(n)));

  console.log(`[QA-R5] parseRoute mit ',,,': ${parts.length} Punkte`);
  assert.equal(parts.length, 0, "Ungültige Paare sollten gefiltert werden");
});

test("[QA-R5] parseRoute: Sehr lange Route (1000 Punkte)", () => {
  let routeStr = "";
  for (let i = 0; i < 1000; i++) {
    if (i > 0) routeStr += ";";
    routeStr += `${54 + i * 0.001},${13 + i * 0.001}`;
  }

  const parts = routeStr
    .split(";")
    .map((paar) => paar.split(",").map(Number))
    .filter((p): p is [number, number] => p.length === 2 && p.every((n) => !Number.isNaN(n)));

  console.log(`[QA-R5] parseRoute mit 1000 Punkten: ${parts.length} Punkte`);
  assert.equal(parts.length, 1000, "Sollte alle 1000 Punkte parsen");
});

test("[QA-R5] parseRoute: Ungültige Einträge werden korrekt gefiltert", () => {
  const input = "54.0,13.0;invalid;54.5,13.5;,,;55.0,14.0";
  const parts = input
    .split(";")
    .map((paar) => paar.split(",").map(Number))
    .filter((p): p is [number, number] => p.length === 2 && p.every((n) => !Number.isNaN(n)));

  console.log(`[QA-R5] parseRoute mit Müll: ${parts.length} Punkte`);
  assert.equal(parts.length, 3, "Sollte 3 gültige Punkte filtern, Müll ignorieren");
});

test("[QA-R5] parseBbox: 5 Werte (zu viele)", () => {
  const input = "54.0,13.0,55.0,14.0,extra";
  const parts = input.split(",").map(Number);

  const isValid = parts.length === 4 && parts.every((n) => !Number.isNaN(n));

  console.log(`[QA-R5] parseBbox mit 5 Werten: valid=${isValid}`);
  assert.equal(isValid, false, "5 Werte sollten invalid sein");
});

test("[QA-R5] parseBbox: 3 Werte (zu wenige)", () => {
  const input = "54.0,13.0,55.0";
  const parts = input.split(",").map(Number);

  const isValid = parts.length === 4 && parts.every((n) => !Number.isNaN(n));

  console.log(`[QA-R5] parseBbox mit 3 Werten: valid=${isValid}`);
  assert.equal(isValid, false, "3 Werte sollten invalid sein");
});

test("[QA-R5] parseBbox: Infinity und -Infinity als Eingabe", () => {
  const parts = ["54.0", "13.0", "Infinity", "-Infinity"].map(Number);
  const isValid = parts.length === 4 && parts.every((n) => !Number.isNaN(n) && Number.isFinite(n));

  console.log(`[QA-R5] parseBbox mit Infinity: valid=${isValid}`);
  assert.equal(isValid, false, "Infinity sollte als ungültig erkannt werden");
});

// ============================================================================
// Floating-Point Edge Cases
// ============================================================================

test("[QA-R5] parseRoute: Sehr kleine Koordinatendifferenzen (< 1mm)", () => {
  const lat1 = 54.0;
  const lon1 = 13.0;
  const lat2 = 54.00000001; // Differenz ~1 Nanometer
  const lon2 = 13.00000001;

  const input = `${lat1},${lon1};${lat2},${lon2}`;
  const parts = input
    .split(";")
    .map((paar) => paar.split(",").map(Number))
    .filter((p): p is [number, number] => p.length === 2 && p.every((n) => !Number.isNaN(n)));

  console.log(`[QA-R5] parseRoute mit Nano-Differenzen: ${parts.length} Punkte`);
  assert.equal(parts.length, 2, "Sollte beide Punkte parsen, auch mit Nano-Differenzen");
});

test("[QA-R5] Floating-Point: bboxUmRoute mit Antimeridian-nahen Koordinaten", () => {
  const route = [
    { lat: 0.0, lon: 179.9999 },
    { lat: 0.0, lon: 180.0 },
    { lat: 0.0, lon: -180.0 },
    { lat: 0.0, lon: -179.9999 },
  ];

  const bbox = bboxUmRoute(route, 1);

  console.log(`[QA-R5] Antimeridian nahe: bbox=${JSON.stringify(bbox)}`);

  // bbox sollte finite Werte haben
  assert.ok(Number.isFinite(bbox.minLon), "minLon sollte finite sein");
  assert.ok(Number.isFinite(bbox.maxLon), "maxLon sollte finite sein");
});

// ============================================================================
// Sicherheit: Input-Validierung sollte nicht crashen
// ============================================================================

test("[QA-R5] poiImKorridor: NaN in POI-Koordinaten sollte false ergeben", () => {
  const route = [{ lat: 54.0, lon: 13.0 }];
  const poi = { lat: NaN, lon: 13.0 };

  // Sollte nicht crashen, sondern false oder NaN-check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = poiImKorridor(poi as any, route, 1);
  } catch (err) {
    // Falls es crasht, dokumentieren
    console.log(`[QA-R5] NaN in POI wirft: ${(err as Error).message}`);
  }

  console.log(`[QA-R5] NaN in POI: result=${result}`);
  // Sollte nicht NaN sein, eher false
  assert.ok(typeof result === "boolean" || result === null, "Sollte kein NaN zurückgeben");
});

test("[QA-R5] bboxUmRoute: NaN in Route-Koordinaten wirft Fehler [BUG-058 FIXED]", () => {
  const route = [
    { lat: 54.0, lon: 13.0 },
    { lat: NaN, lon: NaN }, // NaN-Punkt
  ];

  // BUG-058: NaN sollte einen Fehler werfen, nicht Infinity-bbox geben
  assert.throws(() => bboxUmRoute(route, 1), "Route mit NaN sollte Fehler werfen");
});

test("[QA-R5] poiInBbox: Bbox mit minLat > maxLat (logischer Fehler)", () => {
  const bbox = { minLat: 55.0, maxLat: 54.0, minLon: 13.0, maxLon: 14.0 }; // Vertauscht
  const poi = { lat: 54.5, lon: 13.5 };

  const result = poiInBbox(poi, bbox);

  console.log(`[QA-R5] Bbox minLat>maxLat: ${result}`);

  // POI kann nicht in einer "umgekehrten" bbox sein
  assert.equal(result, false, "POI sollte false sein wenn minLat > maxLat");
});
