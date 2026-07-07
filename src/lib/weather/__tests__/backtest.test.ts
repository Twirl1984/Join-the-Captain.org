// Unit-Tests für die FP/FN-Backtest-Metrik (backtest.ts).
// Deterministische Mini-Fixture mit von Hand nachgerechneter Confusion-Matrix.
// Lauf: node --import tsx --test src/lib/weather/__tests__/backtest.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confusionFor,
  ratesFor,
  sweep,
  recommendSensitivity,
  costFor,
  type LabeledSample,
} from "../backtest";

// Nur Sturm-Dimension aktiv (cape/wave lösen nie aus) → combined == sturm.
const S = (gust: number, sturm: boolean): LabeledSample => ({
  metrics: { gust_kn: gust, cape: 0, wave_height_m: 0 },
  observed: { sturm, gewitter: false, welle: false },
});

// A:45/echt  B:30/harmlos  C:36/echt  D:20/harmlos
const FIX: LabeledSample[] = [S(45, true), S(30, false), S(36, true), S(20, false)];

test("Confusion bei s=0 (Schwelle 40 kn): C (36) wird verpasst → 1 FN", () => {
  const c = confusionFor(FIX, "sturm", 0);
  assert.deepEqual(c, { tp: 1, fp: 0, fn: 1, tn: 2 });
  const r = ratesFor(c);
  assert.equal(r.fnr, 0.5); // 1 von 2 echten Stürmen verpasst
  assert.equal(r.fpr, 0);
});

test("Confusion bei s=0.5 (Schwelle 34 kn): alles korrekt", () => {
  const c = confusionFor(FIX, "sturm", 0.5);
  assert.deepEqual(c, { tp: 2, fp: 0, fn: 0, tn: 2 });
  const r = ratesFor(c);
  assert.equal(r.fnr, 0);
  assert.equal(r.fpr, 0);
});

test("Confusion bei s=1 (Schwelle 28 kn): B (30) wird Fehlalarm → 1 FP", () => {
  const c = confusionFor(FIX, "sturm", 1);
  assert.deepEqual(c, { tp: 2, fp: 1, fn: 0, tn: 1 });
  const r = ratesFor(c);
  assert.equal(r.fnr, 0);
  assert.equal(r.fpr, 0.5);
});

test("Sweep: FNR fällt monoton, FPR steigt monoton mit der Sensitivität", () => {
  const rows = sweep(FIX);
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].combined.rates;
    const cur = rows[i].combined.rates;
    assert.ok(cur.fnr <= prev.fnr + 1e-9, `FNR nicht monoton fallend bei i=${i}`);
    assert.ok(cur.fpr >= prev.fpr - 1e-9, `FPR nicht monoton steigend bei i=${i}`);
  }
});

test("recommendSensitivity hält FNR-Deckel ein und minimiert Kosten (FN teurer)", () => {
  const rec = recommendSensitivity(FIX, { maxFnr: 0.05, fnCost: 5, fpCost: 1 });
  assert.ok(rec.rates.fnr <= 0.05, "Empfehlung verletzt FNR-Deckel");
  // Bei dieser Fixture ist s=0.5 der günstigste zulässige Punkt (0 FP, 0 FN).
  assert.equal(rec.rates.fpr, 0);
  assert.equal(rec.rates.fnr, 0);
});

test("costFor: verpasste schwere Bö kostet mehr als verpasste 34-kn-Bö", () => {
  // Beide Fälle werden verpasst (Vorhersage-Bö 10 kn → nie Alarm), aber die
  // Wahrheit war Sturm — einmal 34 kn, einmal 68 kn.
  const missed = (obsGust: number): LabeledSample => ({
    metrics: { gust_kn: 10, cape: 0, wave_height_m: 0 },
    observed: { sturm: true, gewitter: false, welle: false },
    observed_gust_kn: obsGust,
  });
  const samples = [missed(34), missed(68)];
  const weighted = costFor(samples, "sturm", 0.5, { fnCost: 1, fpCost: 1, weightFnBySeverity: true });
  const flat = costFor(samples, "sturm", 0.5, { fnCost: 1, fpCost: 1, weightFnBySeverity: false });
  assert.equal(weighted.fn, 2);
  assert.equal(flat.cost, 2); // 2 verpasste × 1
  assert.equal(weighted.cost, 3); // 1×(34/34) + 1×(68/34)=2 → 3
  assert.ok(weighted.cost > flat.cost, "Schweregewichtung erhöht die Kosten");
});

test("ratesFor ist robust gegen leere Nenner (keine NaN)", () => {
  const r = ratesFor({ tp: 0, fp: 0, fn: 0, tn: 0 });
  assert.equal(r.fpr, 0);
  assert.equal(r.fnr, 0);
  assert.equal(r.precision, 0);
  assert.equal(r.recall, 0);
});
