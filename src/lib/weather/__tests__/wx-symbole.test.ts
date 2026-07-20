// Tests zur Windsymbol-Wahl (REQ-WET-017).
// Lauf: node --import tsx --test src/lib/weather/__tests__/wx-symbole.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalisiereSymbolWahl,
  andereWahl,
  umschaltBeschriftung,
  WX_SYMBOL_KEY,
  type WxSymbolWahl,
} from "../wx-symbole";

test("[REQ-WET-017] gespeicherte Wahl wird uebernommen", () => {
  assert.equal(normalisiereSymbolWahl("pfeil", "fahne"), "pfeil");
  assert.equal(normalisiereSymbolWahl("fahne", "pfeil"), "fahne");
});

test("[REQ-WET-017] ohne gespeicherte Wahl gilt der Startwert", () => {
  assert.equal(normalisiereSymbolWahl(null, "fahne"), "fahne");
  assert.equal(normalisiereSymbolWahl(undefined, "pfeil"), "pfeil");
  assert.equal(normalisiereSymbolWahl("", "fahne"), "fahne");
});

test("[REQ-WET-017] kaputter Speicherwert legt die Karte nicht lahm, sondern faellt zurueck", () => {
  // Tippfehler, fremder Wert aus einer aelteren Version, Muell
  assert.equal(normalisiereSymbolWahl("barb", "pfeil"), "pfeil");
  assert.equal(normalisiereSymbolWahl("{}", "fahne"), "fahne");
  assert.equal(normalisiereSymbolWahl("pfeile", "fahne"), "fahne", "Plural ist kein gueltiger Wert");
});

test("[REQ-WET-017] Gross-/Kleinschreibung und Leerzeichen stoeren nicht", () => {
  assert.equal(normalisiereSymbolWahl("  PFEIL ", "fahne"), "pfeil");
  assert.equal(normalisiereSymbolWahl("Fahne", "pfeil"), "fahne");
});

test("[REQ-WET-017] Umschalten wechselt und ist selbstinvers", () => {
  assert.equal(andereWahl("fahne"), "pfeil");
  assert.equal(andereWahl("pfeil"), "fahne");
  for (const w of ["pfeil", "fahne"] as WxSymbolWahl[]) {
    assert.equal(andereWahl(andereWahl(w)), w, "zweimal umschalten ergibt den Ausgangswert");
  }
});

test("[REQ-WET-017] Beschriftung nennt das ZIEL des Klicks, nicht den Ist-Zustand", () => {
  // Sonst denkt man, der Knopf zeige an, was gerade aktiv ist.
  assert.match(umschaltBeschriftung("fahne"), /Pfeile/);
  assert.match(umschaltBeschriftung("pfeil"), /Windfahnen/);
});

test("[REQ-WET-017] Speicher-Schluessel ist projektspezifisch (kollidiert nicht)", () => {
  assert.ok(WX_SYMBOL_KEY.startsWith("jtc."), `Schluessel sollte mit jtc. beginnen: ${WX_SYMBOL_KEY}`);
});
