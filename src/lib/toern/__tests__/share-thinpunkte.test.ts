// Unit-Tests für thinPunkte edge cases (impliziter Test über buildShareSnapshot)

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareSnapshot } from "../share";

test("[QA] buildShareSnapshot mit maxPunkte=1 sollte nur 1 Punkt zurückgeben", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
    { lat: 54.2, lon: 13.2 },
    { lat: 54.3, lon: 13.3 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 1 });

  console.log(`maxPunkte=1: returned ${snap.punkte_json.length} Punkte`);
  console.log(`Punkte:`, snap.punkte_json);

  // Der aktuelle Code gibt 2 Punkte zurück!
  assert.equal(snap.punkte_json.length, 1, "maxPunkte=1 sollte genau 1 Punkt zurückgeben");
});

test("[QA] buildShareSnapshot mit maxPunkte=0 (Edge Case)", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 0 });

  console.log(`maxPunkte=0: returned ${snap.punkte_json.length} Punkte`);
  // Bei maxPunkte=0 könnte die thinPunkte-Funktion fehlschlagen
  assert.ok(snap.punkte_json.length >= 0, "Sollte kein Crash sein");
});

test("[QA] thinPunkte mit Grenzverschachtelung: 100 Punkte auf maxPunkte=2", () => {
  const punkte = Array.from({ length: 100 }, (_, i) => ({ lat: 54 + i * 0.001, lon: 13 }));
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 2 });

  assert.equal(snap.punkte_json.length, 2, "maxPunkte=2 sollte 2 Punkte haben");
  assert.equal(snap.punkte_json[0].lat, punkte[0].lat, "Start sollte erhalten bleiben");
  assert.equal(snap.punkte_json[1].lat, punkte[99].lat, "Ende sollte erhalten bleiben");
});

test("[QA] thinPunkte mit vielen Punkten und großem maxPunkte", () => {
  const punkte = Array.from({ length: 10 }, (_, i) => ({ lat: 54 + i * 0.001, lon: 13 }));
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 1000 });

  assert.equal(snap.punkte_json.length, 10, "Sollte alle 10 Punkte behalten");
});
