// route-profiles.ts — Kostenmodelle für die Routen-Wahl (REQ-NAV-019).
//
// Drei Profile zusätzlich zum kürzesten Weg:
//   "segel"   — schnellster Weg UNTER SEGELN: Kantenkosten = Fahrzeit aus der
//               Polare (No-Go-Zone → Kreuz-VMG), Flaute wird gemieden.
//   "motor"   — schnellster Weg unter Motor: Marschfahrt, hohe Welle bremst.
//   "komfort" — entspannter Weg: Seegang (quadratisch) und Starkwind werden
//               als Umweg-Malus bepreist; das Boot nimmt lieber die ruhige Seite.
//
// Das Wetterfeld ist bewusst grob (Grid-Samples zur Startzeit, Nächster-Nachbar):
// eine Planungshilfe, kein Wetter-Routing-Optimum über die Zeitachse.
// Reine Logik ohne I/O — Feld wird injiziert (testbar, TDD).

import { type Boat, DEFAULT_BOAT, beatVmgSpeed, motorSpeed, sailSpeed, twaFromCourse } from "../weather/polar";
import { initialBearing } from "../weather/route-forecast";
import type { LatLon, RouteCosts } from "./searoute";

export type RouteProfil = "kuerzeste" | "segel" | "motor" | "komfort";

const PROFILE: readonly RouteProfil[] = ["kuerzeste", "segel", "motor", "komfort"];

/** Body-Wert → Profil; fehlend = "kuerzeste" (Bestandsverhalten), unbekannt = null. */
export function parseRouteProfil(raw: unknown): RouteProfil | null {
  if (raw == null) return "kuerzeste";
  return (PROFILE as readonly string[]).includes(String(raw)) ? (String(raw) as RouteProfil) : null;
}

export interface FieldSample {
  wind_kn: number;
  wind_from_deg: number;
  wave_m: number | null;
}

/**
 * Wetter am Ort ZUR ZEIT `elapsedH` (Stunden seit Abfahrt) — REQ-NAV-023.
 * So bewertet der A* jede Kante mit dem Wetter zur voraussichtlichen
 * Durchfahrtszeit statt pauschal mit dem Wetter zur Startzeit.
 */
export type WeatherField = (lat: number, lon: number, elapsedH: number) => FieldSample;

const RUHIG: FieldSample = { wind_kn: 0, wind_from_deg: 0, wave_m: 0 };

/**
 * Nächster-Nachbar-Feld aus STATISCHEN Grid-Samples (zeitlos) — für Tests und
 * als Rückfall. Die Zeit wird ignoriert.
 */
export function gridField(samples: Array<{ lat: number; lon: number } & FieldSample>): WeatherField {
  if (samples.length === 0) return () => RUHIG;
  return (lat, lon) => {
    const cosLat = Math.cos((lat * Math.PI) / 180);
    let best = samples[0];
    let bestD = Infinity;
    for (const s of samples) {
      const d = (s.lat - lat) ** 2 + ((s.lon - lon) * cosLat) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  };
}

/**
 * Zeitbewusstes Feld aus einem Wetter-Sampler (z. B. Open-Meteo, REQ-NAV-023):
 * die Kante wird mit dem Wetter zur geschätzten Durchfahrtszeit bewertet.
 */
export function samplerField(
  sample: (arg: { lat: number; lon: number; at: Date }) => {
    wind_speed_kn: number;
    wind_from_deg: number;
    wave_height_m?: number | null;
  },
  startTime: Date,
  maxHours = 120,
): WeatherField {
  const t0 = startTime.getTime();
  return (lat, lon, elapsedH) => {
    // Deckel: über das Vorhersagefenster hinaus nicht extrapolieren.
    const h = Math.max(0, Math.min(maxHours, Number.isFinite(elapsedH) ? elapsedH : 0));
    const wx = sample({ lat, lon, at: new Date(t0 + h * 3600e3) });
    return {
      wind_kn: wx.wind_speed_kn,
      wind_from_deg: wx.wind_from_deg,
      wave_m: wx.wave_height_m ?? null,
    };
  };
}

/** Nie ganz stehen bleiben — sonst divergieren Zeit-Kosten (und A* würde
 *  beliebige Umwege nehmen, nur um eine Flauten-Zelle zu vermeiden). */
const MIN_SPEED_KN = 0.5;

/**
 * Kantenkosten fürs Profil; null bei "kuerzeste" (reines Distanz-Routing).
 * Invariante für die A*-Zulässigkeit: edgeCost >= dist / heuristicSpeedNmPerCost
 * (Tests decken das per Stichprobe ab).
 */
export function profileCosts(
  profil: RouteProfil,
  field: WeatherField,
  boat: Boat = DEFAULT_BOAT,
): RouteCosts | null {
  if (profil === "kuerzeste") return null;

  const mid = (a: LatLon, b: LatLon, tH: number) =>
    field((a.lat + b.lat) / 2, (a.lon + b.lon) / 2, tH);

  if (profil === "segel") {
    const vMax = boat.hull_speed_kn ?? DEFAULT_BOAT.hull_speed_kn;
    return {
      heuristicSpeedNmPerCost: vMax,
      // Kosten SIND Stunden → Umrechnung ist die Identität.
      costToHours: (c) => c,
      nominalSpeedKn: vMax,
      edgeCost: (a, b, dist, tH) => {
        const w = mid(a, b, tH);
        const twa = twaFromCourse(initialBearing(a, b), w.wind_from_deg);
        let v = sailSpeed(w.wind_kn, twa, boat);
        if (v <= 0) v = beatVmgSpeed(w.wind_kn, boat); // No-Go-Zone: kreuzen
        v = Math.min(vMax, Math.max(MIN_SPEED_KN, v));
        return dist / v;
      },
    };
  }

  if (profil === "motor") {
    const vM = Math.max(MIN_SPEED_KN, motorSpeed(boat));
    return {
      heuristicSpeedNmPerCost: vM,
      costToHours: (c) => c, // Kosten sind Stunden
      nominalSpeedKn: vM,
      edgeCost: (a, b, dist, tH) => {
        const wave = mid(a, b, tH).wave_m ?? 0;
        return (dist / vM) * (1 + 0.08 * wave * wave); // Welle bremst/stampft
      },
    };
  }

  // "komfort": Kosten in gewichteten Meilen (>= dist, Heuristik-Speed 1).
  const vNom = Math.max(MIN_SPEED_KN, motorSpeed(boat));
  return {
    heuristicSpeedNmPerCost: 1,
    // Kosten sind gewichtete Meilen → grob über die Marschfahrt in Stunden.
    costToHours: (c) => c / vNom,
    nominalSpeedKn: vNom,
    edgeCost: (a, b, dist, tH) => {
      const w = mid(a, b, tH);
      const wave = w.wave_m ?? 0;
      const boe = Math.max(0, w.wind_kn - 18) / 10; // Starkwind-Malus
      return dist * (1 + 1.5 * wave * wave + boe);
    },
  };
}
