// warnings.ts — Unwetter-Klassifikation mit einstellbarer Risiko-Aversion.
//
// Aus rohen Wettergrößen (Böen, CAPE, Wellenhöhe) entstehen drei Warn-Flags:
// Sturm, Gewitter, hohe Welle. Der Schwellenwert jeder Warnung wird von einem
// Regler `sensitivity` (0..1) verschoben — das ist der "Risiko-Schieberegler"
// des Users.
//
//   sensitivity → 0  = risikofreudig: hohe Schwellen, es wird nur bei klarer
//                      Gefahr gewarnt → WENIGE Fehlalarme (FP), aber MEHR
//                      verpasste Unwetter (FN).
//   sensitivity → 1  = sehr vorsichtig: niedrige Schwellen, früh gewarnt →
//                      WENIGE verpasste Unwetter (FN), aber MEHR Fehlalarme (FP).
//   sensitivity = 0.5 (Default) reproduziert die bisherigen Schwellen
//                      (Böen ≥ 34 kn = 8 Bft · CAPE ≥ 800 J/kg · Welle ≥ 2.25 m).
//
// FP/FN im Segel-Kontext (siehe docs/weather-test-plan.md):
//   FP = Fehlalarm: gewarnt, aber es passiert nichts → Kosten: unnötig
//        verschobener/abgesagter Törn, Warnmüdigkeit, Vertrauensverlust.
//   FN = verpasste Warnung: NICHT gewarnt, aber Unwetter tritt ein → Kosten:
//        Crew ungewarnt in Gefahr. Die teuerste Fehlerart — Sicherheit zuerst.
// Deshalb ist der Default konservativ (eher FP als FN), und der Regler erlaubt
// erfahrenen Skippern, in Richtung weniger Fehlalarme zu justieren.

export type WarningKind = "sturm" | "gewitter" | "welle";

export const WARNING_KINDS: WarningKind[] = ["sturm", "gewitter", "welle"];

export const WARNING_LABEL: Record<WarningKind, string> = {
  sturm: "Sturm (≥8 Bft)",
  gewitter: "Gewitter",
  welle: "Hohe Welle",
};

/** Rohe Wettergrößen an einem Punkt/Zeitpunkt. */
export interface WeatherMetrics {
  gust_kn?: number; // Böen in Knoten
  wind_speed_kn?: number; // Fallback, falls keine Böen vorliegen
  cape?: number; // J/kg (Gewitter-Proxy)
  wave_height_m?: number | null; // Wellenhöhe
}

/** Ergebnis der Klassifikation: warnt / warnt nicht je Art. */
export interface WarningFlags {
  sturm: boolean;
  gewitter: boolean;
  welle: boolean;
}

/** Wirksame Schwellen bei gegebener Sensitivität. */
export interface WarningThresholds {
  gust_kn: number;
  cape: number;
  wave_m: number;
}

// Mittelpunkt des Reglers = Kalibrierung (trifft die etablierten MVP-Schwellen).
export const DEFAULT_SENSITIVITY = 0.5;

// Produktseitiger SICHERER Default für Slider/API: bewusst vorsichtiger als der
// Mittelpunkt, weil der Backtest zeigt, dass die Modell-Böe echte Stürme stark
// unterschätzt (bei 0.5 ~77 % verpasste Stürme). Siehe docs/weather-backtest-results.md.
export const RECOMMENDED_SENSITIVITY = 0.75;

// Endpunkte je Größe: [Wert bei sensitivity=0, Wert bei sensitivity=1].
// So gewählt, dass der Mittelwert (0.5) die etablierten MVP-Schwellen trifft.
const GUST_KN: [number, number] = [40, 28]; // 0.5 → 34 kn (8 Bft)
const CAPE: [number, number] = [1500, 100]; // 0.5 → 800 J/kg
const WAVE_M: [number, number] = [3.0, 1.5]; // 0.5 → 2.25 m

// Sicherheits-Floor: ab schwerem Sturm (9 Bft, Böen ≥ 47 kn) wird IMMER gewarnt —
// unabhängig vom Regler. Seltene, gefährliche Ereignisse (Downbursts, Wirbel-
// stürme) dürfen von keiner risikofreudigen Einstellung unterdrückt werden.
export const SEVERE_GUST_KN = 47;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Beaufort-Grenzen (untere kn-Schwelle je Stärke 1..12).
const BFT_MIN_KN = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];

/** Windstärke in Beaufort (0..12) aus Knoten. */
export function beaufort(kn: number): number {
  let b = 0;
  for (let i = 0; i < BFT_MIN_KN.length; i++) if (kn >= BFT_MIN_KN[i]) b = i + 1;
  return b;
}

/** Sturm-Schweregrad für Anzeige & Kostengewichtung. */
export function stormSeverity(gustKn: number): { bft: number; label: string; severe: boolean } {
  const bft = beaufort(gustKn);
  const label =
    bft >= 12 ? "Orkan" : bft >= 10 ? "schwerer Sturm" : bft >= 8 ? "Sturm" : bft >= 6 ? "starker Wind" : "Wind";
  return { bft, label, severe: gustKn >= SEVERE_GUST_KN };
}

/** Schwellen für eine Sensitivität (linear interpoliert zwischen den Endpunkten). */
export function thresholdsFor(sensitivity: number = DEFAULT_SENSITIVITY): WarningThresholds {
  const s = clamp01(sensitivity);
  const lerp = ([a, b]: [number, number]) => a + (b - a) * s;
  return { gust_kn: lerp(GUST_KN), cape: lerp(CAPE), wave_m: lerp(WAVE_M) };
}

/**
 * Klassifiziert rohe Wettergrößen in Warn-Flags bei gegebener Sensitivität.
 * Höhere Sensitivität ⇒ niedrigere Schwellen ⇒ mehr Warnungen.
 */
export function classify(
  m: WeatherMetrics,
  sensitivity: number = DEFAULT_SENSITIVITY,
): WarningFlags {
  const t = thresholdsFor(sensitivity);
  const gust = m.gust_kn ?? m.wind_speed_kn ?? 0;
  const cape = m.cape ?? 0;
  const wave = m.wave_height_m ?? 0;
  return {
    // Sicherheits-Floor: schwere Stürme lösen unabhängig vom Regler aus.
    sturm: gust >= t.gust_kn || gust >= SEVERE_GUST_KN,
    gewitter: cape >= t.cape,
    welle: wave >= t.wave_m,
  };
}

/** Liste der ausgelösten Warn-Arten (für Anzeige/Backtest). */
export function activeWarnings(
  m: WeatherMetrics,
  sensitivity: number = DEFAULT_SENSITIVITY,
): WarningKind[] {
  const f = classify(m, sensitivity);
  return WARNING_KINDS.filter((k) => f[k]);
}
