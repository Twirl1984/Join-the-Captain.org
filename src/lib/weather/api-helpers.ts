// api-helpers.ts — geteilte Validierung der Wetter-API-Routen
// (/api/weather/route und /api/weather/departure).

import type { Waypoint } from "./route-forecast";
import { DEFAULT_BOAT, type Boat } from "./polar";
import { RECOMMENDED_SENSITIVITY } from "./warnings";

export const MAX_WAYPOINTS = 25; // begrenzt Open-Meteo-URL-Länge & Free-Tier-Last
export const MAX_BODY_BYTES = 64 * 1024; // Payloads sind winzig; mehr ist Missbrauch
export const MAX_NAME_LEN = 80; // Namen kappen (kommen 1:1 in die Antwort zurück)
export const FORECAST_HORIZON_DAYS = 7; // freie Open-Meteo-Vorhersage reicht 7 Tage
export const ARCHIVE_MAX_YEARS = 5; // Archiv-Modus (Validierung) reicht ~5 Jahre zurück

export function parseWaypoints(raw: unknown): Waypoint[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: Waypoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const w = item as Record<string, unknown>;
    const lat = Number(w.lat);
    const lon = Number(w.lon);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null;
    // Optionale Liegezeit: "Weiterfahrt ab" für Zwischenstopps.
    let depart_at: string | undefined;
    if (w.depart_at != null) {
      const d = new Date(String(w.depart_at));
      if (Number.isNaN(d.getTime())) return null;
      depart_at = d.toISOString();
    }
    // Optionale Liegedauer in Minuten (REQ-NAV-017), gedeckelt auf 7 Tage —
    // mehr würde das Vorhersage-Fenster des Samplers sprengen.
    let stay_min: number | undefined;
    if (w.stay_min != null) {
      const n = Number(w.stay_min);
      if (!Number.isFinite(n) || n < 0 || n > 7 * 24 * 60) return null;
      stay_min = Math.round(n) || undefined;
    }
    out.push({
      lat,
      lon,
      name: typeof w.name === "string" ? w.name.slice(0, MAX_NAME_LEN) : undefined,
      depart_at,
      stay_min,
    });
  }
  return out;
}

/** Leg-Mittelpunkte — dort sampelt route-forecast.ts das Wetter. */
export function midpointsOf(waypoints: Waypoint[]): Waypoint[] {
  const mids: Waypoint[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    mids.push({
      lat: (waypoints[i].lat + waypoints[i + 1].lat) / 2,
      lon: (waypoints[i].lon + waypoints[i + 1].lon) / 2,
    });
  }
  return mids;
}

/** Risiko-Regler 0..1; Default = sicherer, datengestützter Betriebspunkt. */
export function parseSensitivity(raw: unknown): number {
  return Number.isFinite(Number(raw))
    ? Math.min(1, Math.max(0, Number(raw)))
    : RECOMMENDED_SENSITIVITY;
}

/**
 * Prüft eine Startzeit gegen die Datenlage. Zukunft: max. 7 Tage (Forecast).
 * Vergangenheit: bis ~5 Jahre zurück erlaubt (Archiv-Modus zur Validierung
 * vergangener Sturm-/Gewitterlagen). Rückgabe: Fehlertext oder null.
 */
export function startTimeError(startTime: Date): string | null {
  const now = Date.now();
  if (startTime.getTime() > now + FORECAST_HORIZON_DAYS * 24 * 3600e3) {
    return `Die freie Vorhersage reicht nur ${FORECAST_HORIZON_DAYS} Tage voraus. Bitte einen früheren Start wählen.`;
  }
  if (startTime.getTime() < now - ARCHIVE_MAX_YEARS * 365 * 24 * 3600e3) {
    return `Archivdaten reichen nur ~${ARCHIVE_MAX_YEARS} Jahre zurück.`;
  }
  return null;
}

// Boot-Parameter nur übernehmen, wenn sie physikalisch plausibel sind —
// z.B. verhindert das cruise_speed_motor_kn=0 (→ Infinity-Legdauer).
export function mergeBoat(raw: unknown): Boat {
  if (!raw || typeof raw !== "object") return DEFAULT_BOAT;
  const r = raw as Record<string, unknown>;
  const pos = (v: unknown, fallback: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= max ? n : fallback;
  };
  const optPos = (v: unknown, max: number): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= max ? n : null;
  };
  const minWind = optPos(r.min_wind_kn, 30);
  const maxWind = optPos(r.max_wind_kn, 80);
  return {
    name: typeof r.name === "string" ? r.name.slice(0, MAX_NAME_LEN) : DEFAULT_BOAT.name,
    cruise_speed_motor_kn: pos(r.cruise_speed_motor_kn, DEFAULT_BOAT.cruise_speed_motor_kn, 30),
    hull_speed_kn: pos(r.hull_speed_kn, DEFAULT_BOAT.hull_speed_kn, 40),
    upwind_no_go_deg: pos(r.upwind_no_go_deg, DEFAULT_BOAT.upwind_no_go_deg, 90),
    drive_efficiency: pos(r.drive_efficiency, DEFAULT_BOAT.drive_efficiency, 1),
    has_engine: r.has_engine === false ? false : true,
    // min < max erzwingen, sonst Minimum verwerfen (Fehlbedienung tolerieren).
    min_wind_kn: minWind != null && maxWind != null && minWind >= maxWind ? null : minWind,
    max_wind_kn: maxWind ?? DEFAULT_BOAT.max_wind_kn,
  };
}

/** Summe aller Liegedauern gedeckelt auf 7 Tage — mehr sprengt das
 *  Vorhersage-Fenster des Samplers (REQ-NAV-017, Review-Finding). */
export function staySumError(waypoints: ReadonlyArray<Waypoint>): string | null {
  const total = waypoints.reduce((a, w) => a + (w.stay_min ?? 0), 0);
  return total > 7 * 24 * 60
    ? "Liegezeiten zusammen länger als 7 Tage — so weit reicht die Vorhersage nicht."
    : null;
}
