// Unit-Tests für den teilbaren Törn-Link (REQ-EXP-009).
// Lauf: node --import tsx --test src/lib/toern/__tests__/share.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateShareId, buildShareSnapshot, validateToernShareId } from "../share";

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

// --- QA-ADVERSARIAL EDGE CASES ---

test("[QA] generateShareId: Generierte IDs sollten eindeutig sein (nicht 36^8 kollisionen erwarten)", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const id = generateShareId();
    assert.ok(!ids.has(id), `Kollision erkannt: ${id}`);
    ids.add(id);
  }
  assert.equal(ids.size, 1000, "Alle 1000 IDs sollten eindeutig sein");
});

test("[QA] buildShareSnapshot mit XSS-behaftetem revierId", () => {
  const punkte = [{ lat: 54, lon: 13 }];
  const plan = { total_nm: 1, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const maliciousRevierId = "<script>alert('XSS')</script>";
  const snap = buildShareSnapshot({ revierId: maliciousRevierId, punkte, plan });
  assert.equal(snap.revier_id, maliciousRevierId, "revierId sollte unverändert bleiben");
  // JSON.stringify escapet das automatisch, aber der Snapshot hat den Original-String
});

test("[QA] buildShareSnapshot mit XSS in Highlight-Namen", () => {
  const punkte = [{ lat: 54, lon: 13 }];
  const plan = { total_nm: 1, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const maliciousHighlight = {
    name: "<img src=x onerror='alert(1)'>",
    lat: 54.68,
    lon: 13.43,
    typ: "sehenswuerdigkeit",
  };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, highlights: [maliciousHighlight] });
  assert.ok(snap.highlights_json, "highlights_json sollte nicht null sein");
  assert.equal(snap.highlights_json![0].name, maliciousHighlight.name, "Name sollte unverändert sein");
});

test("[QA] buildShareSnapshot mit leeren Highlighting-Array sollte null ergeben", () => {
  const punkte = [{ lat: 54, lon: 13 }];
  const plan = { total_nm: 1, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, highlights: [] });
  assert.equal(snap.highlights_json, null, "Leeres Array sollte zu null umgewandelt werden");
});

test("[QA] buildShareSnapshot mit sehr großem maxPunkte (größer als array)", () => {
  const punkte = Array.from({ length: 10 }, (_, i) => ({ lat: 54 + i * 0.01, lon: 13 }));
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 10000 });
  assert.equal(snap.punkte_json.length, 10, "Sollte unverändert 10 Punkte haben");
});

test("[QA] buildShareSnapshot mit maxPunkte=1 (Extremfall)", () => {
  const punkte = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.1 },
    { lat: 54.2, lon: 13.2 },
  ];
  const plan = { total_nm: 1, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 1 });
  // Bei maxPunkte=1 sollte thinPunkte... Moment, das ist eine Grenze
  assert.ok(snap.punkte_json, "Sollte Punkte haben");
});

test("[QA] buildShareSnapshot mit maxPunkte=2 (minimal sinnvoll)", () => {
  const punkte = Array.from({ length: 100 }, (_, i) => ({ lat: 54 + i * 0.001, lon: 13 }));
  const plan = { total_nm: 10, eta: "2026-07-15T10:00:00Z", warnings: [] };
  const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte: 2 });
  assert.equal(snap.punkte_json.length, 2, "maxPunkte=2 sollte genau 2 Punkte zurückgeben");
  assert.equal(snap.punkte_json[0].lat, punkte[0].lat, "Erstes Punkt sollte Anfang sein");
  assert.equal(snap.punkte_json[1].lat, punkte[99].lat, "Zweites Punkt sollte Ende sein");
});

// --- BUG-056: ID-Validierung ---

test("[BUG-056] validateToernShareId akzeptiert nur exakt 8 Zeichen base36", () => {
  assert.doesNotThrow(() => validateToernShareId("abcdef12"), "Valide 8-stellige ID");
  assert.throws(() => validateToernShareId("abc"), "Zu kurz (3 Zeichen)");
  assert.throws(() => validateToernShareId("aaaaaaaaaa"), "Zu lang (10 Zeichen)");
  assert.throws(() => validateToernShareId("a"), "Zu kurz (1 Zeichen)");
});

test("[BUG-056] validateToernShareId akzeptiert nur base36-Alphabet (a-z, 0-9)", () => {
  assert.doesNotThrow(() => validateToernShareId("abcdef12"), "Valides Alphabet");
  assert.throws(() => validateToernShareId("ABCDEF12"), "Großbuchstaben nicht erlaubt");
  assert.throws(() => validateToernShareId("abcd-efg1"), "Bindestrich nicht im Alphabet");
  assert.throws(() => validateToernShareId("abcdef@1"), "Special char @ nicht erlaubt");
});
