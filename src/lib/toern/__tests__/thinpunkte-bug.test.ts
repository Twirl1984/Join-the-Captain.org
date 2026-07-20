// Regression Test für thinPunkte Bug: maxPunkte < 2 gibt falsche Anzahl
// QA Runde 2 Finding

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareSnapshot } from "../share";

test("[QA-R2-BUG] thinPunkte mit maxPunkte=0 gibt 2 Punkte statt 0", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
    { lat: 54.2, lon: 13.2 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 0 });

  console.log(`maxPunkte=0: ${snap.punkte_json.length} Punkte (EXPECTED: 0, GOT: ${snap.punkte_json.length})`);
  // BUG: gibt 2 zurück statt 0
  assert.equal(snap.punkte_json.length, 0, "maxPunkte=0 sollte 0 Punkte zurückgeben");
});

test("[QA-R2-BUG] thinPunkte mit maxPunkte=1 gibt 1 Punkt (FIXED in R2)", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
    { lat: 54.2, lon: 13.2 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 1 });

  // Dies sollte in R1 gefixt worden sein
  assert.equal(snap.punkte_json.length, 1, "maxPunkte=1 sollte 1 Punkt haben");
});

test("[QA-R2-BUG] thinPunkte mit maxPunkte=2 sollte Start + Ende geben", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
    { lat: 54.2, lon: 13.2 },
    { lat: 54.3, lon: 13.3 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 2 });

  // maxPunkte=2 sollte Start und Ende ergeben
  assert.equal(snap.punkte_json.length, 2, "maxPunkte=2 sollte 2 Punkte haben");
  assert.deepEqual(snap.punkte_json[0], { lat: 54.0, lon: 13.0, name: null });
  assert.deepEqual(snap.punkte_json[1], { lat: 54.3, lon: 13.3, name: null });
});

test("[QA-R2-BUG] thinPunkte mit maxPunkte=-10 gibt 2 Punkte statt 0", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
  ];
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: -10 });

  console.log(`maxPunkte=-10: ${snap.punkte_json.length} Punkte (EXPECTED: 0, GOT: ${snap.punkte_json.length})`);
  // BUG: gibt 2 zurück
  assert.equal(snap.punkte_json.length, 0, "maxPunkte=-10 sollte 0 Punkte zurückgeben");
});
