// Unit-Tests der Manöver-Duell-Wertung (reine Logik, kein I/O).
import { test } from "node:test";
import { strict as assert } from "node:assert";
import * as S from "../../../../public/toern-duell/scoring.js";

const r = (k: number, c: number, s: number) => ({ kommunikation: k, crew: c, steuerung: s });
const versuch = (karte: number, person: string, selbst: number[], fremd: number[], id = `${karte}-${person}-${selbst}-${fremd}`) => ({
  id, karte, rudergaenger: person, bewerter: "x",
  selbst: r(selbst[0], selbst[1], selbst[2]), fremd: r(fremd[0], fremd[1], fremd[2]),
});

test("[REQ-DUEL-001] Konstanten: MIN_CARDS=5, COUNT_BEST=5, MAX_RATING=5", () => {
  assert.equal(S.MIN_CARDS, 5);
  assert.equal(S.COUNT_BEST, 5);
  assert.equal(S.MAX_RATING, 5);
});

test("[REQ-DUEL-001] Ehrlichkeitsbonus: Grenzen d=0,2,3,4,5", () => {
  assert.equal(S.ehrlichkeitsBonus(10, 10), 3); // d=0
  assert.equal(S.ehrlichkeitsBonus(10, 12), 3); // d=2
  assert.equal(S.ehrlichkeitsBonus(12, 10), 3); // symmetrisch
  assert.equal(S.ehrlichkeitsBonus(10, 13), 1); // d=3
  assert.equal(S.ehrlichkeitsBonus(10, 14), 1); // d=4
  assert.equal(S.ehrlichkeitsBonus(10, 15), 0); // d=5
});

test("[REQ-DUEL-001] Kartenpunkte: Maximum 18, Minimum 0", () => {
  assert.equal(S.bewerteVersuch(versuch(1, "a", [5, 5, 5], [5, 5, 5])).punkte, 18);
  const min = S.bewerteVersuch(versuch(1, "a", [0, 0, 5], [0, 0, 0])); // d=5 → kein Bonus
  assert.equal(min.punkte, 0);
  assert.equal(min.bonus, 0);
});

test("[REQ-DUEL-001] Kartenpunkte = Fremdsumme + Bonus", () => {
  const e = S.bewerteVersuch(versuch(1, "a", [4, 4, 4], [3, 3, 3])); // 12 vs 9, d=3
  assert.deepEqual([e.selbstSumme, e.fremdSumme, e.bonus, e.punkte], [12, 9, 1, 10]);
});

test("[REQ-DUEL-001] Ungültige Bewertung (außerhalb 0–5, nicht ganzzahlig, fehlend) wirft", () => {
  assert.throws(() => S.bewerteVersuch(versuch(1, "a", [6, 0, 0], [0, 0, 0])));
  assert.throws(() => S.bewerteVersuch(versuch(1, "a", [-1, 0, 0], [0, 0, 0])));
  assert.throws(() => S.bewerteVersuch(versuch(1, "a", [1.5, 0, 0], [0, 0, 0])));
  assert.throws(() => S.bewerteVersuch({ selbst: r(1, 1, 1) }));
});

test("[REQ-DUEL-001] Je Person und Karte zählt der beste Versuch", () => {
  const vs = [
    versuch(3, "a", [2, 2, 2], [2, 2, 2]), // 6+3 = 9
    versuch(3, "a", [5, 5, 5], [5, 5, 5]), // 18
    versuch(3, "a", [1, 1, 1], [1, 1, 1]), // 6
    versuch(3, "b", [0, 0, 0], [1, 1, 1]), // d=3 → 3+1 = 4
  ];
  const best = S.besteKartenpunkte(vs, "a");
  assert.equal(best.get(3), 18);
  assert.equal(best.size, 1);
  assert.equal(S.besteKartenpunkte(vs, "b").get(3), 4);
});

test("[REQ-DUEL-001] Manöverpunkte: Top-5 von 7 Karten", () => {
  const vs = [1, 2, 3, 4, 5, 6, 7].map((k) => versuch(k, "a", [k % 6, 0, 0], [0, 0, 0]));
  // fremd=0, selbst=k%6 → d=k%6; Bonus 3 bei d≤2, 1 bei ≤4, sonst 0 ; Karten 1..7 → d=1,2,3,4,5,0,1
  const m = S.manoeverPunkte(vs, "a");
  assert.equal(m.gewertet.length, 5);
  assert.equal(m.kartenAnzahl, 7);
  assert.equal(m.unterMin, false);
  assert.equal(m.punkte, 3 + 3 + 3 + 3 + 1); // 4×(+3) + 1×(+1) beste
});

test("[REQ-DUEL-001] Weniger als 5 Karten: zählt was da ist, mit Warnung", () => {
  const vs = [versuch(1, "a", [5, 5, 5], [5, 5, 5]), versuch(2, "a", [5, 5, 5], [5, 5, 5])];
  const m = S.manoeverPunkte(vs, "a");
  assert.equal(m.punkte, 36);
  assert.equal(m.unterMin, true);
  assert.equal(S.manoeverPunkte([], "a").punkte, 0);
  assert.equal(S.manoeverPunkte([], "a").unterMin, true);
});

test("[REQ-DUEL-002] Landgang: Seilziehen 3 je gewonnener Runde", () => {
  const l = { seilziehen: [{ gewinner: "a" }, { gewinner: "a" }, { gewinner: "b" }, { gewinner: null }] };
  assert.equal(S.landgangPunkte(l, "a").seilziehen, 6);
  assert.equal(S.landgangPunkte(l, "b").seilziehen, 3);
  assert.equal(S.landgangPunkte(l, "c").seilziehen, 0);
});

test("[REQ-DUEL-002] Landgang: Müll 5/3/1 + 2 für skurrilsten Fund", () => {
  const l = { muell: { platz1: "a", platz2: "b", platz3: "c", skurril: { person: "b", fund: "Flip-Flop" } } };
  assert.equal(S.landgangPunkte(l, "a").muell, 5);
  assert.equal(S.landgangPunkte(l, "b").muell, 3 + 2);
  assert.equal(S.landgangPunkte(l, "c").muell, 1);
  assert.equal(S.landgangPunkte(l, "d").muell, 0);
});

test("[REQ-DUEL-002] Landgang: Geocaching 2 je Cache; leere/fehlende Daten sind 0", () => {
  assert.equal(S.landgangPunkte({ geocache: { a: 3 } }, "a").geocache, 6);
  assert.equal(S.landgangPunkte({}, "a").gesamt, 0);
  assert.equal(S.landgangPunkte(undefined, "a").gesamt, 0);
  const l = { seilziehen: [{ gewinner: "a" }], muell: { platz1: "a" }, geocache: { a: 1 } };
  assert.equal(S.landgangPunkte(l, "a").gesamt, 3 + 5 + 2);
});

test("[REQ-DUEL-001] Rangliste: Gesamt = Manöver + Landgang, absteigend, Gleichstand = gleicher Platz", () => {
  const crew = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "d", name: "D" }];
  const vs = [
    versuch(1, "a", [5, 5, 5], [5, 5, 5]), // 18
    versuch(1, "b", [5, 5, 5], [5, 5, 5]), // 18 → Gleichstand mit a
    versuch(1, "c", [0, 0, 0], [1, 1, 1]), // d=3 → 3+1 = 4
  ];
  const landgang = { geocache: { c: 1 } }; // c: 4+2 = 6
  const rl = S.rangliste(crew, vs, landgang);
  assert.deepEqual(rl.map((z: { id: string }) => z.id), ["a", "b", "c", "d"]);
  assert.deepEqual(rl.map((z: { platz: number }) => z.platz), [1, 1, 3, 4]);
  assert.equal(rl[2].gesamt, 6);
  assert.equal(rl[0].unterMin, true);
});

test("[REQ-DUEL-001] Rangliste: leere Crew und 11 Personen funktionieren", () => {
  assert.deepEqual(S.rangliste([], [], {}), []);
  const crew = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const rl = S.rangliste(crew, [], {});
  assert.equal(rl.length, 11);
  assert.ok(rl.every((z: { platz: number }) => z.platz === 1));
});

test("[REQ-DUEL-002] Skurrilster Fund: +2 nur mit Person UND Freitext-Fund (Teilangaben ergeben 0)", () => {
  const mit = (skurril: unknown) => S.landgangPunkte({ muell: { skurril } }, "a").muell;
  assert.equal(mit({ person: "a", fund: "Flip-Flop" }), 2);
  assert.equal(mit({ person: "a", fund: "" }), 0);
  assert.equal(mit({ person: "a", fund: "   " }), 0);
  assert.equal(mit({ person: null, fund: "Schuh" }), 0);
  assert.equal(mit(null), 0);
  assert.equal(S.landgangStatus({ muell: { skurril: { person: "a", fund: "" } } }).muell, false);
  assert.equal(S.landgangStatus({ muell: { skurril: { person: null, fund: "x" } } }).muell, false);
  assert.equal(S.landgangStatus({ muell: { skurril: { person: "a", fund: "x" } } }).muell, true);
});
