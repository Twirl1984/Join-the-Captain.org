// Aufruf zum Selbstplanen auf geteilten Törns (REQ-EXP-010).
//
// Was hier geprüft wird: die Substanz der Texte. Die Darstellung der Seite
// braucht eine Datenbank und wird gegen Staging geprüft — das steht so auch in
// der Anforderung, damit niemand den Testumfang überschätzt.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WOERTERBUECHER } from "../woerterbuch";
import { SPRACHEN, uebersetze } from "../sprache";

const SCHLUESSEL = ["share.cta_titel", "share.cta_text", "share.cta_knopf"];

test("[REQ-EXP-010] der Aufruf existiert in beiden Sprachen", () => {
  for (const s of SPRACHEN) {
    for (const k of SCHLUESSEL) {
      const text = uebersetze(WOERTERBUECHER, k, s);
      assert.notEqual(text, k, `Kein Text fuer "${k}" in ${s}`);
      assert.ok(text.trim().length > 0, `Leerer Text bei "${k}" (${s})`);
    }
  }
});

test("[REQ-EXP-010] der Aufruf fordert zum Handeln auf, statt nur zu beschreiben", () => {
  // Eine Ueberschrift wie "Geteilter Toern" waere kein Aufruf. Erwartet wird
  // ein Verb in der Aufforderungsform.
  assert.match(uebersetze(WOERTERBUECHER, "share.cta_titel", "de"), /^Plane\b/);
  assert.match(uebersetze(WOERTERBUECHER, "share.cta_titel", "en"), /^Plan\b/);
});

test("[REQ-EXP-010] die Schaltflaeche bleibt kurz genug fuer schmale Handys", () => {
  for (const s of SPRACHEN) {
    const knopf = uebersetze(WOERTERBUECHER, "share.cta_knopf", s);
    assert.ok(knopf.length <= 20, `Knopftext zu lang (${s}): "${knopf}" (${knopf.length} Zeichen)`);
  }
});

test("[REQ-EXP-010] der Aufruf nennt den Nutzen und die fehlende Huerde", () => {
  // Wer einen geteilten Toern sieht, kennt das Produkt nicht. Der Text muss
  // sagen, was er bekommt UND dass es ihn nichts kostet.
  const de = uebersetze(WOERTERBUECHER, "share.cta_text", "de");
  const en = uebersetze(WOERTERBUECHER, "share.cta_text", "en");
  assert.match(de, /kostenlos/i, "deutscher Text sollte die fehlende Huerde nennen");
  assert.match(en, /free/i, "englischer Text sollte die fehlende Huerde nennen");
  assert.match(de, /Wetter|Route/i, "deutscher Text sollte den Nutzen nennen");
  assert.match(en, /weather|route/i, "englischer Text sollte den Nutzen nennen");
});

test("[REQ-EXP-010] der Aufruf verspricht keine amtliche Seekarte", () => {
  // Sicherheits-Wording (REQ-SAFE-002): Werbetext darf die Abgrenzung nicht
  // aufweichen. "Seekarte" ohne Einschraenkung waere ein Versprechen zu viel.
  for (const s of SPRACHEN) {
    for (const k of SCHLUESSEL) {
      const text = uebersetze(WOERTERBUECHER, k, s).toLowerCase();
      assert.ok(
        !/amtlich|official chart|seekarte ersetzt/.test(text),
        `Aufruf darf keine amtliche Seekarte suggerieren: "${text}"`,
      );
    }
  }
});
