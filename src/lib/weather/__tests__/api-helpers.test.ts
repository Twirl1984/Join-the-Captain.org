// Unit-Tests für das Body-Parsing der Wetter-/Navigations-APIs (api-helpers.ts).
// Lauf:  node --import tsx --test src/lib/weather/__tests__/api-helpers.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWaypoints } from "../api-helpers";

const A = { lat: 54, lon: 13 };
const B = { lat: 54.1, lon: 13.2 };

test("[REQ-NAV-017] parseWaypoints: stay_min wird übernommen und gerundet", () => {
  const r = parseWaypoints([A, { ...B, stay_min: 90.6 }]);
  assert.ok(r);
  assert.equal(r[1].stay_min, 91);
});

test("[REQ-NAV-017] parseWaypoints: stay_min 0 wird zu undefined (keine Liegezeit)", () => {
  const r = parseWaypoints([A, { ...B, stay_min: 0 }]);
  assert.ok(r);
  assert.equal(r[1].stay_min, undefined);
});

test("[REQ-NAV-017] parseWaypoints: ungültige stay_min werden abgelehnt", () => {
  assert.equal(parseWaypoints([A, { ...B, stay_min: -5 }]), null);
  assert.equal(parseWaypoints([A, { ...B, stay_min: "abc" }]), null);
  assert.equal(parseWaypoints([A, { ...B, stay_min: 7 * 24 * 60 + 1 }]), null, "Deckel 7 Tage");
  assert.ok(parseWaypoints([A, { ...B, stay_min: 7 * 24 * 60 }]), "genau 7 Tage ist ok");
});

test("[REQ-NAV-017] staySumError: Summe der Liegezeiten über 7 Tage wird abgelehnt", async () => {
  const { staySumError } = await import("../api-helpers");
  assert.equal(staySumError([A, { ...B, stay_min: 10080 }]), null, "genau 7 Tage gesamt ok");
  assert.ok(staySumError([{ ...A, stay_min: 6000 }, { ...B, stay_min: 4081 }]), "Summe 10081 → Fehler");
  assert.equal(staySumError([A, B]), null, "ohne Liegezeiten ok");
});
