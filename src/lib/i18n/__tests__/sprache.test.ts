// Tests zur Sprachumschaltung (REQ-I18N-001).
// Lauf: node --import tsx --test src/lib/i18n/__tests__/sprache.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalisiereSprache,
  uebersetze,
  fuelle,
  andereSprache,
  spracheName,
  SPRACHEN,
  STANDARD_SPRACHE,
  SPRACHE_COOKIE,
  type Sprache,
  type Woerterbuch,
} from "../sprache";

const WB: Record<Sprache, Woerterbuch> = {
  de: { "nav.berechnen": "Berechnen", "nav.punkte": "{n} Punkte gesetzt", "nur.de": "Nur Deutsch" },
  en: { "nav.berechnen": "Calculate", "nav.punkte": "{n} waypoints set" },
};

test("[REQ-I18N-001] gueltige Sprachen werden uebernommen", () => {
  assert.equal(normalisiereSprache("de"), "de");
  assert.equal(normalisiereSprache("en"), "en");
});

test("[REQ-I18N-001] Regionalvarianten werden auf die Basissprache abgebildet", () => {
  // Damit die Browser-Vorgabe direkt verwendbar ist.
  assert.equal(normalisiereSprache("de-DE"), "de");
  assert.equal(normalisiereSprache("en-GB"), "en");
  assert.equal(normalisiereSprache("en_US"), "en");
});

test("[REQ-I18N-001] Accept-Language-Kopfzeile wird verstanden", () => {
  assert.equal(normalisiereSprache("en-US,en;q=0.9,de;q=0.8"), "en");
  assert.equal(normalisiereSprache("de-DE,de;q=0.9"), "de");
});

test("[REQ-I18N-001] Unbekanntes faellt auf die Standardsprache zurueck, ohne zu werfen", () => {
  assert.equal(normalisiereSprache("fr"), "de");
  assert.equal(normalisiereSprache(null), "de");
  assert.equal(normalisiereSprache(undefined), "de");
  assert.equal(normalisiereSprache(""), "de");
  assert.equal(normalisiereSprache("{}"), "de");
  assert.equal(normalisiereSprache("  EN  "), "en", "Leerzeichen und Grossschreibung stoeren nicht");
});

test("[REQ-I18N-001] eigener Rueckfall wird beachtet", () => {
  assert.equal(normalisiereSprache("fr", "en"), "en");
});

test("[REQ-I18N-001] Uebersetzung liefert den Text der gewaehlten Sprache", () => {
  assert.equal(uebersetze(WB, "nav.berechnen", "de"), "Berechnen");
  assert.equal(uebersetze(WB, "nav.berechnen", "en"), "Calculate");
});

test("[REQ-I18N-001] fehlender englischer Text zeigt den deutschen statt einer Luecke", () => {
  // Wichtig: In der Oberflaeche darf nie eine leere Stelle stehen.
  assert.equal(uebersetze(WB, "nur.de", "en"), "Nur Deutsch");
});

test("[REQ-I18N-001] voellig unbekannter Schluessel zeigt den Schluessel selbst", () => {
  // Sichtbar genug, um im Test aufzufallen — aber kein Absturz.
  assert.equal(uebersetze(WB, "gibt.es.nicht", "de"), "gibt.es.nicht");
  assert.equal(uebersetze(WB, "gibt.es.nicht", "en"), "gibt.es.nicht");
});

test("[REQ-I18N-001] Platzhalter werden eingesetzt", () => {
  assert.equal(fuelle(uebersetze(WB, "nav.punkte", "de"), { n: 3 }), "3 Punkte gesetzt");
  assert.equal(fuelle(uebersetze(WB, "nav.punkte", "en"), { n: 3 }), "3 waypoints set");
});

test("[REQ-I18N-001] unbekannter Platzhalter bleibt stehen, statt still zu verschwinden", () => {
  assert.equal(fuelle("Hallo {name}, {fehlt}", { name: "Chris" }), "Hallo Chris, {fehlt}");
});

test("[REQ-I18N-001] Umschalten wechselt und ist selbstinvers", () => {
  assert.equal(andereSprache("de"), "en");
  assert.equal(andereSprache("en"), "de");
  for (const s of SPRACHEN) {
    assert.equal(andereSprache(andereSprache(s)), s);
  }
});

test("[REQ-I18N-001] Sprachnamen stehen in der jeweiligen Sprache", () => {
  // Ein Englischsprachiger soll "English" lesen, nicht "Englisch".
  assert.equal(spracheName("de"), "Deutsch");
  assert.equal(spracheName("en"), "English");
});

test("[REQ-I18N-001] Deutsch ist die Standardsprache und der Cookie ist projektspezifisch", () => {
  assert.equal(STANDARD_SPRACHE, "de");
  assert.ok(SPRACHE_COOKIE.startsWith("jtc."), `Cookie sollte mit jtc. beginnen: ${SPRACHE_COOKIE}`);
});
