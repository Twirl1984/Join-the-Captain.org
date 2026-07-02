// backtest.ts — misst die Güte der Unwetterwarnungen gegen historische Wahrheit.
//
// Ein LabeledSample verknüpft, was das Modell VORHERSAGTE (metrics) mit dem, was
// WIRKLICH eintrat (observed, aus ERA5-Archiv / weather_code). Aus vielen solchen
// Paaren berechnen wir pro Warn-Art und pro Sensitivitäts-Stufe die Confusion-
// Matrix und die Raten:
//
//   TP  gewarnt   & Unwetter trat ein        (richtig gewarnt)
//   FP  gewarnt   & KEIN Unwetter            (Fehlalarm)
//   FN  NICHT gew.& Unwetter trat ein        (verpasste Warnung — teuerste)
//   TN  NICHT gew.& kein Unwetter            (richtig geschwiegen)
//
//   FPR = FP/(FP+TN)   Fehlalarm-Rate (Anteil harmloser Lagen mit Alarm)
//   FNR = FN/(FN+TP)   Verpasser-Rate (Anteil echter Unwetter ohne Warnung)
//   Precision = TP/(TP+FP)   wie viele Warnungen berechtigt waren
//   Recall    = TP/(TP+FN) = 1 - FNR   wie viele Unwetter erwischt wurden
//
// Der Sweep über sensitivity erzeugt eine ROC-artige Kurve; recommendSensitivity
// wählt daraus einen Betriebspunkt nach Kostenabwägung (FN teurer als FP).

import { classify, WARNING_KINDS, type WarningKind, type WeatherMetrics } from "./warnings";

export interface LabeledSample {
  point_id?: string;
  valid_at?: string;
  /** Was das Modell vorhersagte (Warnungs-Input). */
  metrics: WeatherMetrics;
  /** Was laut Wahrheitsquelle wirklich eintrat, je Warn-Art. */
  observed: Record<WarningKind, boolean>;
  /** Beobachtete Böe (kn) — gewichtet die Schwere einer verpassten Warnung (FN). */
  observed_gust_kn?: number;
}

export interface Confusion {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export interface Rates {
  fpr: number; // Fehlalarm-Rate
  fnr: number; // Verpasser-Rate
  precision: number;
  recall: number;
  n: number;
}

const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function ratesFor(c: Confusion): Rates {
  return {
    fpr: safeDiv(c.fp, c.fp + c.tn),
    fnr: safeDiv(c.fn, c.fn + c.tp),
    precision: safeDiv(c.tp, c.tp + c.fp),
    recall: safeDiv(c.tp, c.tp + c.fn),
    n: c.tp + c.fp + c.fn + c.tn,
  };
}

/** Confusion-Matrix einer Warn-Art bei gegebener Sensitivität. */
export function confusionFor(
  samples: LabeledSample[],
  kind: WarningKind,
  sensitivity: number,
): Confusion {
  const c: Confusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const s of samples) {
    const predicted = classify(s.metrics, sensitivity)[kind];
    const actual = s.observed[kind];
    if (predicted && actual) c.tp++;
    else if (predicted && !actual) c.fp++;
    else if (!predicted && actual) c.fn++;
    else c.tn++;
  }
  return c;
}

/** Confusion über ALLE Warn-Arten zusammengefasst (Positive = irgendeine Warnung). */
export function confusionCombined(samples: LabeledSample[], sensitivity: number): Confusion {
  const c: Confusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const s of samples) {
    const flags = classify(s.metrics, sensitivity);
    const predicted = WARNING_KINDS.some((k) => flags[k]);
    const actual = WARNING_KINDS.some((k) => s.observed[k]);
    if (predicted && actual) c.tp++;
    else if (predicted && !actual) c.fp++;
    else if (!predicted && actual) c.fn++;
    else c.tn++;
  }
  return c;
}

export interface SweepRow {
  sensitivity: number;
  perKind: Record<WarningKind, { confusion: Confusion; rates: Rates }>;
  combined: { confusion: Confusion; rates: Rates };
}

/** Sensitivitäts-Sweep (Default 0,0.05,…,1) → Tabelle für Kurve & Empfehlung. */
export function sweep(
  samples: LabeledSample[],
  sensitivities: number[] = defaultGrid(),
): SweepRow[] {
  return sensitivities.map((sensitivity) => {
    const perKind = {} as Record<WarningKind, { confusion: Confusion; rates: Rates }>;
    for (const k of WARNING_KINDS) {
      const confusion = confusionFor(samples, k, sensitivity);
      perKind[k] = { confusion, rates: ratesFor(confusion) };
    }
    const cc = confusionCombined(samples, sensitivity);
    return { sensitivity, perKind, combined: { confusion: cc, rates: ratesFor(cc) } };
  });
}

export function defaultGrid(step = 0.05): number[] {
  const g: number[] = [];
  for (let s = 0; s <= 1.0001; s += step) g.push(Math.round(s * 100) / 100);
  return g;
}

/** Schweregewicht einer verpassten Warnung: mit der beobachteten Böe steigend. */
function fnSeverityWeight(s: LabeledSample): number {
  const g = s.observed_gust_kn ?? 0;
  return g > 0 ? Math.max(1, g / 34) : 1; // 34 kn = 1× · 68 kn ≈ 2× · 51 kn ≈ 1.5×
}

/**
 * Kosten bei gegebener Sensitivität: fpCost·FP + fnCost·Σ(FN-Schweregewicht).
 * weightFnBySeverity gewichtet jeden verpassten Fall mit der Windstärke —
 * eine verpasste schwere Bö wiegt mehr als eine verpasste 34-kn-Bö.
 */
export function costFor(
  samples: LabeledSample[],
  kind: WarningKind | "combined",
  sensitivity: number,
  opts: { fnCost: number; fpCost: number; weightFnBySeverity?: boolean },
): { fp: number; fn: number; cost: number } {
  let fp = 0;
  let fn = 0;
  let cost = 0;
  for (const s of samples) {
    const flags = classify(s.metrics, sensitivity);
    const predicted = kind === "combined" ? WARNING_KINDS.some((k) => flags[k]) : flags[kind];
    const actual = kind === "combined" ? WARNING_KINDS.some((k) => s.observed[k]) : s.observed[kind];
    if (!predicted && actual) {
      fn++;
      cost += opts.fnCost * (opts.weightFnBySeverity ? fnSeverityWeight(s) : 1);
    } else if (predicted && !actual) {
      fp++;
      cost += opts.fpCost;
    }
  }
  return { fp, fn, cost };
}

export interface RecommendOptions {
  /** relative Kosten einer verpassten Warnung ggü. einem Fehlalarm (FN teurer). */
  fnCost?: number;
  fpCost?: number;
  /** harte Obergrenze für die Verpasser-Rate (Sicherheits-Constraint). */
  maxFnr?: number;
  kind?: WarningKind | "combined";
  /** FN nach beobachteter Windstärke gewichten (Default an). */
  weightFnBySeverity?: boolean;
}

/**
 * Empfiehlt einen Betriebspunkt (sensitivity) durch Minimierung der erwarteten
 * (windstärke-gewichteten) Kosten, optional unter der Nebenbedingung FNR ≤ maxFnr.
 * Default: FN 5× teurer als FP (Sicherheit), FNR-Deckel 0.05, Schweregewichtung an.
 */
export function recommendSensitivity(
  samples: LabeledSample[],
  opts: RecommendOptions = {},
): { sensitivity: number; rates: Rates; reason: string } {
  const { fnCost = 5, fpCost = 1, maxFnr = 0.05, kind = "combined", weightFnBySeverity = true } = opts;
  const rows = sweep(samples);
  const rateOf = (row: SweepRow) => (kind === "combined" ? row.combined.rates : row.perKind[kind].rates);

  const feasible = rows.filter((r) => rateOf(r).fnr <= maxFnr);
  const pool = feasible.length ? feasible : rows;
  let best = pool[0];
  let bestCost = Infinity;
  for (const r of pool) {
    const { cost } = costFor(samples, kind, r.sensitivity, { fnCost, fpCost, weightFnBySeverity });
    if (cost < bestCost) {
      bestCost = cost;
      best = r;
    }
  }
  const reason = feasible.length
    ? `windstärke-gewichtetes Kosten-Minimum (FN×${fnCost}, FP×${fpCost}) unter FNR ≤ ${maxFnr}`
    : `FNR ≤ ${maxFnr} nirgends erreichbar → gewichtetes Kosten-Minimum (FN×${fnCost}, FP×${fpCost})`;
  return { sensitivity: best.sensitivity, rates: rateOf(best), reason };
}
