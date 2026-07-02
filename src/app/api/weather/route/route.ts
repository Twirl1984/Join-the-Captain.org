import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { planRoute, type Waypoint } from "@/lib/weather/route-forecast";
import { buildSampler } from "@/lib/weather/open-meteo";
import { RECOMMENDED_SENSITIVITY } from "@/lib/weather/warnings";
import { DEFAULT_BOAT, type Boat, type SailMode } from "@/lib/weather/polar";

export const runtime = "nodejs";

const MAX_WAYPOINTS = 25; // begrenzt Open-Meteo-URL-Länge & Free-Tier-Last
const FORECAST_HORIZON_DAYS = 7; // freie Open-Meteo-Vorhersage reicht 7 Tage

// POST /api/weather/route
// Body: { waypoints: [{lat,lon,name?}], startTime?, mode?, boat? }
// → Legs + ETA + Wetter + Warnungen entlang der Route (route-forecast.ts).
export async function POST(req: NextRequest) {
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

  const startTime = b.startTime ? new Date(String(b.startTime)) : new Date();
  if (Number.isNaN(startTime.getTime())) return fehler("startTime ist kein gültiges Datum.");
  // Über das Vorhersagefenster hinaus würden wir sonst die letzte verfügbare
  // Stunde extrapolieren und einen scheinbar echten Plan liefern — bei einem
  // Sicherheits-Tool irreführend. Lieber ehrlich ablehnen.
  const horizonMs = Date.now() + FORECAST_HORIZON_DAYS * 24 * 3600e3;
  if (startTime.getTime() > horizonMs) {
    return fehler(
      `Die freie Vorhersage reicht nur ${FORECAST_HORIZON_DAYS} Tage voraus. Bitte einen früheren Start wählen.`,
      422,
    );
  }

  const mode: SailMode = b.mode === "motor" ? "motor" : "sail";
  const boat: Boat = mergeBoat(b.boat);
  // Risiko-Regler 0..1 (Slider). Höher = vorsichtiger (früher warnen).
  // Default = sicherer, datengestützter Betriebspunkt (s. warnings.ts / Backtest).
  const sensitivity = Number.isFinite(Number(b.sensitivity))
    ? Math.min(1, Math.max(0, Number(b.sensitivity)))
    : RECOMMENDED_SENSITIVITY;

  // route-forecast.ts sampelt an den Leg-Mittelpunkten → genau diese vorab holen.
  const samplePoints: Waypoint[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    samplePoints.push({
      lat: (waypoints[i].lat + waypoints[i + 1].lat) / 2,
      lon: (waypoints[i].lon + waypoints[i + 1].lon) / 2,
    });
  }

  try {
    const sampleForecast = await buildSampler(samplePoints, { sensitivity });
    const plan = planRoute({ waypoints, startTime, boat, mode, sampleForecast });
    return ok({ plan, sensitivity, source: "open-meteo" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return fehler(`Wetterdaten konnten nicht geladen werden: ${msg}`, 502);
  }
}

function parseWaypoints(raw: unknown): Waypoint[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: Waypoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const w = item as Record<string, unknown>;
    const lat = Number(w.lat);
    const lon = Number(w.lon);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null;
    out.push({ lat, lon, name: typeof w.name === "string" ? w.name : undefined });
  }
  return out;
}

function mergeBoat(raw: unknown): Boat {
  if (!raw || typeof raw !== "object") return DEFAULT_BOAT;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return {
    name: typeof r.name === "string" ? r.name : DEFAULT_BOAT.name,
    cruise_speed_motor_kn: num(r.cruise_speed_motor_kn, DEFAULT_BOAT.cruise_speed_motor_kn),
    hull_speed_kn: num(r.hull_speed_kn, DEFAULT_BOAT.hull_speed_kn),
    upwind_no_go_deg: num(r.upwind_no_go_deg, DEFAULT_BOAT.upwind_no_go_deg),
    drive_efficiency: num(r.drive_efficiency, DEFAULT_BOAT.drive_efficiency),
  };
}
