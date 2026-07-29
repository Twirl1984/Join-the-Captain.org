// Produkt- und Preisseite (REQ-EXP-011).
//
// Geprüft wird die Substanz der Texte, nicht die Optik. Der wichtigste Test ist
// der letzte: Eine Verkaufsseite ist genau die Stelle, an der eine ehrliche
// Einschränkung erfahrungsgemäß aufweicht — hier darf sie das nicht.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WOERTERBUECHER } from "../woerterbuch";
import { SPRACHEN, uebersetze } from "../sprache";

const t = (k: string, s: (typeof SPRACHEN)[number]) => uebersetze(WOERTERBUECHER, k, s);

test("[REQ-EXP-011] alle Texte der Preisseite existieren in beiden Sprachen", () => {
  const schluessel = [
    "preis.titel", "preis.eyebrow", "preis.einleitung",
    "preis.kann_titel", "preis.kann_1", "preis.kann_2", "preis.kann_3",
    "preis.kann_4", "preis.kann_5", "preis.kann_6",
    "preis.nicht_titel", "preis.nicht_text",
    "preis.preise_titel", "preis.frei_name", "preis.frei_preis", "preis.frei_text",
    "preis.saison_name", "preis.saison_preis", "preis.saison_text",
    "preis.jahr_name", "preis.jahr_preis", "preis.jahr_text",
    "preis.versprechen_titel", "preis.versprechen_text",
    "preis.status_hinweis", "preis.cta",
  ];
  for (const s of SPRACHEN) {
    for (const k of schluessel) {
      assert.notEqual(t(k, s), k, `Kein Text fuer "${k}" in ${s}`);
    }
  }
});

test("[REQ-EXP-011] die Preise stimmen mit der Betreiber-Entscheidung ueberein", () => {
  // 24 EUR Saison, 39 EUR Jahr, Ausprobieren kostenlos (Entscheidung 2026-07-20).
  // Ein Zahlendreher hier waere eine falsche Zusage an Kunden.
  assert.match(t("preis.saison_preis", "de"), /24/);
  assert.match(t("preis.jahr_preis", "de"), /39/);
  assert.match(t("preis.frei_preis", "de"), /0/);
  assert.match(t("preis.saison_preis", "en"), /24/);
  assert.match(t("preis.jahr_preis", "en"), /39/);
});

test("[REQ-EXP-011] das Jahresangebot ist guenstiger als zwei Saisons", () => {
  // Sonst ergibt die Staffelung keinen Sinn und wirkt unseriös.
  const zahl = (s: string) => Number(s.replace(/[^\d]/g, ""));
  const saison = zahl(t("preis.saison_preis", "de"));
  const jahr = zahl(t("preis.jahr_preis", "de"));
  assert.ok(jahr < saison * 2, `Jahr (${jahr}) muss unter zwei Saisons (${saison * 2}) liegen`);
  assert.ok(jahr > saison, `Jahr (${jahr}) muss ueber einer Saison (${saison}) liegen`);
});

test("[REQ-EXP-011] das Versprechen nennt das Aussperren beim Namen", () => {
  // Das ist die Abgrenzung zum Marktfuehrer, dem in der Yacht.de-Uebersicht 2026
  // genau das Sperren bezahlter Karten nach Ablauf angekreidet wird. Eine vage
  // Formulierung waere wertlos.
  assert.match(t("preis.versprechen_text", "de"), /bezahlt/i);
  assert.match(t("preis.versprechen_text", "de"), /sperr/i);
  assert.match(t("preis.versprechen_text", "en"), /paid/i);
  assert.match(t("preis.versprechen_text", "en"), /lock/i);
});

test("[REQ-EXP-011] die Abgrenzung nennt amtliche Seekarten ausdruecklich (REQ-SAFE-002)", () => {
  // Der wichtigste Test dieser Datei: Eine Verkaufsseite darf die
  // Sicherheitsabgrenzung nicht aufweichen.
  const de = t("preis.nicht_text", "de");
  const en = t("preis.nicht_text", "en");
  assert.match(de, /amtlich/i, "deutsche Abgrenzung muss amtliche Seekarten nennen");
  assert.match(de, /Skipper/i, "die Verantwortung des Skippers muss benannt sein");
  assert.match(en, /official/i, "englische Abgrenzung muss amtliche Karten nennen");
  assert.match(en, /skipper/i, "die Verantwortung des Skippers muss benannt sein");
});

test("[REQ-EXP-011] kein Werbetext verspricht mehr, als das Produkt halten kann", () => {
  // 'Ersetzt', 'amtlich', 'zugelassen', 'zertifiziert' haben auf einer Seite
  // ueber ein Planungswerkzeug nichts zu suchen — ausser in der Abgrenzung selbst.
  const werbetexte = [
    "preis.titel", "preis.einleitung", "preis.cta",
    "preis.kann_1", "preis.kann_2", "preis.kann_3",
    "preis.kann_4", "preis.kann_5", "preis.kann_6",
  ];
  const verboten = /(zugelassen|zertifiziert|amtlich|certified|approved|official)/i;
  for (const s of SPRACHEN) {
    for (const k of werbetexte) {
      const text = t(k, s);
      assert.ok(!verboten.test(text), `"${k}" (${s}) verspricht zu viel: "${text}"`);
    }
  }
});
