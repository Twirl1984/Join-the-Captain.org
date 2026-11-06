// Six-Sigma/DOE: reduzierter, bewiesener Testplan statt 46.656 Kombinationen (alles deterministisch).
import { test } from "node:test";
import { strict as assert } from "node:assert";
import * as S from "../../../../public/toern-duell/scoring.js";
import { kartenPunkte, type Bew } from "./support/orakel";
import {
  MUTANTEN, aequivalenzklassen, aufteilung, aufteilungGleich, getoetet, grenzlaeufe, kernPlan, l25, laeufeMittelwert16, teilfaktoriell16, vollFaktoriell,
} from "./support/doe";

const summe = (b: Bew) => b.kommunikation + b.crew + b.steuerung;

// ── 1. Der Plan selbst ist ein gültiges DOE (Eigenschaften werden gemessen, nicht behauptet) ──
test("[REQ-DUEL-009] DOE: L25 ist ausgewogen und orthogonal (jede Stufe 5×, jedes Stufenpaar je Faktorpaar genau 1×)", () => {
  const z = l25();
  assert.equal(z.length, 25);
  for (let a = 0; a < 6; a++) {
    for (let lv = 0; lv < 5; lv++) assert.equal(z.filter((r) => r[a] === lv).length, 5, `Faktor ${a} Stufe ${lv}`);
    for (let b = a + 1; b < 6; b++) {
      const paare = new Set(z.map((r) => `${r[a]}-${r[b]}`));
      assert.equal(paare.size, 25, `Faktoren ${a}/${b} nicht orthogonal`);
    }
  }
});

test("[REQ-DUEL-009] DOE: 2^(6-2) ist ausgewogen (8×2, 8×3), paarweise 4× je Kombination, Mittelwert exakt 2,5", () => {
  const z = teilfaktoriell16();
  assert.equal(z.length, 16);
  for (let a = 0; a < 6; a++) {
    assert.equal(z.filter((r) => r[a] === 1).length, 8);
    for (let b = a + 1; b < 6; b++) for (const x of [-1, 1]) for (const y of [-1, 1]) {
      assert.equal(z.filter((r) => r[a] === x && r[b] === y).length, 4, `Faktoren ${a}/${b} (${x},${y})`);
    }
  }
  const laeufe = laeufeMittelwert16();
  const alle = laeufe.flatMap((l) => [l.selbst.kommunikation, l.selbst.crew, l.selbst.steuerung, l.fremd.kommunikation, l.fremd.crew, l.fremd.steuerung]);
  assert.equal(alle.reduce((a, b) => a + b, 0) / alle.length, 2.5); // Mittelwert je Faktor
  assert.equal(laeufe.reduce((a, l) => a + summe(l.selbst), 0), 16 * 7.5); // Σ Selbstsumme = 120
  assert.equal(laeufe.reduce((a, l) => a + summe(l.fremd), 0), 16 * 7.5);
});

test("[REQ-DUEL-009] DOE: Kern-Plan ist klein (<100 Läufe, >99,8 % weniger als vollfaktoriell)", () => {
  const n = kernPlan().length;
  assert.ok(n < 100, `${n} Läufe`);
  assert.ok(1 - n / 46_656 > 0.998);
});

// ── 2. Kern-Plan gegen Orakel UND gegen die App-Logik ───────────────────────────────────────
test("[REQ-DUEL-009] DOE-Kernplan: App-Logik = Orakel in jedem Lauf (Summen, Bonus, Punkte)", () => {
  for (const l of kernPlan()) {
    const ist = S.bewerteVersuch({ selbst: l.selbst, fremd: l.fremd });
    const soll = kartenPunkte(l.selbst, l.fremd);
    assert.deepEqual([ist.selbstSumme, ist.fremdSumme, ist.bonus, ist.punkte], [soll.s, soll.f, soll.bonus, soll.punkte], l.quelle);
  }
});

// ── 3. Äquivalenzklassen + Mittelwert (Golden von Hand) ────────────────────────────────────
// Σ Fremdsumme über das 16×16-Gitter = 16 · (0+…+15) = 1920.
// Σ Bonus = 3·(16 + 2·15 + 2·14) + 1·(2·13 + 2·12) = 3·74 + 50 = 272 → Σ Punkte = 2192, Mittel = 8,5625.
test("[REQ-DUEL-009] Äquivalenzklassen: alle 256 (S,F) = Orakel; Σ Punkte = 2192, Mittelwert 8,5625; Min 0, Max 18", () => {
  const klassen = aequivalenzklassen();
  assert.equal(klassen.length, 256);
  let sum = 0, min = 99, max = -1;
  for (const l of klassen) {
    const ist = S.bewerteVersuch({ selbst: l.selbst, fremd: l.fremd });
    assert.equal(ist.punkte, kartenPunkte(l.selbst, l.fremd).punkte);
    sum += ist.punkte; min = Math.min(min, ist.punkte); max = Math.max(max, ist.punkte);
  }
  assert.equal(sum, 2192);
  assert.equal(sum / 256, 8.5625);
  assert.deepEqual([min, max], [0, 18]);
});

test("[REQ-DUEL-009] Äquivalenz belegt: dieselbe (S,F) mit anderer Kategorien-Aufteilung ergibt dieselben Punkte", () => {
  for (let s = 0; s <= 15; s++) for (let f = 0; f <= 15; f++) {
    const a = S.bewerteVersuch({ selbst: aufteilung(s), fremd: aufteilung(f) }).punkte;
    const b = S.bewerteVersuch({ selbst: aufteilungGleich(s), fremd: aufteilungGleich(f) }).punkte;
    const c = S.bewerteVersuch({ selbst: aufteilungGleich(s), fremd: aufteilung(f) }).punkte;
    assert.ok(a === b && b === c, `S=${s} F=${f}`);
  }
});

// ── 4. Randfälle mit Literal-Sollwerten (von Hand) ─────────────────────────────────────────
test("[REQ-DUEL-009] Grenzwerte/Randfälle gegen handgerechnete Literale (S, F → Punkte)", () => {
  const soll: [number, number, number][] = [
    [0, 0, 3], [15, 15, 18], [0, 15, 15], [15, 0, 0], // Ecken: d=0 / d=15
    [7, 9, 12], [6, 9, 10], [5, 9, 10], [4, 9, 9],     // d=2 | 3 | 4 | 5 bei F=9
    [11, 9, 12], [12, 9, 10], [13, 9, 10], [14, 9, 9], // dieselben Kanten nach oben
    [8, 7, 10], [7, 7, 10],                            // Mittelwert-Nähe
    [2, 0, 3], [3, 0, 1], [4, 0, 1], [5, 0, 0],        // F = 0
    [13, 15, 18], [12, 15, 16], [11, 15, 16], [10, 15, 15], // F = 15
  ];
  for (const [s, f, p] of soll) {
    assert.equal(S.bewerteVersuch({ selbst: aufteilung(s), fremd: aufteilungGleich(f) }).punkte, p, `S=${s} F=${f}`);
  }
});

test("[REQ-DUEL-009] Grenzläufe decken d=2|3 und 4|5 in beide Richtungen und F=0/15 ab", () => {
  const ds = new Set(grenzlaeufe().map((l) => Math.abs(summe(l.selbst) - summe(l.fremd))));
  for (const d of [0, 1, 2, 3, 4, 5, 6]) assert.ok(ds.has(d), `d=${d}`);
  const richtungen = new Set(grenzlaeufe().filter((l) => Math.abs(summe(l.selbst) - summe(l.fremd)) === 3).map((l) => Math.sign(summe(l.selbst) - summe(l.fremd))));
  assert.deepEqual([...richtungen].sort(), [-1, 1]);
});

// ── 5. Beweis der Schärfe: Mutationsanalyse (Plan so scharf wie Vollfaktoriell) ──────────────
test("[REQ-DUEL-009] Mutationsanalyse: der Kernplan tötet jeden Mutanten, den der Vollplan tötet (16 Mutanten)", () => {
  const voll = [...vollFaktoriell()];
  assert.equal(voll.length, 46_656);
  const kern = kernPlan();
  const lebendVoll: string[] = [], lebendKern: string[] = [];
  for (const m of MUTANTEN) {
    const v = getoetet(m, voll), k = getoetet(m, kern);
    if (!v) lebendVoll.push(m);
    if (!k) lebendKern.push(m);
    assert.ok(!v || k, `Kernplan übersieht Mutant „${m}“, den der Vollplan findet`);
  }
  assert.deepEqual(lebendVoll, [], `Mutanten ohne Wirkung: ${lebendVoll}`); // jeder Mutant ist wirklich ein Fehler
  assert.deepEqual(lebendKern, []);
});

test("[REQ-DUEL-009] Mutationsanalyse: Einzelbausteine sind nötig (ohne Grenzläufe/L25 überlebt mindestens ein Mutant)", () => {
  const nurMittel = laeufeMittelwert16();
  assert.ok(MUTANTEN.some((m) => !getoetet(m, nurMittel)), "Mittelwert-Plan allein wäre bereits ausreichend – Plan überdimensioniert");
});

// ── 6. Referenzlauf (optional, volle 46.656) ───────────────────────────────────────────────
test("[REQ-DUEL-009] Referenzlauf vollfaktoriell: alle 46.656 = Orakel (nur mit DUELL_EXHAUSTIV=1)", { skip: process.env.DUELL_EXHAUSTIV !== "1" }, () => {
  let n = 0;
  for (const l of vollFaktoriell()) {
    assert.equal(S.bewerteVersuch({ selbst: l.selbst, fremd: l.fremd }).punkte, kartenPunkte(l.selbst, l.fremd).punkte);
    n++;
  }
  assert.equal(n, 46_656);
});
