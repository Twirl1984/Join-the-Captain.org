// route-forecast.ts — Wetter + ETA entlang einer geplanten Route.
//
// Portiert aus dem Schwesterprojekt jtc.de (lib/weather/route-forecast.js, getestet).
// Reine Geometrie/Iteration, KEINE I/O. Bekommt die Wegpunkte, einen Boots-
// Datensatz und eine `sampleForecast`-Funktion injiziert (liefert Wind/Welle/
// Warnung für lat/lon zu einem Zeitpunkt — in der App aus open-meteo.ts, im
// Test gemockt). So bleibt die ETA-Logik offline testbar.
//
// Iteration: pro Leg Großkreis-Distanz → Wind zum geschätzten Ankunftsfenster →
// effektive Fahrt (polar.ts) → Legdauer → kumulierte Ankunftszeit → nächster Leg.

import { effectiveSpeed, twaFromCourse, DEFAULT_BOAT, type Boat, type SailMode } from "./polar";

const R_NM = 3440.065; // Erdradius in Seemeilen

export interface Waypoint {
  lat: number;
  lon: number;
  name?: string;
}

/** Wetter-Sample an einem Punkt zu einem Zeitpunkt (vom Sampler geliefert). */
export interface ForecastSample {
  wind_speed_kn: number;
  wind_from_deg: number;
  gust_kn?: number;
  wave_height_m?: number | null;
  gale?: boolean;
  thunderstorm?: boolean;
}

export type SampleForecast = (arg: { lat: number; lon: number; at: Date }) => ForecastSample;

export interface RouteLeg {
  leg: number;
  from: string;
  to: string;
  distance_nm: number;
  course_deg: number;
  mode: SailMode;
  speed_kn: number;
  wind_kn: number;
  wind_from_deg: number;
  wave_m: number | null;
  eta: string;
  duration_h: number | null;
  warnings: string[];
}

export interface RoutePlan {
  legs: RouteLeg[];
  total_nm: number;
  eta: string;
  warnings: string[];
}

/** Großkreis-Distanz zweier Punkte in Seemeilen (Haversine). */
export function haversineNm(a: Waypoint, b: Waypoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return round(2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h))), 2);
}

/** Anfangskurs (COG) von a nach b in Grad (0..360). */
export function initialBearing(a: Waypoint, b: Waypoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return round(((toDeg(Math.atan2(y, x)) % 360) + 360) % 360, 1);
}

/**
 * Rechnet Legs + ETA + Wetter entlang der Route.
 * @param waypoints  ≥2 Punkte
 * @param startTime  Abfahrt (Date oder ISO-String)
 * @param boat       Bootsdatensatz (polar.ts Boat-Form)
 * @param mode       'sail' (Default) | 'motor'
 * @param sampleForecast  Wetter-Sampler (injiziert)
 */
export function planRoute({
  waypoints,
  startTime,
  boat = DEFAULT_BOAT,
  mode = "sail",
  sampleForecast,
}: {
  waypoints: Waypoint[];
  startTime: Date | string;
  boat?: Boat;
  mode?: SailMode;
  sampleForecast: SampleForecast;
}): RoutePlan {
  if (!waypoints || waypoints.length < 2) throw new Error("Mindestens 2 Wegpunkte nötig.");
  let t = startTime instanceof Date ? new Date(startTime) : new Date(startTime);
  if (Number.isNaN(t.getTime())) throw new Error("Ungültige Startzeit.");
  const legs: RouteLeg[] = [];
  const warnings: string[] = [];
  let total = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const dist = haversineNm(from, to);
    const course = initialBearing(from, to);

    // Wetter am Leg: erst grob mit Startzeit sampeln, dann mit der besseren
    // Ankunftsschätzung einmal nachsampeln (ein Iterationsschritt genügt im MVP).
    let wx = sampleForecast({ lat: midLat(from, to), lon: midLon(from, to), at: t });
    let { speed_kn, mode: usedMode } = legSpeed(wx, course, mode, boat);
    let hours = speed_kn > 0 ? dist / speed_kn : Infinity;
    const mid = new Date(t.getTime() + (hours / 2) * 3600e3);
    wx = sampleForecast({ lat: midLat(from, to), lon: midLon(from, to), at: mid });
    ({ speed_kn, mode: usedMode } = legSpeed(wx, course, mode, boat));
    hours = speed_kn > 0 ? dist / speed_kn : Infinity;

    const eta = new Date(t.getTime() + hours * 3600e3);
    total += dist;

    const legWarn: string[] = [];
    if (wx.thunderstorm) legWarn.push("Gewitter");
    if (wx.gale || (wx.gust_kn ?? wx.wind_speed_kn) >= 34) legWarn.push("Sturm (≥8 Bft)");
    legWarn.forEach((w) =>
      warnings.push(`${w} auf Leg ${i + 1} (→ ${to.name || waypointLabel(to)})`),
    );

    legs.push({
      leg: i + 1,
      from: from.name || waypointLabel(from),
      to: to.name || waypointLabel(to),
      distance_nm: dist,
      course_deg: course,
      mode: usedMode,
      speed_kn: round(speed_kn, 1),
      wind_kn: round(wx.wind_speed_kn, 0),
      wind_from_deg: round(wx.wind_from_deg, 0),
      wave_m: wx.wave_height_m != null ? round(wx.wave_height_m, 1) : null,
      eta: eta.toISOString(),
      duration_h: Number.isFinite(hours) ? round(hours, 1) : null,
      warnings: legWarn,
    });
    t = eta;
  }

  return { legs, total_nm: round(total, 1), eta: t.toISOString(), warnings };
}

function legSpeed(
  wx: ForecastSample,
  course: number,
  mode: SailMode,
  boat: Boat,
): { speed_kn: number; mode: SailMode } {
  const twa = twaFromCourse(course, wx.wind_from_deg);
  return effectiveSpeed({ twsKn: wx.wind_speed_kn, twaDeg: twa, mode, boat });
}

const midLat = (a: Waypoint, b: Waypoint) => (a.lat + b.lat) / 2;
const midLon = (a: Waypoint, b: Waypoint) => (a.lon + b.lon) / 2;
const waypointLabel = (w: Waypoint) => `${w.lat.toFixed(3)},${w.lon.toFixed(3)}`;

function round(x: number, dp = 2): number {
  const m = 10 ** dp;
  return Math.round(x * m) / m;
}
