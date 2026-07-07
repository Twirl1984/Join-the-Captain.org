import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { buildTimeline, isArchiveWindow, parseModel, type TimeWindow } from "@/lib/weather/open-meteo";
import {
  MAX_WAYPOINTS,
  MAX_BODY_BYTES,
  parseWaypoints,
  midpointsOf,
  parseSensitivity,
  startTimeError,
} from "@/lib/weather/api-helpers";

export const runtime = "nodejs";

const MAX_TIMELINE_DAYS = 7;

// POST /api/weather/timeline — Zeitreihen fürs Karten-Playback.
// Body: { waypoints, startTime, endTime, stepH?, sensitivity?, model? }
// → { times[], points[{lat,lon,steps[]}] } an Wegpunkten + Leg-Mittelpunkten.
export async function POST(req: NextRequest) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return fehler("Anfrage zu groß.", 413);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fehler("Ungültiger JSON-Body.");
  }

  const waypoints = parseWaypoints(body.waypoints);
  if (!waypoints) return fehler("waypoints: ≥2 gültige {lat,lon} nötig.");
  if (waypoints.length > MAX_WAYPOINTS) return fehler(`Maximal ${MAX_WAYPOINTS} Wegpunkte.`);

  const start = new Date(String(body.startTime ?? ""));
  const end = new Date(String(body.endTime ?? ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return fehler("startTime/endTime: gültiges Zeitfenster nötig.");
  }
  if (end.getTime() - start.getTime() > MAX_TIMELINE_DAYS * 24 * 3600e3) {
    return fehler(`Playback-Fenster maximal ${MAX_TIMELINE_DAYS} Tage.`, 422);
  }
  const timeErr = startTimeError(start) ?? startTimeError(end);
  if (timeErr) return fehler(timeErr, 422);

  const stepH = Math.min(12, Math.max(1, Number(body.stepH) || 3));
  const sensitivity = parseSensitivity(body.sensitivity);
  const model = parseModel(body.model);
  const window: TimeWindow = { start, end };

  // Overlay-Punkte: Wegpunkte + Leg-Mittelpunkte (Symbole entlang der Route).
  const points = [...waypoints, ...midpointsOf(waypoints)].slice(0, 30);

  try {
    const timeline = await buildTimeline(points, { sensitivity, window, model, stepH });
    return ok({
      ...timeline,
      sensitivity,
      model,
      source: isArchiveWindow(window) ? "open-meteo-archive" : "open-meteo",
    });
  } catch (e) {
    console.error("weather/timeline:", e);
    return fehler("Wetterdaten konnten nicht geladen werden — bitte später erneut versuchen.", 502);
  }
}
