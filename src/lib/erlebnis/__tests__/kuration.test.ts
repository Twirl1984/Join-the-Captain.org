// Unit-Tests für die Kurations-Entscheidungslogik (REQ-EXP-002).
// Lauf: node --import tsx --test src/lib/erlebnis/__tests__/kuration.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  istReviewFaellig,
  istEventAbgelaufen,
  entscheideReview,
  erfuelltAutoPublishSchwelle,
} from "../kuration";

const JETZT = new Date("2026-07-15T00:00:00Z");

test("[REQ-EXP-002] nie reviewte POIs sind sofort review-faellig", () => {
  assert.equal(istReviewFaellig({ reviewed_am: null }, JETZT), true);
});

test("[REQ-EXP-002] frisch reviewte POIs sind nicht faellig", () => {
  assert.equal(istReviewFaellig({ reviewed_am: "2026-07-01T00:00:00Z" }, JETZT), false);
});

test("[REQ-EXP-002] POIs aelter als 6 Monate sind review-faellig (Deckel)", () => {
  assert.equal(istReviewFaellig({ reviewed_am: "2026-01-01T00:00:00Z" }, JETZT), true);
  assert.equal(istReviewFaellig({ reviewed_am: "2026-02-01T00:00:00Z" }, JETZT), false);
});

test("[REQ-EXP-002] Event mit ueberschrittenem gueltig_bis gilt als abgelaufen", () => {
  assert.equal(istEventAbgelaufen({ gueltig_bis: "2026-07-01" }, JETZT), true);
  assert.equal(istEventAbgelaufen({ gueltig_bis: "2026-08-01" }, JETZT), false);
  assert.equal(istEventAbgelaufen({ gueltig_bis: null }, JETZT), false);
});

test("[REQ-EXP-002] Review-Entscheidung: abgelaufenes Event wird archiviert, unabhaengig von der Quelle", () => {
  const poi = { typ: "event" as const, gueltig_bis: "2026-01-01" };
  assert.deepEqual(entscheideReview(poi, JETZT, true), { typ: "archivieren", grund: "event_abgelaufen" });
  assert.deepEqual(entscheideReview(poi, JETZT, false), { typ: "archivieren", grund: "event_abgelaufen" });
});

test("[REQ-EXP-002] Review-Entscheidung: tote Quelle geht in pruefen, nicht direkt archiviert", () => {
  const poi = { typ: "sehenswuerdigkeit" as const, gueltig_bis: null };
  assert.deepEqual(entscheideReview(poi, JETZT, false), { typ: "pruefen", grund: "quelle_nicht_erreichbar" });
});

test("[REQ-EXP-002] Review-Entscheidung: erreichbare Quelle aktualisiert nur reviewed_am", () => {
  const poi = { typ: "sehenswuerdigkeit" as const, gueltig_bis: null };
  assert.deepEqual(entscheideReview(poi, JETZT, true), { typ: "reviewed_aktualisieren" });
});

test("[REQ-EXP-002] Auto-Publish-Guardrail: Confidence UND Erreichbarkeit sind beide Pflicht", () => {
  assert.equal(erfuelltAutoPublishSchwelle({ confidence: 0.9 }, true), true);
  assert.equal(erfuelltAutoPublishSchwelle({ confidence: 0.9 }, false), false);
  assert.equal(erfuelltAutoPublishSchwelle({ confidence: 0.5 }, true), false);
  assert.equal(erfuelltAutoPublishSchwelle({ confidence: 0.7 }, true), true);
});
