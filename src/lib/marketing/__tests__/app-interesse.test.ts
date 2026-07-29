// Tests zur Interessenten-Vormerkung (REQ-EXP-012).
// Lauf: node --import tsx --test src/lib/marketing/__tests__/app-interesse.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { pruefeAdresse, istGleicheAdresse, MAX_LAENGE } from "../app-interesse";
import { appInteresseEnabled } from "@/lib/flags";

test("[REQ-EXP-012] gueltige Adressen werden angenommen und vereinheitlicht", () => {
  const f = pruefeAdresse("  Chris@Join-The-Captain.ORG  ");
  assert.equal(f.gueltig, true);
  if (f.gueltig) assert.equal(f.adresse, "chris@join-the-captain.org");
});

test("[REQ-EXP-012] leere Eingabe wird als leer gemeldet, nicht als Formatfehler", () => {
  // Der Unterschied zaehlt: 'Bitte trag etwas ein' liest sich anders als
  // 'Das sieht nicht wie eine Adresse aus'.
  for (const roh of ["", "   ", null, undefined]) {
    const f = pruefeAdresse(roh);
    assert.equal(f.gueltig, false);
    if (!f.gueltig) assert.equal(f.grund, "leer", `bei ${JSON.stringify(roh)}`);
  }
});

test("[REQ-EXP-012] offensichtlicher Unsinn wird abgewiesen", () => {
  const unsinn = ["kein-at-zeichen", "@keindomain.de", "chris@", "chris@ohnepunkt", "a b@c.de", "chris@x.d"];
  for (const u of unsinn) {
    const f = pruefeAdresse(u);
    assert.equal(f.gueltig, false, `"${u}" haette abgewiesen werden muessen`);
    if (!f.gueltig) assert.equal(f.grund, "format");
  }
});

test("[REQ-EXP-012] uebermaessig lange Eingaben werden abgewiesen", () => {
  const lang = "a".repeat(MAX_LAENGE) + "@x.de";
  const f = pruefeAdresse(lang);
  assert.equal(f.gueltig, false);
  if (!f.gueltig) assert.equal(f.grund, "zu_lang");
});

test("[REQ-EXP-012] Adressen mit Plus und Punkt bleiben erhalten", () => {
  // Bewusst NICHT normalisiert: Ob a.b@ und ab@ dieselbe Person sind, haengt
  // vom Anbieter ab. Zu clever zu sein hiesse, jemandem eine gewollte zweite
  // Anmeldung zu verweigern.
  const f = pruefeAdresse("chris+segeln@example.com");
  assert.equal(f.gueltig, true);
  if (f.gueltig) assert.equal(f.adresse, "chris+segeln@example.com");
  assert.ok(!istGleicheAdresse("a.b@example.com", "ab@example.com"));
});

test("[REQ-EXP-012] Gleichheit ignoriert Gross-/Kleinschreibung und Leerzeichen", () => {
  assert.ok(istGleicheAdresse(" Chris@Example.COM ", "chris@example.com"));
});

test("[REQ-EXP-012] DAS FEATURE IST STANDARDMAESSIG AUS (Datenschutz)", () => {
  // Der wichtigste Test dieser Datei. Alle anderen Flags im Projekt sind
  // Default AN — hier ist die Umkehrung Absicht: Ohne erweiterte
  // Datenschutzerklaerung darf hier nichts erhoben werden. Wer diesen Test
  // rot macht, muss zuerst die Rechtsgrundlage klaeren.
  const vorher = process.env.NEXT_PUBLIC_FEATURE_APP_INTERESSE;
  try {
    delete process.env.NEXT_PUBLIC_FEATURE_APP_INTERESSE;
    assert.equal(appInteresseEnabled(), false, "ohne ausdrueckliches Einschalten muss es AUS sein");
    process.env.NEXT_PUBLIC_FEATURE_APP_INTERESSE = "";
    assert.equal(appInteresseEnabled(), false, "leerer Wert zaehlt nicht als Einschalten");
    process.env.NEXT_PUBLIC_FEATURE_APP_INTERESSE = "off";
    assert.equal(appInteresseEnabled(), false);
    process.env.NEXT_PUBLIC_FEATURE_APP_INTERESSE = "on";
    assert.equal(appInteresseEnabled(), true, "ausdrueckliches 'on' schaltet ein");
  } finally {
    if (vorher === undefined) delete process.env.NEXT_PUBLIC_FEATURE_APP_INTERESSE;
    else process.env.NEXT_PUBLIC_FEATURE_APP_INTERESSE = vorher;
  }
});
