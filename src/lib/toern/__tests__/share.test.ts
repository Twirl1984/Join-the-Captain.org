// Unit-Tests für den teilbaren Törn-Link (REQ-EXP-009).
// Lauf: node --import tsx --test src/lib/toern/__tests__/share.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateShareId, buildShareSnapshot } from "../share";

test("[REQ-EXP-009] generateShareId liefert 8 Zeichen aus dem base36-Alphabet", () => {
  const id = generateShareId();
  assert.equal(id.length, 8);
  assert.match(id, /^[a-z0-9]{8}$/);
});

test("[REQ-EXP-009] generateShareId ist mit injiziertem Zufall deterministisch (Testbarkeit)", () => {
  const fest = () => 0; // immer erstes Zeichen des Alphabets
  assert.equal(generateShareId(fest), "aaaaaaaa");
});

test("[REQ-EXP-009] buildShareSnapshot kuerzt lange Punktfolgen auf maxPunkte, behaelt Start/Ende", () => {
  const punkte = Array.from({ length: 200 }, (_, i) => ({ lat: 54 + i * 0.001, lon: 13 }));
  const plan = { total_nm: 42, eta: "2026-07-15T12:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 10 });
  assert.equal(snap.punkte_json.length, 10);
  assert.equal(snap.punkte_json[0].lat, punkte[0].lat);
  assert.equal(snap.punkte_json[9].lat, punkte[199].lat);
});

test("[REQ-EXP-009] buildShareSnapshot laesst kurze Punktfolgen unveraendert", () => {
  const punkte = [{ lat: 54, lon: 13 }, { lat: 54.1, lon: 13.1 }];
  const plan = { total_nm: 5, eta: "2026-07-15T10:00:00Z", warnings: ["Testwarnung"] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan });
  assert.equal(snap.punkte_json.length, 2);
  assert.deepEqual(snap.plan_json, { total_nm: 5, eta: "2026-07-15T10:00:00Z", warnings: ["Testwarnung"] });
});

test("[REQ-EXP-009] buildShareSnapshot ohne Highlights ergibt null (kein leeres Array)", () => {
  const punkte = [{ lat: 54, lon: 13 }];
  const plan = { total_nm: 1, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, highlights: [] });
  assert.equal(snap.highlights_json, null);
});

test("[REQ-EXP-009] buildShareSnapshot mit Highlights behaelt sie", () => {
  const punkte = [{ lat: 54, lon: 13 }];
  const plan = { total_nm: 1, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const highlights = [{ name: "Kap Arkona", lat: 54.68, lon: 13.43, typ: "sehenswuerdigkeit" }];
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, highlights });
  assert.deepEqual(snap.highlights_json, highlights);
});
