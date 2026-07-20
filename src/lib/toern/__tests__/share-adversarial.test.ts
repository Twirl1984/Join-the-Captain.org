// Aggressive Adversarial-Tests für Törn-Share (REQ-EXP-009) — QA Runde 2
// Fokus: URL-Sicherheit, Längen-Grenzen, Round-Trip-Integrität
// Lauf: node --import tsx --test src/lib/toern/__tests__/share-adversarial.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateShareId, buildShareSnapshot } from "../share";

test("[QA-R2] generateShareId: kollisionssicherheit über 1000 Iterationen", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const id = generateShareId();
    if (ids.has(id)) {
      throw new Error(`Kollision erkannt: ${id}`);
    }
    ids.add(id);
  }
  assert.equal(ids.size, 1000, "Alle 1000 IDs sollten eindeutig sein");
});

test("[QA-R2] generateShareId: IDs sind immer 8 Zeichen", () => {
  for (let i = 0; i < 100; i++) {
    const id = generateShareId();
    assert.equal(id.length, 8, `ID sollte 8 Zeichen sein: ${id}`);
  }
});

test("[QA-R2] generateShareId: IDs verwenden NUR das Alphabet", () => {
  const validAlphabet = /^[a-z0-9]{8}$/;
  for (let i = 0; i < 100; i++) {
    const id = generateShareId();
    assert.match(id, validAlphabet, `ID sollte nur a-z0-9 enthalten: ${id}`);
  }
});

test("[QA-R2] buildShareSnapshot: maxPunkte=0 (Edge Case)", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
    { lat: 54.2, lon: 13.2 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 0 });

  // maxPunkte=0 sollte 0 Punkte zurückgeben (BUG-QA-001)
  console.log(`maxPunkte=0: ${snap.punkte_json.length} Punkte`);
  assert.equal(snap.punkte_json.length, 0, "maxPunkte=0 sollte 0 Punkte zurückgeben");
});

test("[QA-R2] buildShareSnapshot: maxPunkte negativ (sollte das akzeptieren?)", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };

  // thinPunkte mit negativem max: sollte 0 Punkte zurückgeben (BUG-QA-002)
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: -5 });
  console.log(`maxPunkte=-5: ${snap.punkte_json.length} Punkte`);
  assert.equal(snap.punkte_json.length, 0, "maxPunkte < 0 sollte 0 Punkte zurückgeben");
});

test("[QA-R2] buildShareSnapshot: Punkte mit sehr langen Namen", () => {
  const longName = "A".repeat(10000); // 10k Zeichen
  const punkte = [
    { lat: 54.0, lon: 13.0, name: longName },
    { lat: 54.1, lon: 13.1 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan });

  // JSON-Länge könnte problematisch werden bei sehr großen Daten
  const jsonStr = JSON.stringify(snap.punkte_json);
  console.log(`JSON-Größe mit 10k Namen: ${jsonStr.length} bytes`);
  assert.ok(jsonStr.length < 1000000, "JSON sollte unter 1MB sein");
});

test("[QA-R2] buildShareSnapshot: revierId mit Sonderzeichen (SQL-Injection?)", () => {
  const punkte = [{ lat: 54.0, lon: 13.0 }];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };

  // Diese werden nicht in SQL eingefügt (nur in JSON), aber schaue auf die Ausgabe
  const snap = buildShareSnapshot({
    revierId: "ruegen'; DROP TABLE revier_poi; --",
    punkte,
    plan,
  });
  assert.equal(snap.revier_id, "ruegen'; DROP TABLE revier_poi; --");
});

test("[QA-R2] buildShareSnapshot: highlights mit ungültigen lat/lon", () => {
  const punkte = [{ lat: 54.0, lon: 13.0 }];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const highlights = [
    { name: "Invalid", lat: 500, lon: 900, typ: "POI" }, // Außerhalb gültiger Koordinaten
  ];

  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, highlights });
  // buildShareSnapshot validiert nicht, nur JSON-Format
  assert.ok(snap.highlights_json !== null, "Highlights sollten sein");
});

test("[QA-R2] buildShareSnapshot: plan mit sehr großen Werten", () => {
  const punkte = [{ lat: 54.0, lon: 13.0 }];
  const plan = {
    total_nm: 999999999,
    eta: "2026-07-15T10:00:00Z",
    warnings: Array(1000).fill("Warning " + "X".repeat(1000)),
  };

  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan });
  const jsonStr = JSON.stringify(snap.plan_json);
  console.log(`Plan JSON-Größe mit 1000 großen Warnungen: ${jsonStr.length} bytes`);
});

test("[QA-R2] buildShareSnapshot: ISO-Datum malformed in plan.eta", () => {
  const punkte = [{ lat: 54.0, lon: 13.0 }];
  const plan = {
    total_nm: 10,
    eta: "nicht-iso-format!!!",
    warnings: [],
  };

  // buildShareSnapshot validiert nicht das Datum
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan });
  assert.equal(snap.plan_json?.eta, "nicht-iso-format!!!", "Sollte trotzdem kopiert werden");
});

test("[QA-R2] buildShareSnapshot: leere Highlights zu null", () => {
  const punkte = [{ lat: 54.0, lon: 13.0 }];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };

  const snap1 = buildShareSnapshot({ revierId: "ruegen", punkte, plan, highlights: [] });
  assert.equal(snap1.highlights_json, null, "Leere Highlights sollte null sein");

  const snap2 = buildShareSnapshot({ revierId: "ruegen", punkte, plan, highlights: undefined });
  assert.equal(snap2.highlights_json, null, "Undefined Highlights sollte null sein");
});

test("[QA-R2] buildShareSnapshot: maxPunkte sehr groß (1 Million)", () => {
  const punkte = Array.from({ length: 100 }, (_, i) => ({ lat: 54 + i * 0.001, lon: 13 }));
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };

  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 1000000 });
  assert.equal(snap.punkte_json.length, 100, "Sollte alle 100 Punkte behalten");
});

test("[QA-R2] thinPunkte implizit: maxPunkte=2 mit 2 Eingabe-Punkten", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };

  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 2 });
  assert.equal(snap.punkte_json.length, 2, "Mit 2 Eingabe-Punkte und maxPunkte=2: sollte 2 sein");
  assert.deepEqual(snap.punkte_json[0], { lat: 54.0, lon: 13.0, name: null });
  assert.deepEqual(snap.punkte_json[1], { lat: 54.1, lon: 13.1, name: null });
});

test("[QA-R2] buildShareSnapshot: punkte-Array mit Waypoints ohne name-Property", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 }, // kein name-Property
    { lat: 54.1, lon: 13.1 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };

  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan });
  // Das Map sollte undefined → null umwandeln
  assert.equal(snap.punkte_json[0].name, null, "Fehlende name sollte zu null werden");
  assert.equal(snap.punkte_json[1].name, null, "Fehlende name sollte zu null werden");
});
