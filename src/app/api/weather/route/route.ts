import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { planRoute } from "@/lib/weather/route-forecast";
import { buildSampler, isArchiveWindow, parseModel, type TimeWindow } from "@/lib/weather/open-meteo";
import {
  MAX_WAYPOINTS,
  MAX_BODY_BYTES,
  parseWaypoints,
  staySumError,
  midpointsOf,
  parseSensitivity,
  startTimeError,
  mergeBoat,
} from "@/lib/weather/api-helpers";
import type { SailMode } from "@/lib/weather/polar";

export const runtime = "nodejs";

// Grobes Zeitfenster einer Route (Start → Ankunft inkl. Liegezeiten) fürs Sampling.
const ROUTE_WINDOW_DAYS = 6;

// POST /api/weather/route
// Body: { waypoints: [{lat,lon,name?,depart_at?}], startTime?, mode?, sensitivity?, boat? }
// → Legs + ETA + Wetter + Warnungen. Startzeiten in der Vergangenheit (bis ~5 Jahre)
//   laufen im ARCHIV-Modus (damalige Vorhersagen) — zur Validierung von Warnlagen.
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
  const stayErr = staySumError(waypoints);
  if (stayErr) return fehler(stayErr, 422);

  const startTime = b.startTime ? new Date(String(b.startTime)) : new Date();
  if (Number.isNaN(startTime.getTime())) return fehler("startTime ist kein gültiges Datum.");
  const timeErr = startTimeError(startTime);
  if (timeErr) return fehler(timeErr, 422);

  const mode: SailMode = b.mode === "motor" ? "motor" : "sail";
  const boat = mergeBoat(b.boat);
  const sensitivity = parseSensitivity(b.sensitivity);
  const model = parseModel(b.model);

  // Sampling-Fenster: Start bis grobe Ankunft (inkl. Liegezeiten der Wegpunkte).
  const lastDepart = waypoints
    .map((w) => (w.depart_at ? new Date(w.depart_at).getTime() : 0))
    .reduce((a, c) => Math.max(a, c), startTime.getTime());
  // Liegedauern (stay_min) verschieben alles Folgende — Fenster entsprechend weiten.
  const totalStayMs = waypoints.reduce((a, w) => a + (w.stay_min ?? 0) * 60e3, 0);
  const window: TimeWindow = {
    start: startTime,
    end: new Date(lastDepart + totalStayMs + ROUTE_WINDOW_DAYS * 24 * 3600e3),
  };

  try {
    const sampleForecast = await buildSampler(midpointsOf(waypoints), { sensitivity, window, model });
    const plan = planRoute({ waypoints, startTime, boat, mode, sampleForecast });
    return ok({
      plan,
      sensitivity,
      model,
      source: isArchiveWindow(window) ? "open-meteo-archive" : "open-meteo",
    });
  } catch (e) {
    // Details (Upstream-Bodies, URLs) nur ins Server-Log — nie an den Client.
    console.error("weather/route:", e);
    return fehler("Wetterdaten konnten nicht geladen werden — bitte später erneut versuchen.", 502);
  }
}
