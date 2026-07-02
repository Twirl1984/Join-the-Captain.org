// departure-scan.ts — findet die beste Abfahrtszeit in einem Zeitfenster.
//
// Nutzerfrage: "Charter ab Samstag, Ziel X — Samstag nachmittags auslaufen,
// abends, oder erst Sonntag früh?" Wir rechnen planRoute für jede Kandidaten-
// Abfahrt im Fenster (Raster stepH) und ranken die Slots:
//   1. Slots MIT Unwetterwarnung sind "meiden" — Sicherheit schlägt alles.
//   2. Unter den warnungsfreien gewinnt der komfortabelste (Böen, Welle,
//      Motoranteil, Dauer — in dieser Gewichtung).
// Reine Logik, KEINE I/O: der Wetter-Sampler wird injiziert (im Test gemockt).

import { planRoute, type Waypoint, type SampleForecast, type RoutePlan } from "./route-forecast";
import { DEFAULT_BOAT, type Boat, type SailMode } from "./polar";

export interface DepartureSlot {
  /** Kandidaten-Abfahrt (ISO). */
  departure: string;
  eta: string;
  duration_h: number;
  warnings: string[];
  /** Höchste Böe (kn) und Welle (m) entlang der Route. */
  max_gust_kn: number;
  max_wave_m: number | null;
  /** Anteil der Strecke unter Motor (0..1). */
  motor_share: number;
  /** Kleiner = besser; Slots mit Warnungen bekommen einen großen Malus. */
  score: number;
  /** true = von diesem Slot wird abgeraten (mind. eine Warnung). */
  avoid: boolean;
}

export interface DepartureScan {
  slots: DepartureSlot[];
  /** Bester Slot (kleinster Score) — null, wenn gar kein Kandidat berechenbar. */
  recommended: DepartureSlot | null;
  /** true, wenn ALLE Slots Warnungen haben (dann ist recommended "am wenigsten schlimm"). */
  all_windy: boolean;
}

const WARNING_PENALTY = 1000; // Sicherheits-Malus: dominiert jede Komfort-Differenz

export function scoreSlot(s: Omit<DepartureSlot, "score" | "avoid">): number {
  return (
    s.warnings.length * WARNING_PENALTY +
    s.max_gust_kn +
    (s.max_wave_m ?? 0) * 10 +
    s.motor_share * 5 +
    s.duration_h
  );
}

function slotFromPlan(departure: Date, plan: RoutePlan): DepartureSlot {
  const gusts = plan.legs.map((l) => l.gust_kn);
  const waves = plan.legs.map((l) => l.wave_m).filter((w): w is number => w != null);
  const motorNm = plan.legs.filter((l) => l.mode === "motor").reduce((s, l) => s + l.distance_nm, 0);
  const durationH = (new Date(plan.eta).getTime() - departure.getTime()) / 3600e3;
  const base = {
    departure: departure.toISOString(),
    eta: plan.eta,
    duration_h: Math.round(durationH * 10) / 10,
    warnings: plan.warnings,
    max_gust_kn: gusts.length ? Math.max(...gusts) : 0,
    max_wave_m: waves.length ? Math.max(...waves) : null,
    motor_share: plan.total_nm > 0 ? Math.round((motorNm / plan.total_nm) * 100) / 100 : 0,
  };
  return { ...base, score: scoreSlot(base), avoid: plan.warnings.length > 0 };
}

/**
 * Rechnet die Route für jede Kandidaten-Abfahrt im Fenster [windowStart, windowEnd]
 * (Raster stepH, inklusive Endpunkt) und rankt die Slots.
 */
export function scanDepartures({
  waypoints,
  windowStart,
  windowEnd,
  stepH = 2,
  boat = DEFAULT_BOAT,
  mode = "sail",
  sampleForecast,
  maxCandidates = 96,
}: {
  waypoints: Waypoint[];
  windowStart: Date;
  windowEnd: Date;
  stepH?: number;
  boat?: Boat;
  mode?: SailMode;
  sampleForecast: SampleForecast;
  maxCandidates?: number;
}): DepartureScan {
  if (windowEnd.getTime() < windowStart.getTime()) {
    throw new Error("Fenster-Ende liegt vor dem Fenster-Start.");
  }
  const stepMs = Math.max(1, stepH) * 3600e3;
  const slots: DepartureSlot[] = [];
  for (
    let t = windowStart.getTime(), n = 0;
    t <= windowEnd.getTime() && n < maxCandidates;
    t += stepMs, n++
  ) {
    const departure = new Date(t);
    const plan = planRoute({ waypoints, startTime: departure, boat, mode, sampleForecast });
    slots.push(slotFromPlan(departure, plan));
  }
  const recommended = slots.length
    ? slots.reduce((best, s) => (s.score < best.score ? s : best), slots[0])
    : null;
  return {
    slots,
    recommended,
    all_windy: slots.length > 0 && slots.every((s) => s.avoid),
  };
}
