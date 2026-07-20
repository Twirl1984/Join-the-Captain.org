// Strukturtests der Wörterbücher (REQ-I18N-001).
//
// Diese Tests prüfen keine Übersetzungsqualität — das kann keine Maschine —,
// sondern die Fehler, die beim Pflegen zweier Sprachen wirklich passieren:
// vergessene Gegenstücke, verrutschte Platzhalter, versehentlich kopierte Texte.
// Lauf: node --import tsx --test src/lib/i18n/__tests__/woerterbuch.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { WOERTERBUECHER } from "../woerterbuch";
import { SPRACHEN, uebersetze } from "../sprache";

const de = WOERTERBUECHER.de;
const en = WOERTERBUECHER.en;
const platzhalter = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();

test("[REQ-I18N-001] beide Woerterbuecher haben exakt dieselben Schluessel", () => {
  const nurDe = Object.keys(de).filter((k) => !(k in en));
  const nurEn = Object.keys(en).filter((k) => !(k in de));
  assert.deepEqual(nurDe, [], `Englische Uebersetzung fehlt fuer: ${nurDe.join(", ")}`);
  assert.deepEqual(nurEn, [], `Deutscher Text fehlt fuer: ${nurEn.join(", ")}`);
});

test("[REQ-I18N-001] Platzhalter stimmen zwischen den Sprachen ueberein", () => {
  // Ein verrutschtes {n} faellt sonst erst dem Nutzer auf.
  for (const k of Object.keys(de)) {
    assert.deepEqual(
      platzhalter(en[k]),
      platzhalter(de[k]),
      `Platzhalter weichen ab bei "${k}": de="${de[k]}" en="${en[k]}"`,
    );
  }
});

test("[REQ-I18N-001] kein Text ist leer oder nur Leerzeichen", () => {
  for (const s of SPRACHEN) {
    for (const [k, v] of Object.entries(WOERTERBUECHER[s])) {
      assert.ok(v.trim().length > 0, `Leerer Text bei "${k}" (${s})`);
    }
  }
});

test("[REQ-I18N-001] englische Texte sind nicht versehentlich die deutschen", () => {
  // Gleiche Schreibweise ist bei Eigennamen und Fachbegriffen legitim
  // (Navigation, Podcast, Community, GPX) — daher eine bewusste Ausnahmeliste.
  const erlaubtGleich = new Set([
    "kopf.navigation",
    "kopf.podcast",
    "kopf.community",
    "wetter.wind",
    "wetter.pause", // "Pause" ist auch im Englischen die uebliche Beschriftung
    "kopf.entrepreneurs", // Eigenname des Bereichs, bleibt in beiden Sprachen gleich
  ]);
  const verdaechtig = Object.keys(de).filter(
    (k) => !erlaubtGleich.has(k) && de[k] === en[k],
  );
  assert.deepEqual(
    verdaechtig,
    [],
    `Identischer Text in beiden Sprachen — vermutlich vergessene Uebersetzung: ${verdaechtig.join(", ")}`,
  );
});

test("[REQ-I18N-001] deutsche Umlaute deuten nicht auf unuebersetzten englischen Text hin", () => {
  const mitUmlaut = Object.entries(en)
    .filter(([, v]) => /[äöüÄÖÜß]/.test(v))
    .map(([k]) => k);
  assert.deepEqual(mitUmlaut, [], `Englischer Text enthaelt Umlaute: ${mitUmlaut.join(", ")}`);
});

test("[REQ-I18N-001] Nachschlagen liefert fuer jeden Schluessel echten Text, nie den Schluessel", () => {
  for (const s of SPRACHEN) {
    for (const k of Object.keys(de)) {
      assert.notEqual(uebersetze(WOERTERBUECHER, k, s), k, `Kein Text fuer "${k}" in ${s}`);
    }
  }
});

test("[REQ-I18N-001] KEINE juristischen Texte im Woerterbuch (bleiben deutsch, REQ-SAFE-002)", () => {
  // Schutz gegen kuenftiges Verrutschen: Haftung, Impressum und Datenschutz
  // duerfen hier nicht landen, sonst werden sie irgendwann mituebersetzt.
  const juristisch = Object.keys(de).filter((k) =>
    /^(haftung|impressum|datenschutz|recht)\./.test(k),
  );
  assert.deepEqual(
    juristisch,
    [],
    `Juristische Texte gehoeren nicht ins Woerterbuch: ${juristisch.join(", ")}`,
  );
});
