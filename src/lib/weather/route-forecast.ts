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
import { stormSeverity } from "./warnings";

const R_NM = 3440.065; // Erdradius in Seemeilen

export interface Waypoint {
  lat: number;
  lon: number;
  name?: string;
  /**
   * Frühester Weiterfahr-Zeitpunkt AB diesem Wegpunkt (ISO/Date) — für geplante
   * Zwischenstopps (Hafen-Übernachtung). Kommt das Boot früher an, wartet es
   * (Liegezeit); kommt es später an, fährt es direkt weiter.
   */
  depart_at?: string | Date;
}

/** Wetter-Sample an einem Punkt zu einem Zeitpunkt (vom Sampler geliefert). */
export interface ForecastSample {
  wind_speed_kn: number;
  wind_from_deg: number;
  gust_kn?: number;
  wave_height_m?: number | null;
  /** Strömung: Fahrt (kn) und Setzrichtung (WOHIN sie setzt, ozeanographisch). */
  current_kn?: number | null;
  current_to_deg?: number | null;
  gale?: boolean; // Sturm (aus warnings.classify)
  thunderstorm?: boolean; // Gewitter
  high_wave?: boolean; // hohe Welle
}

export type SampleForecast = (arg: { lat: number; lon: number; at: Date }) => ForecastSample;

export interface RouteLeg {
  leg: number;
  from: string;
  to: string;
  distance_nm: number;
  course_deg: number;
  mode: SailMode;
  /** Fahrt durchs Wasser (kn). */
  speed_kn: number;
  /** Fahrt über Grund (kn) = speed_kn + Strömungskomponente längs Kurs. */
  sog_kn: number;
  current_kn: number | null;
  current_to_deg: number | null;
  wind_kn: number;
  gust_kn: number;
  wind_from_deg: number;
  wave_m: number | null;
  /** Tatsächliche Abfahrt dieses Legs (nach evtl. Liegezeit). */
  depart: string;
  /** Wartezeit am Start-Wegpunkt (h), falls depart_at später als die Ankunft lag. */
  layover_h: number | null;
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

    // Liegezeit: hat der Start-Wegpunkt ein "Weiterfahrt ab", warten wir bis
    // dahin (Hafen-Übernachtung); frühere Ankunft verfällt, spätere gewinnt.
    let layoverH: number | null = null;
    if (from.depart_at) {
      const dep = from.depart_at instanceof Date ? from.depart_at : new Date(from.depart_at);
      if (!Number.isNaN(dep.getTime()) && dep.getTime() > t.getTime()) {
        layoverH = round((dep.getTime() - t.getTime()) / 3600e3, 1);
        t = new Date(dep);
      }
    }
    const depart = new Date(t);

    // Wetter am Leg: erst grob mit Startzeit sampeln, dann mit der besseren
    // Ankunftsschätzung einmal nachsampeln (ein Iterationsschritt genügt im MVP).
    let wx = sampleForecast({ lat: midLat(from, to), lon: midLon(from, to), at: t });
    let { speed_kn, mode: usedMode } = legSpeed(wx, course, mode, boat);
    let hours = speed_kn > 0 ? dist / speed_kn : Infinity;
    const mid = new Date(t.getTime() + (hours / 2) * 3600e3);
    wx = sampleForecast({ lat: midLat(from, to), lon: midLon(from, to), at: mid });
    ({ speed_kn, mode: usedMode } = legSpeed(wx, course, mode, boat));
    // Fahrt ÜBER GRUND: Strömungskomponente längs des Kurses addieren
    // (Setzrichtung = wohin der Strom läuft; positiver Anteil schiebt).
    // Mindestens 0.3 kn, sonst "steht" das Boot rechnerisch ewig.
    const cur = wx.current_kn ?? 0;
    const curTo = wx.current_to_deg ?? 0;
    const along = cur > 0 ? cur * Math.cos(((curTo - course) * Math.PI) / 180) : 0;
    const sog = Math.max(0.3, speed_kn + along);
    hours = dist / sog;

    const eta = new Date(t.getTime() + hours * 3600e3);
    total += dist;

    // Warnungen über den GANZEN Leg-Verlauf prüfen (Abfahrt/Mitte/Ankunft) —
    // eine Sturmzelle am Anfang oder Ende des Legs darf nicht durchs einzelne
    // Mittel-Sample rutschen (Sicherheits-FN). Flags per ODER, Böe = Maximum.
    const legSamples = Number.isFinite(hours)
      ? [depart, new Date(t.getTime() + (hours / 2) * 3600e3), eta].map((at) =>
          sampleForecast({ lat: midLat(from, to), lon: midLon(from, to), at }),
        )
      : [wx];
    const anyGale = legSamples.some((s) => s.gale);
    const anyThunder = legSamples.some((s) => s.thunderstorm);
    const anyHighWave = legSamples.some((s) => s.high_wave);
    const maxGust = Math.max(...legSamples.map((s) => s.gust_kn ?? s.wind_speed_kn ?? 0));
    const meanWinds = legSamples.map((s) => s.wind_speed_kn ?? 0);
    const minMeanWind = Math.min(...meanWinds);
    const maxMeanWind = Math.max(...meanWinds);

    const legWarn: string[] = [];
    if (anyThunder) legWarn.push("Gewitter");
    if (anyGale) {
      // Windstärke im Warntext sichtbar machen (FN-Schwere hängt daran).
      const sev = stormSeverity(maxGust);
      legWarn.push(`${sev.label} (${sev.bft} Bft)${sev.severe ? " ⚠ gefährlich" : ""}`);
    }
    if (anyHighWave) legWarn.push("Hohe Welle");
    // Boots-Grenzen (unabhängig vom Risiko-Regler — harte Bootsdaten):
    // zu wenig Wind für Jolle/Kat (kein Motor) bzw. gesetztes Minimum,
    // zu viel MITTELwind fürs Boot (Kentergefahr/Charterlimit).
    if (boat.min_wind_kn != null && mode === "sail" && minMeanWind < boat.min_wind_kn) {
      legWarn.push(
        `Zu wenig Wind (${round(minMeanWind, 0)} kn < min ${boat.min_wind_kn} kn${boat.has_engine === false ? " · kein Motor" : ""})`,
      );
    }
    if (boat.max_wind_kn != null && maxMeanWind > boat.max_wind_kn) {
      legWarn.push(`Wind über Bootslimit (${round(maxMeanWind, 0)} kn > max ${boat.max_wind_kn} kn)`);
    }
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
      sog_kn: round(Math.max(0.3, speed_kn + along), 1),
      current_kn: wx.current_kn != null ? round(wx.current_kn, 1) : null,
      current_to_deg: wx.current_to_deg != null ? round(wx.current_to_deg, 0) : null,
      wind_kn: round(wx.wind_speed_kn, 0),
      gust_kn: round(maxGust, 0),
      wind_from_deg: round(wx.wind_from_deg, 0),
      wave_m: wx.wave_height_m != null ? round(wx.wave_height_m, 1) : null,
      depart: depart.toISOString(),
      layover_h: layoverH,
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
