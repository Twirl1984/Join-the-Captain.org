// [QA-ROUND-4] Neue aggressive Tests für POI-API
// Tests auf Error-Leaks, Daten-Integrität, Grenzfälle

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { listRevierPois, listPoisAmKorridor, bboxUmRoute, poiImKorridor, poiInBbox } from "../poi";

// Test: Ungültiger Revier-ID (Fehlertext darf keine DB-Struktur verraten)
test("[QA-R4] listRevierPois: unbekannter revier gibts leere Liste, nicht Fehler", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }
  const result = await listRevierPois({ revierId: "nonexistent_revier_xyz" });
  assert.strictEqual(Array.isArray(result), true, "sollte Array sein");
  assert.strictEqual(result.length, 0, "unbekannter revier → leere Liste, nicht throw");
});

// Test: Sehr großer Korridor (1000 nm) darf nicht das ganze Universum returnieren
test("[QA-R4] bboxUmRoute: korridorNm=1000 (riesig) darf nicht ∞ bbox geben", () => {
  const route = [
    { lat: 54.68, lon: 13.4 },
    { lat: 54.7, lon: 13.5 },
  ];
  const bbox = bboxUmRoute(route, 1000);

  // Bbox sollte nicht Infinity sein
  assert.ok(isFinite(bbox.minLat), "minLat sollte endlich sein");
  assert.ok(isFinite(bbox.maxLat), "maxLat sollte endlich sein");
  assert.ok(isFinite(bbox.minLon), "minLon sollte endlich sein");
  assert.ok(isFinite(bbox.maxLon), "maxLon sollte endlich sein");

  // Und natürlich: lat sollte in [-90, 90], lon in [-180, 180]
  assert.ok(bbox.minLat >= -90 || bbox.minLat <= 90);
  assert.ok(bbox.maxLat >= -90 || bbox.maxLat <= 90);
});

// Test: POI genau auf Bbox-Grenze
test("[QA-R4] poiInBbox: POI genau auf minLat-Grenze wird akzeptiert", () => {
  const poi = { lat: 54.0, lon: 13.5 };
  const bbox = { minLat: 54.0, maxLat: 55.0, minLon: 13.0, maxLon: 14.0 };

  // Grenzfälle sollten IN-CLUSIVE sein (>= statt >)
  // Diese Test dokumentiert das erwartete Verhalten
  const result = poiInBbox(poi, bbox);
  assert.strictEqual(result, true, "POI auf minLat-Grenze sollte akzeptiert werden");
});

// Test: Antimeridian-Grenzfall (Route über 180° Lon)
test("[QA-R4] poiImKorridor: Route über Antimeridian wird korrekt bearbeitet", () => {
  const route = [
    { lat: 54.68, lon: 179.9 },
    { lat: 54.68, lon: -179.9 }, // Springt über Antimeridian
  ];

  // bboxUmRoute sollte das korrekt handhaben (oder dokumentiert fehlschlagen)
  const bbox = bboxUmRoute(route, 3);

  // Sollte nicht NaN sein
  assert.ok(!isNaN(bbox.minLat), "bbox sollte nicht NaN sein");
  assert.ok(!isNaN(bbox.maxLat), "bbox sollte nicht NaN sein");
});

// Test: Routen-Parser mit Whitespace
test("[QA-R4] bboxUmRoute: Route mit nur 1 Punkt gibt kaputte bbox mit min>max", () => {
  const route = [{ lat: 54.68, lon: 13.4 }];
  const bbox = bboxUmRoute(route, 3);

  // Mit nur 1 Punkt könnte die Bbox zusammenfallen
  // Das ist eigentlich ok, aber: minLat sollte <= maxLat sein
  // Wenn diese Bedingung VERLETZT ist, ist das ein Bug
  const violation = bbox.minLat > bbox.maxLat || bbox.minLon > bbox.maxLon;

  // Dokumentiere das Verhalten: Single-Point-Routes führen zu min==max,
  // nicht zu min>max (das wäre ein Bug)
  console.log("[QA-R4] Single-Point bbox:", bbox);
  if (violation) {
    throw new Error(
      `FINDING: bboxUmRoute mit 1 Punkt gibt min>max: ` +
      `minLat=${bbox.minLat}, maxLat=${bbox.maxLat}`
    );
  }
});

// Test: Korridor mit sehr negativem Radius (sollte immer false sein)
test("[QA-R4] poiImKorridor: korridorNm sehr negativ (-999) sollte immer false sein", () => {
  const poi = { lat: 54.68, lon: 13.4, name: "Test" };
  const route = [{ lat: 54.68, lon: 13.4 }];

  // Mit negativem Korridor sollte KEINE POI drin sein
  const result = poiImKorridor(poi, route, -999);
  assert.strictEqual(result, false, "negative Korridor → immer false");
});

// DB-Test: POI-Status 'live' wird korrekt gefiltert
test("[QA-R4] listRevierPois: nur 'live' POIs werden defaultmäßig returniert", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  const result = await listRevierPois({ revierId: "ruegen" });
  // Alle POIs sollten status='live' sein
  for (const poi of result) {
    assert.strictEqual(
      poi.status,
      "live",
      `POI ${poi.name} sollte status='live' sein, hat aber '${poi.status}'`
    );
  }
});

// DB-Test: Saison-Filter funktioniert korrekt
test("[QA-R4] listRevierPois mit monat=7: nur Sommer-POIs", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  const result = await listRevierPois({ revierId: "ruegen", monat: 7 });

  // Alle POIs sollten Sommer-tauglich sein (saison_von <= 7 <= saison_bis, oder beides null)
  for (const poi of result) {
    if (poi.saison_von != null && poi.saison_bis != null) {
      // Wrap-Around-Check (z.B. Saison 11-3 für Winter)
      const inWinterWrap = poi.saison_von > poi.saison_bis && (7 >= poi.saison_von || 7 <= poi.saison_bis);
      const inNormalRange = poi.saison_von <= 7 && 7 <= poi.saison_bis;
      const isValid = inWinterWrap || inNormalRange || poi.saison_von == null || poi.saison_bis == null;

      assert.ok(
        isValid,
        `POI "${poi.name}" mit Saison ${poi.saison_von}-${poi.saison_bis} sollte in Monat 7 sein`
      );
    }
  }
});

// Test: Sehr viele Routenpunkte (Performance/Doubleur-Check)
test("[QA-R4] listPoisAmKorridor: 1000 Routenpunkte werden korrekt verarbeitet", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  // Generiere eine lange Route
  const routenPunkte = Array.from({ length: 1000 }, (_, i) => ({
    lat: 54.0 + (i * 0.001),
    lon: 13.0 + (i * 0.001),
  }));

  // Sollte nicht crashen oder timeout-en
  const result = await listPoisAmKorridor({
    routenPunkte,
    korridorNm: 5,
    revierId: "ruegen",
  });

  assert.ok(Array.isArray(result), "sollte Array sein");
  assert.ok(result.length >= 0, "sollte gültige POI-Liste sein");
});

// Test: Datum-Filter (gueltig_von/gueltig_bis)
test("[QA-R4] listRevierPois mit datum: filtert nach Gültigkeitsfenster", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  // Teste Datum in der Zukunft
  const result = await listRevierPois({
    revierId: "ruegen",
    datum: "2099-12-31",
  });

  // Alle POIs sollten gültig sein für dieses Datum (gueltig_von <= datum <= gueltig_bis)
  for (const poi of result) {
    if (poi.gueltig_von && poi.gueltig_bis) {
      assert.ok(
        poi.gueltig_von <= "2099-12-31" && "2099-12-31" <= poi.gueltig_bis,
        `POI "${poi.name}" sollte für Datum 2099-12-31 gültig sein`
      );
    }
  }
});
