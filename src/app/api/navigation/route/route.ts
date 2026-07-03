import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { planRoute } from "@/lib/weather/route-forecast";
import { buildSampler, isArchiveWindow, parseModel, type TimeWindow } from "@/lib/weather/open-meteo";
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
import { getNavRevier } from "@/lib/navigation/reviere";
import { getMaskForRevier } from "@/lib/navigation/masks";
import { expandWaypointsOverWater, thin } from "@/lib/navigation/route-helpers";
import { navigationEnabled } from "@/lib/flags";
import { clientKey, createLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ROUTE_WINDOW_DAYS = 6;

// Abuse-Deckel: A* + Open-Meteo je Anfrage sind nicht gratis (Finding #10).
const limiter = createLimiter({ limit: 30, windowMs: 60_000 });

// Strukturiertes Log für Observability (eine JSON-Zeile je Anfrage) — bewusst
// OHNE Koordinaten/Positionsdaten (Datenschutz-Zusage: Position wird nie
// serverseitig gespeichert, auch nicht in Logs).
function logRoute(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ evt: "nav.route", ...fields }));
}

// POST /api/navigation/route
// Body: { revier, waypoints: [{lat,lon,name?,depart_at?}], startTime?, mode?,
//         sensitivity?, boat?, model? }
// Wie /api/weather/route, aber: jede Teilstrecke wird VORHER über die
// Wassermaske des Reviers geroutet (Landvermeidung). Antwort enthält die
// expandierte Punktfolge + Routing-Art je Segment ("wasserweg"/"luftlinie").
export async function POST(req: NextRequest) {
  if (!navigationEnabled()) return fehler("Navigation ist deaktiviert.", 404);
  const t0 = Date.now();
  if (!limiter.allow(clientKey(req.headers))) {
    return fehler("Zu viele Anfragen — bitte kurz warten.", 429);
  }
  // Body-Limit über die ECHTE Länge, nicht den content-length-Header —
  // der fehlt bei chunked Encoding bzw. ist fälschbar (Finding #10).
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return fehler("Anfrage zu groß.", 413);
    body = JSON.parse(raw);
  } catch {
    return fehler("Ungültiger JSON-Body.");
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const revier = getNavRevier(String(b.revier ?? ""));
  if (!revier) return fehler("revier: unbekanntes Revier.");

  const waypoints = parseWaypoints(b.waypoints);
  if (!waypoints) return fehler("waypoints: ≥2 gültige {lat,lon} nötig.");
  if (waypoints.length > MAX_WAYPOINTS) return fehler(`Maximal ${MAX_WAYPOINTS} Wegpunkte.`);

  const startTime = b.startTime ? new Date(String(b.startTime)) : new Date();
  if (Number.isNaN(startTime.getTime())) return fehler("startTime ist kein gültiges Datum.");
  const timeErr = startTimeError(startTime);
  if (timeErr) return fehler(timeErr, 422);

  const mode: SailMode = b.mode === "motor" ? "motor" : "sail";
  const boat = mergeBoat(b.boat);
  const sensitivity = parseSensitivity(b.sensitivity);
  const model = parseModel(b.model);

  // Landvermeidung: Teilstrecken über die Wassermaske des Reviers routen.
  const mask = getMaskForRevier(revier.id);
  const expanded = expandWaypointsOverWater(mask, waypoints);
  if (expanded.status === "unreachable") {
    logRoute({ status: 422, grund: "unreachable", revier: revier.id, dauer_ms: Date.now() - t0 });
    const seg = expanded.failedSegment ?? 0;
    const fromName = waypoints[seg]?.name ?? `Wegpunkt ${seg + 1}`;
    const toName = waypoints[seg + 1]?.name ?? `Wegpunkt ${seg + 2}`;
    return fehler(
      `Kein Wasserweg von ${fromName} nach ${toName} gefunden — liegt ein Wegpunkt an Land oder in einem abgeschlossenen Gewässer?`,
      422,
    );
  }

  const lastDepart = expanded.points
    .map((w) => (w.depart_at ? new Date(w.depart_at).getTime() : 0))
    .reduce((a, c) => Math.max(a, c), startTime.getTime());
  const window: TimeWindow = {
    start: startTime,
    end: new Date(lastDepart + ROUTE_WINDOW_DAYS * 24 * 3600e3),
  };

  try {
    // Wetter-SAMPLING auf MAX_WAYPOINTS Stützpunkte deckeln: die Expansion darf
    // die Open-Meteo-URL nicht sprengen (25 Eingaben x 11 = ~265 Punkte hätten
    // Free-Tier + URL-Limit gerissen, Finding #5). Die ROUTEN-Geometrie bleibt
    // voll aufgelöst — der Sampler ordnet jedem Leg den nächsten Stützpunkt zu.
    const samplePoints = thin(expanded.points, MAX_WAYPOINTS);
    const sampleForecast = await buildSampler(midpointsOf(samplePoints), {
      sensitivity,
      window,
      model,
    });
    const plan = planRoute({ waypoints: expanded.points, startTime, boat, mode, sampleForecast });
    // Kennzahlen fürs Monitoring: Luftlinien-Quote zeigt Maskenlücken,
    // dauer_ms Upstream-/Routing-Latenz, warnungen die Warnlage.
    logRoute({
      status: 200,
      revier: revier.id,
      engine: mask ? "wassermaske" : "keine-maske",
      wegpunkte: waypoints.length,
      punkte_expandiert: expanded.points.length,
      segmente_luftlinie: expanded.segments.filter((s) => s.routing === "luftlinie").length,
      warnungen: plan.warnings.length,
      dauer_ms: Date.now() - t0,
    });
    return ok({
      plan,
      routing: {
        engine: mask ? "wassermaske" : "keine-maske",
        points: expanded.points.map((p) => ({ lat: p.lat, lon: p.lon, name: p.name ?? null })),
        segments: expanded.segments,
        hinweis: mask
          ? "Wasserweg aus OSM-Küstenlinien (~1 km) — Planungshilfe, keine amtliche Seekarte."
          : "Für dieses Revier gibt es noch keine Wassermaske — Route ist die Luftlinie.",
      },
      sensitivity,
      model,
      source: isArchiveWindow(window) ? "open-meteo-archive" : "open-meteo",
    });
  } catch (e) {
    // Details (Upstream-Bodies, URLs) nur ins Server-Log — nie an den Client.
    console.error("navigation/route:", e);
    logRoute({ status: 502, grund: "upstream", revier: revier.id, dauer_ms: Date.now() - t0 });
    return fehler("Wetterdaten konnten nicht geladen werden — bitte später erneut versuchen.", 502);
  }
}
