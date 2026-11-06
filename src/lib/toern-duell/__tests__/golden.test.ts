// Golden-Standard-Tests: App-Logik (scoring.js, state.js) gegen das unabhängige Orakel
// und gegen von Hand ausgerechnete Sollwerte. Alles deterministisch (feste Seeds).
import { test } from "node:test";
import { strict as assert } from "node:assert";
import fc from "fast-check";
import * as S from "../../../../public/toern-duell/scoring.js";
import * as St from "../../../../public/toern-duell/state.js";
import * as Db from "../../../../public/toern-duell/store.js";
import { BONUS_NACH_D, kartenPunkte, orakel, prng, referenzSzenario, zufallsSzenario, type Szenario } from "./support/orakel";

const tief = <T>(x: T): T => { Object.values(x as object).forEach((v) => v && typeof v === "object" && tief(v)); return Object.freeze(x); };
const kopie = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ── 1. Hand gerechneter Golden-Standard ─────────────────────────────────────
//
//  Kartenpunkte = Fremd + Bonus; d = |Selbst − Fremd|; d≤2 → +3, d≤4 → +1, sonst 0.
//  A (Karten 1..7, Karte 2 dreimal):
//    K1 12/12 d0 → 12+3 = 15     K2 15/9 d6 → 9 | 12/14 d2 → 14+3 = 17 | 0/0 → 3 ⇒ bester 17
//    K3  9/13 d4 → 13+1 = 14     K4 15/15 d0 → 18     K5 6/12 d6 → 12
//    K6  3/2  d1 → 2+3  = 5      K7 10/6  d4 → 6+1  = 7
//    Punkte [15,17,14,18,12,5,7] → Top-5 = 18+17+15+14+12 = 76
//  B (3 Karten): K10 9/9 → 12 | K11 10/3 d7 → 3 | K14 7/9 d2 → 12 ⇒ 27, unter Mindestanzahl
//  C: 5 × (15/15 → 18) = 90      D: nichts = 0
//  E: K1..K4 je 18, K5 15/9 d6 → 9, K6 0/4 d4 → 5 ⇒ Top-5 = 72+9 = 81
//  Landgang: Seilziehen A,A,B,C,– → A6 B3 C3 | Müll B5(+2 skurril) A3 D1 | Geocache A1 C2 E3 (×2)
//    A 6+3+2 = 11 · B 3+7 = 10 · C 3+4 = 7 · D 1 · E 6
//  Gesamt: A 87 · B 37 · C 97 · D 1 · E 87 ⇒ Plätze C1, A2, E2 (Gleichstand), B4, D5
test("[REQ-DUEL-001] Golden: von Hand gerechnete Referenz-Crew (5 Personen, alle Regeln)", () => {
  const r = referenzSzenario();
  const rl = S.rangliste(tief(kopie(r.crew)), tief(kopie(r.versuche)), tief(kopie(r.landgang)));
  for (const z of rl) {
    const soll = r.erwartet[z.id];
    assert.deepEqual(
      { manoever: z.manoever, landgang: z.landgang, gesamt: z.gesamt, platz: z.platz, kartenAnzahl: z.kartenAnzahl, unterMin: z.unterMin },
      soll, `Person ${z.id}`,
    );
  }
  assert.deepEqual(rl.map((z: { id: string }) => z.id), ["C", "A", "E", "B", "D"]);
  assert.deepEqual(rl.map((z: { platz: number }) => z.platz), [1, 2, 2, 4, 5]);
});

test("[REQ-DUEL-001] Golden: Kartenpunkte der Referenz-Karten einzeln (A: 15,17,14,18,12,5,7)", () => {
  const r = referenzSzenario();
  const best = S.besteKartenpunkte(r.versuche, "A");
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((k) => best.get(k)), [15, 17, 14, 18, 12, 5, 7]);
  assert.deepEqual([...S.manoeverPunkte(r.versuche, "A").gewertet].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert.equal(S.manoeverPunkte(r.versuche, "A").kartenAnzahl, 7);
});

// ── 2. Kombinatorik: siehe doe.test.ts (DOE/Six Sigma: 81 statt 46.656 Läufe, Mutationsbeweis) ──
test("[REQ-DUEL-001] Bonus-Tabelle d=0..15 gegen Literal-Soll (Grenzen 2|3 und 4|5)", () => {
  const soll = [3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let d = 0; d <= 15; d++) {
    assert.equal(S.ehrlichkeitsBonus(0, d), soll[d], `d=${d}`);
    assert.equal(S.ehrlichkeitsBonus(15, 15 - d), soll[d], `d=${d} (umgekehrt)`);
  }
  assert.deepEqual([...BONUS_NACH_D], soll);
});

// ── 3. Zufalls-Szenarien (Seed) gegen Orakel ────────────────────────────────
function vergleiche(sz: Szenario, label: string) {
  const ist = S.rangliste(kopie(sz.crew), kopie(sz.versuche), kopie(sz.landgang));
  const soll = orakel(sz.crew, sz.versuche, sz.landgang);
  assert.equal(ist.length, sz.crew.length, label);
  for (const z of ist) {
    const o = soll.get(z.id)!;
    assert.deepEqual(
      { manoever: z.manoever, landgang: z.landgang, gesamt: z.gesamt, platz: z.platz, kartenAnzahl: z.kartenAnzahl, unterMin: z.unterMin },
      { manoever: o.manoever, landgang: o.landgang, gesamt: o.gesamt, platz: o.platz, kartenAnzahl: o.kartenAnzahl, unterMin: o.unterMin }, `${label} ${z.id}`);
    // gezählte Karten: Punktewerte = Orakel-Top-5; kein nicht gezählter Wert übertrifft einen gezählten
    const punkte = z.gewertet.map((k: number) => o.kartenPunkte[k]).sort((a: number, b: number) => b - a);
    assert.deepEqual(punkte, o.zaehlendePunkte, `${label} ${z.id} Top-5`);
    const nicht = Object.entries(o.kartenPunkte).filter(([k]) => !z.gewertet.includes(Number(k))).map(([, p]) => p);
    assert.ok(nicht.every((p) => p <= Math.min(...punkte)), `${label} ${z.id} Cutoff`);
  }
  for (let i = 1; i < ist.length; i++) assert.ok(ist[i - 1].gesamt >= ist[i].gesamt, `${label} Sortierung`);
}

test("[REQ-DUEL-001] Zufall (Seeds 1–150, 0–11 Personen, bis 80 Versuche) = Orakel", () => {
  for (let seed = 1; seed <= 150; seed++) vergleiche(zufallsSzenario(seed), `Seed ${seed}`);
});

test("[REQ-DUEL-001] Zufall: Randfälle werden tatsächlich abgedeckt (0, 1, 11 Personen; Gleichstand; alle Bonusstufen)", () => {
  const groessen = new Set<number>(); let gleichstand = 0; const boni = new Set<number>(); let unterMin = 0, uebMin = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const sz = zufallsSzenario(seed);
    groessen.add(sz.crew.length);
    const o = [...orakel(sz.crew, sz.versuche, sz.landgang).values()];
    if (new Set(o.map((x) => x.platz)).size < o.length) gleichstand++;
    o.forEach((x) => (x.unterMin ? unterMin++ : uebMin++));
    sz.versuche.forEach((v) => boni.add(kartenPunkte(v.selbst, v.fremd).bonus));
  }
  assert.ok(groessen.has(0) && groessen.has(1) && groessen.has(11), `Größen: ${[...groessen]}`);
  assert.ok(gleichstand > 3 && unterMin > 10 && uebMin > 10, `Gleichstand ${gleichstand}, unter ${unterMin}, über ${uebMin}`);
  assert.deepEqual([...boni].sort(), [0, 1, 3]);
});

// ── 4. Gleiches Ergebnis über die Zustandsoperationen (state.js) ─────────────
test("[REQ-DUEL-003] Szenario über state.js aufgebaut (addPerson/addVersuch/Landgang-Ops) = Orakel; Zustand gültig", () => {
  for (let seed = 1; seed <= 150; seed++) {
    const sz = zufallsSzenario(seed, 11, 40);
    let s = St.leererZustand();
    let n = 0;
    for (const p of sz.crew) s = St.addPerson(s, p.name, () => p.id).state;
    for (const v of sz.versuche) {
      const r = St.addVersuch(s, { karte: v.karte, rudergaenger: v.rudergaenger, bewerter: v.bewerter, selbst: v.selbst, fremd: v.fremd }, () => `v${++n}`);
      assert.equal(r.fehler, undefined, `Seed ${seed}`);
      s = r.state;
    }
    for (const r of sz.landgang.seilziehen) if (r.gewinner) s = St.addSeilziehenRunde(s, r.gewinner);
    (["platz1", "platz2", "platz3"] as const).forEach((k, i) => { if (sz.landgang.muell[k]) s = St.setMuellPlatz(s, i + 1, sz.landgang.muell[k]); });
    if (sz.landgang.muell.skurril) s = St.setSkurril(s, sz.landgang.muell.skurril.person, sz.landgang.muell.skurril.fund);
    for (const [id, c] of Object.entries(sz.landgang.geocache)) for (let i = 0; i < c; i++) s = St.changeGeocache(s, id, +1);
    assert.equal(Db.istGueltig(s), true, `Seed ${seed} gültig`);
    // seilziehen ohne Gewinner (null) wird über die UI nicht angelegt → hat 0 Punkte; Orakel-Landgang entsprechend filtern
    const lg = { ...sz.landgang, seilziehen: sz.landgang.seilziehen.filter((r) => r.gewinner) };
    vergleiche({ crew: s.crew, versuche: s.versuche, landgang: kopie(lg) }, `State-Seed ${seed}`);
    // Roundtrip Export → Import → identisch gewertet
    const imp = Db.importJson(Db.exportJson(s, () => 0));
    assert.equal(imp.ok, true);
    assert.deepEqual(S.rangliste(imp.state.crew, imp.state.versuche, imp.state.landgang), S.rangliste(s.crew, s.versuche, s.landgang));
  }
});

// ── 5. Determinismus & Reinheit ──────────────────────────────────────────────
test("[REQ-DUEL-001] Deterministisch: gleiche Eingabe → gleiche Ausgabe; Eingaben werden nie verändert (tiefgefroren)", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const sz = tief(zufallsSzenario(seed));
    const a = S.rangliste(sz.crew, sz.versuche, sz.landgang); // wirft bei Mutation (frozen, strict mode)
    const b = S.rangliste(sz.crew, sz.versuche, sz.landgang);
    assert.deepEqual(a, b);
  }
});

test("[REQ-DUEL-001] Reihenfolge-unabhängig: gemischte Versuche/Crew ergeben dieselben Werte je Person", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const sz = zufallsSzenario(seed);
    const z = prng(seed * 7919);
    const mische = <T>(a: T[]) => { const c = [...a]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(z() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };
    const a = S.rangliste(sz.crew, sz.versuche, sz.landgang);
    const b = S.rangliste(mische(sz.crew), mische(sz.versuche), sz.landgang);
    const key = (r: { id: string; manoever: number; landgang: number; gesamt: number; platz: number }[]) => Object.fromEntries(r.map((x) => [x.id, [x.manoever, x.landgang, x.gesamt, x.platz]]));
    assert.deepEqual(key(a), key(b), `Seed ${seed}`);
  }
});

// ── 6. Invarianten (fast-check, fester Seed) ────────────────────────────────
const bewArb = fc.record({ kommunikation: fc.integer({ min: 0, max: 5 }), crew: fc.integer({ min: 0, max: 5 }), steuerung: fc.integer({ min: 0, max: 5 }) });
const FC = { seed: 20260611, numRuns: 150 };

test("[REQ-DUEL-001] Property: Kartenpunkte = Fremd + Bonus, symmetrisch in Selbst/Fremd-Abweichung, ≤ 18", () => {
  fc.assert(fc.property(bewArb, bewArb, (selbst, fremd) => {
    const a = S.bewerteVersuch({ selbst, fremd });
    const b = S.bewerteVersuch({ selbst: fremd, fremd: selbst });
    return a.punkte === a.fremdSumme + a.bonus && a.bonus === b.bonus && a.punkte <= 18 && a.punkte >= 0;
  }), FC);
});

test("[REQ-DUEL-001] Property: Ein zusätzlicher Versuch senkt die Manöverpunkte nie; Top-5-Summe ≤ 90", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 5000 }), fc.integer({ min: 1, max: 15 }), bewArb, bewArb, (seed, karte, selbst, fremd) => {
    const sz = zufallsSzenario(seed, 4, 30);
    if (sz.crew.length < 2) return true;
    const vorher = S.manoeverPunkte(sz.versuche, "p1").punkte;
    const nachher = S.manoeverPunkte([...sz.versuche, { karte, rudergaenger: "p1", bewerter: "p2", selbst, fremd }], "p1").punkte;
    return nachher >= vorher && nachher <= 90;
  }), FC);
});

test("[REQ-DUEL-001] Property: Platz = 1 + Anzahl strikt Besserer; Plätze lückenhaft nach Gleichstand; Gesamt = Manöver + Landgang", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
    const sz = zufallsSzenario(seed);
    const rl = S.rangliste(sz.crew, sz.versuche, sz.landgang);
    return rl.every((z: { gesamt: number; manoever: number; landgang: number; platz: number }) =>
      z.gesamt === z.manoever + z.landgang && z.platz === 1 + rl.filter((q: { gesamt: number }) => q.gesamt > z.gesamt).length);
  }), { ...FC, numRuns: 100 });
});

test("[REQ-DUEL-002] Property: Landgang-Punkte = 3·Runden + (5|3|1 + 2) + 2·Caches, nie negativ", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
    const sz = zufallsSzenario(seed);
    return sz.crew.every((p) => {
      const ist = S.landgangPunkte(sz.landgang, p.id).gesamt;
      const soll = orakel([p], [], sz.landgang).get(p.id)!.landgang;
      return ist === soll && ist >= 0;
    });
  }), { ...FC, numRuns: 100 });
});
