// Unit-Tests für die reine Gültigkeits-Prüfung der POI-Wissensbasis (poi.ts).
// Lauf: node --import tsx --test src/lib/erlebnis/__tests__/poi.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { istAktuellGueltig } from "../poi";

test("[REQ-EXP-001] POI ohne Saison/Event-Felder ist ganzjährig gültig", () => {
  const poi = { gueltig_von: null, gueltig_bis: null, saison_von: null, saison_bis: null };
  assert.equal(istAktuellGueltig(poi, new Date("2026-01-15")), true);
  assert.equal(istAktuellGueltig(poi, new Date("2026-08-01")), true);
});

test("[REQ-EXP-001] Saisonfenster innerhalb eines Jahres (z. B. Blaue Grotte Mai-Oktober)", () => {
  const poi = { gueltig_von: null, gueltig_bis: null, saison_von: 5, saison_bis: 10 };
  assert.equal(istAktuellGueltig(poi, new Date("2026-04-30")), false);
  assert.equal(istAktuellGueltig(poi, new Date("2026-05-01")), true);
  assert.equal(istAktuellGueltig(poi, new Date("2026-10-31")), true);
  assert.equal(istAktuellGueltig(poi, new Date("2026-11-01")), false);
});

test("[REQ-EXP-001] Saisonfenster über den Jahreswechsel (Wraparound, z. B. Nov-Feb)", () => {
  const poi = { gueltig_von: null, gueltig_bis: null, saison_von: 11, saison_bis: 2 };
  assert.equal(istAktuellGueltig(poi, new Date("2026-12-15")), true);
  assert.equal(istAktuellGueltig(poi, new Date("2026-01-15")), true);
  assert.equal(istAktuellGueltig(poi, new Date("2026-06-01")), false);
});

test("[REQ-EXP-001] Event mit gueltig_bis fällt nach Ablauf aus der Anzeige", () => {
  const poi = {
    gueltig_von: "2026-08-14",
    gueltig_bis: "2026-08-16",
    saison_von: null,
    saison_bis: null,
  };
  assert.equal(istAktuellGueltig(poi, new Date("2026-08-15")), true);
  assert.equal(istAktuellGueltig(poi, new Date("2026-08-20")), false);
  assert.equal(istAktuellGueltig(poi, new Date("2026-08-10")), false);
});
