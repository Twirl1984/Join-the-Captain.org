// Unit-Tests des CSV-Exports.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import * as C from "../../../../public/toern-duell/csv.js";

test("[REQ-DUEL-004] csvZelle: Semikolon, Anführungszeichen, Zeilenumbruch werden gequotet", () => {
  assert.equal(C.csvZelle("a;b"), '"a;b"');
  assert.equal(C.csvZelle('sag "hi"'), '"sag ""hi"""');
  assert.equal(C.csvZelle("zwei\nZeilen"), '"zwei\nZeilen"');
  assert.equal(C.csvZelle("Müßig Öl"), "Müßig Öl");
  assert.equal(C.csvZelle(null), "");
  assert.equal(C.csvZelle(12), "12");
});

test("[REQ-DUEL-004] csvZelle: Formel-Injektion (=,+,-,@) wird entschärft; Zahlen bleiben Zahlen", () => {
  assert.equal(C.csvZelle("=SUMME(A1)"), "'=SUMME(A1)");
  assert.equal(C.csvZelle("@cmd"), "'@cmd");
  assert.equal(C.csvZelle("+49"), "'+49");
  assert.equal(C.csvZelle("-x"), "'-x");
  assert.equal(C.csvZelle(-3), "-3");
});

test("[REQ-DUEL-004] ranglisteCsv: Kopf, eine Zeile je Person, Platz/Gesamt, CRLF, BOM", () => {
  const rl = [
    { id: "a", name: "Anna", platz: 1, manoever: 40, landgang: 5, gesamt: 45, kartenAnzahl: 5, unterMin: false },
    { id: "b", name: "B;en", platz: 2, manoever: 10, landgang: 0, gesamt: 10, kartenAnzahl: 1, unterMin: true },
  ];
  const csv = C.ranglisteCsv(rl);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const zeilen = csv.slice(1).split("\r\n").filter(Boolean);
  assert.equal(zeilen.length, 3);
  assert.equal(zeilen[0], "Platz;Name;Karten;Manöverpunkte;Landgang;Gesamt;Hinweis");
  assert.equal(zeilen[1], "1;Anna;5;40;5;45;");
  assert.match(zeilen[2], /^2;"B;en";1;10;0;10;.+/); // Hinweis „unter Mindestanzahl“
});

test("[REQ-DUEL-004] bewertungenCsv: eine Zeile je Versuch mit Summen, Bonus, Punkten", () => {
  const state = {
    crew: [{ id: "a", name: "Anna" }, { id: "b", name: "Ben" }],
    versuche: [{
      id: "v1", karte: 14, rudergaenger: "a", bewerter: "b", notiz: 'knapp; "ok"',
      selbst: { kommunikation: 4, crew: 4, steuerung: 4 }, fremd: { kommunikation: 3, crew: 3, steuerung: 3 },
    }],
  };
  const titel = new Map([[14, "Quickstopp: Person links"]]);
  const zeilen = C.bewertungenCsv(state as never, titel).slice(1).split("\r\n").filter(Boolean);
  assert.equal(zeilen[0], "Karte;Titel;Rudergänger;Bewerter;Selbst;Fremd;Bonus;Kartenpunkte;Notiz");
  assert.equal(zeilen[1], '14;Quickstopp: Person links;Anna;Ben;12;9;1;10;"knapp; ""ok"""');
});

test("[REQ-DUEL-004] bewertungenCsv: unbekannte Person/Karte bricht nicht ab", () => {
  const state = { crew: [], versuche: [{ id: "v", karte: 99, rudergaenger: "x", bewerter: "y",
    selbst: { kommunikation: 0, crew: 0, steuerung: 0 }, fremd: { kommunikation: 0, crew: 0, steuerung: 0 } }] };
  assert.doesNotThrow(() => C.bewertungenCsv(state as never, new Map()));
});
