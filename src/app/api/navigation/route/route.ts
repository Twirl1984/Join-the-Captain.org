import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { planRoute } from "@/lib/weather/route-forecast";
import { scanDepartures, type DepartureScan } from "@/lib/weather/departure-scan";
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
import { getNavRevier } from "@/lib/navigation/reviere";
import { getMaskForRevier } from "@/lib/navigation/masks";
import { expandWaypointsOverWater, thin } from "@/lib/navigation/route-helpers";
import { gridField, parseRouteProfil, profileCosts, type FieldSample } from "@/lib/navigation/route-profiles";
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
// Body: { revier, waypoints: [{lat,lon,name?,depart_at?,stay_min?}], startTime?, mode?,
//         sensitivity?, boat?, model?, scanWindowEnd?, scanStepH?, routeProfil? }
// scanWindowEnd (REQ-NAV-009): zusätzlich Abfahrts-Scan über die GERoutete
// Punktfolge — ein Routing, ein Wetter-Fetch, Slots in der Antwort.
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
  const stayErr = staySumError(waypoints);
  if (stayErr) return fehler(stayErr, 422);

  const startTime = b.startTime ? new Date(String(b.startTime)) : new Date();
  if (Number.isNaN(startTime.getTime())) return fehler("startTime ist kein gültiges Datum.");
  const timeErr = startTimeError(startTime);
  if (timeErr) return fehler(timeErr, 422);

  // Optionaler Abfahrts-Scan übers Charter-Fenster (REQ-NAV-009).
  let scanEnd: Date | null = null;
  if (b.scanWindowEnd != null) {
    scanEnd = new Date(String(b.scanWindowEnd));
    if (Number.isNaN(scanEnd.getTime()) || scanEnd.getTime() <= startTime.getTime()) {
      return fehler("scanWindowEnd muss nach startTime liegen.");
    }
    if (scanEnd.getTime() - startTime.getTime() > 5 * 24 * 3600e3) {
      return fehler("Das Abfahrts-Fenster darf maximal 5 Tage umfassen.", 422);
    }
    const scanErr = startTimeError(scanEnd);
    if (scanErr) return fehler(scanErr, 422);
  }
  const scanStepH = Math.min(12, Math.max(1, Number(b.scanStepH) || 1));

  const mode: SailMode = b.mode === "motor" ? "motor" : "sail";
  const boat = mergeBoat(b.boat);
  const sensitivity = parseSensitivity(b.sensitivity);
  const model = parseModel(b.model);
  // Routen-Profil (REQ-NAV-019): kürzeste (Default) | segel | motor | komfort.
  const profil = parseRouteProfil(b.routeProfil);
  if (!profil) return fehler("routeProfil: erlaubt sind kuerzeste, segel, motor, komfort.", 422);

  // Landvermeidung: Teilstrecken über die Wassermaske des Reviers routen.
  const mask = getMaskForRevier(revier.id);
  // Profil-Routing (REQ-NAV-019): grobes Wetterfeld (3x3-Grid zur Startzeit)
  // bepreist die A*-Kanten. Bewusst EIN Zeitpunkt — Planungshilfe, kein
  // Wetter-Routing über die Zeitachse (Doku im Modul route-profiles.ts).
  let costs = undefined;
  if (profil !== "kuerzeste") {
    try {
      const lats = waypoints.map((w) => w.lat);
      const lons = waypoints.map((w) => w.lon);
      const pad = 0.25;
      const s0 = Math.min(...lats) - pad;
      const n0 = Math.max(...lats) + pad;
      const w0 = Math.min(...lons) - pad;
      const e0 = Math.max(...lons) + pad;
      const grid: Array<{ lat: number; lon: number }> = [];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          grid.push({ lat: s0 + ((n0 - s0) * i) / 2, lon: w0 + ((e0 - w0) * j) / 2 });
        }
      }
      const fieldSampler = await buildSampler(grid, {
        sensitivity,
        window: { start: startTime, end: new Date(startTime.getTime() + 3600e3) },
        model,
      });
      const samples = grid.map((g) => {
        const wx = fieldSampler({ lat: g.lat, lon: g.lon, at: startTime });
        return {
          ...g,
          wind_kn: wx.wind_speed_kn,
          wind_from_deg: wx.wind_from_deg,
          wave_m: wx.wave_height_m ?? null,
        } satisfies { lat: number; lon: number } & FieldSample;
      });
      costs = profileCosts(profil, gridField(samples), boat) ?? undefined;
    } catch (err) {
      // Feld nicht verfügbar (z. B. Upstream-Fehler): ehrlich scheitern statt
      // still den kürzesten Weg als "Profil-Route" auszugeben.
      console.error("route-profil-feld", err);
      return fehler("Wetterfeld für das Routen-Profil gerade nicht verfügbar — bitte später erneut versuchen.", 502);
    }
  }
  const expanded = expandWaypointsOverWater(mask, waypoints, { costs });
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
  // Liegedauern (stay_min) verschieben alles Folgende — Fenster entsprechend weiten.
  const totalStayMs = expanded.points.reduce((a, w) => a + (w.stay_min ?? 0) * 60e3, 0);
  const window: TimeWindow = {
    start: startTime,
    // Sampler muss auch das Scan-Fenster + Routendauer abdecken.
    end: new Date(Math.max(lastDepart, scanEnd?.getTime() ?? 0) + totalStayMs + ROUTE_WINDOW_DAYS * 24 * 3600e3),
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
    // Abfahrts-Scan über den bereits gerouteten Wasserweg (kein zweites A*,
    // kein zweiter Wetter-Fetch) — Slots wie /api/weather/departure.
    let scan: DepartureScan | null = null;
    if (scanEnd) {
      scan = scanDepartures({
        waypoints: expanded.points,
        windowStart: startTime,
        windowEnd: scanEnd,
        stepH: scanStepH,
        boat,
        mode,
        sampleForecast,
      });
    }
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
      scan,
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
