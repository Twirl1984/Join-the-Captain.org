import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { scanDepartures } from "@/lib/weather/departure-scan";
import { buildSampler, isArchiveWindow, type TimeWindow } from "@/lib/weather/open-meteo";
import {
  MAX_WAYPOINTS,
  MAX_BODY_BYTES,
  parseWaypoints,
  midpointsOf,
  parseSensitivity,
  startTimeError,
  mergeBoat,
} from "@/lib/weather/api-helpers";
import type { SailMode } from "@/lib/weather/polar";

export const runtime = "nodejs";

const MAX_WINDOW_DAYS = 5; // Kandidaten-Fenster (Charter-Anreise bis spätester Start)
const MIN_STEP_H = 1;
const MAX_STEP_H = 12;
const ROUTE_WINDOW_DAYS = 4; // Sampling-Puffer hinter dem spätesten Kandidaten

// POST /api/weather/departure — "Wann sollte ich auslaufen?"
// Body: { waypoints, windowStart, windowEnd, stepH?, mode?, sensitivity?, boat? }
// → Slots (je Kandidaten-Abfahrt: Warnungen, Böen, Welle, Dauer, Score) +
//   empfohlener Slot. Sicherheit dominiert: Slots mit Warnung sind "meiden".
export async function POST(req: NextRequest) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return fehler("Anfrage zu groß.", 413);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fehler("Ungültiger JSON-Body.");
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const waypoints = parseWaypoints(b.waypoints);
  if (!waypoints) return fehler("waypoints: ≥2 gültige {lat,lon} nötig.");
  if (waypoints.length > MAX_WAYPOINTS) return fehler(`Maximal ${MAX_WAYPOINTS} Wegpunkte.`);

  const windowStart = new Date(String(b.windowStart ?? ""));
  const windowEnd = new Date(String(b.windowEnd ?? ""));
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
    return fehler("windowStart/windowEnd: gültige Zeitpunkte nötig.");
  }
  if (windowEnd.getTime() <= windowStart.getTime()) {
    return fehler("windowEnd muss nach windowStart liegen.");
  }
  if (windowEnd.getTime() - windowStart.getTime() > MAX_WINDOW_DAYS * 24 * 3600e3) {
    return fehler(`Das Abfahrts-Fenster darf maximal ${MAX_WINDOW_DAYS} Tage umfassen.`, 422);
  }
  // Beide Enden gegen Forecast-Horizont/Archiv-Grenze prüfen.
  const timeErr = startTimeError(windowStart) ?? startTimeError(windowEnd);
  if (timeErr) return fehler(timeErr, 422);

  const stepH = Math.min(MAX_STEP_H, Math.max(MIN_STEP_H, Number(b.stepH) || 2));
  const mode: SailMode = b.mode === "motor" ? "motor" : "sail";
  const boat = mergeBoat(b.boat);
  const sensitivity = parseSensitivity(b.sensitivity);

  const window: TimeWindow = {
    start: windowStart,
    end: new Date(windowEnd.getTime() + ROUTE_WINDOW_DAYS * 24 * 3600e3),
  };

  try {
    // EIN Datenabruf für das gesamte Fenster; der Sweep rechnet nur noch lokal.
    const sampleForecast = await buildSampler(midpointsOf(waypoints), { sensitivity, window });
    const scan = scanDepartures({
      waypoints,
      windowStart,
      windowEnd,
      stepH,
      boat,
      mode,
      sampleForecast,
    });
    return ok({
      ...scan,
      sensitivity,
      stepH,
      source: isArchiveWindow(window) ? "open-meteo-archive" : "open-meteo",
    });
  } catch (e) {
    console.error("weather/departure:", e);
    return fehler("Wetterdaten konnten nicht geladen werden — bitte später erneut versuchen.", 502);
  }
}
