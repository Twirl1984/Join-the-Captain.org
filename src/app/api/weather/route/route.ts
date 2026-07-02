import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { planRoute, type Waypoint } from "@/lib/weather/route-forecast";
import { buildSampler } from "@/lib/weather/open-meteo";
import { RECOMMENDED_SENSITIVITY } from "@/lib/weather/warnings";
import { DEFAULT_BOAT, type Boat, type SailMode } from "@/lib/weather/polar";

export const runtime = "nodejs";

const MAX_WAYPOINTS = 25; // begrenzt Open-Meteo-URL-Länge & Free-Tier-Last
const MAX_BODY_BYTES = 64 * 1024; // Route-Payloads sind winzig; alles darüber ist Missbrauch
const MAX_NAME_LEN = 80; // Wegpunkt-Namen kappen (kommen 1:1 in die Antwort zurück)
const FORECAST_HORIZON_DAYS = 7; // freie Open-Meteo-Vorhersage reicht 7 Tage
const PAST_TOLERANCE_H = 3; // etwas Kulanz für "Abfahrt vorhin"

// POST /api/weather/route
// Body: { waypoints: [{lat,lon,name?}], startTime?, mode?, sensitivity?, boat? }
// → Legs + ETA + Wetter + Warnungen entlang der Route (route-forecast.ts).
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

  const startTime = b.startTime ? new Date(String(b.startTime)) : new Date();
  if (Number.isNaN(startTime.getTime())) return fehler("startTime ist kein gültiges Datum.");
  // Außerhalb des Vorhersagefensters würden wir sonst still die nächste
  // verfügbare Stunde nehmen und einen scheinbar echten Plan liefern — bei
  // einem Sicherheits-Tool irreführend. Lieber ehrlich ablehnen (422).
  const now = Date.now();
  if (startTime.getTime() > now + FORECAST_HORIZON_DAYS * 24 * 3600e3) {
    return fehler(
      `Die freie Vorhersage reicht nur ${FORECAST_HORIZON_DAYS} Tage voraus. Bitte einen früheren Start wählen.`,
      422,
    );
  }
  if (startTime.getTime() < now - PAST_TOLERANCE_H * 3600e3) {
    return fehler("Die Abfahrt liegt in der Vergangenheit — bitte eine kommende Startzeit wählen.", 422);
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
    // Details (Upstream-Bodies, URLs) nur ins Server-Log — nie an den Client.
    console.error("weather/route:", e);
    return fehler("Wetterdaten konnten nicht geladen werden — bitte später erneut versuchen.", 502);
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
    out.push({
      lat,
      lon,
      // Namen kappen — sie wandern in Warntexte/Antwort zurück.
      name: typeof w.name === "string" ? w.name.slice(0, MAX_NAME_LEN) : undefined,
    });
  }
  return out;
}

// Boot-Parameter nur übernehmen, wenn sie physikalisch plausibel sind —
// z.B. verhindert das cruise_speed_motor_kn=0 (→ Infinity-Legdauer).
function mergeBoat(raw: unknown): Boat {
  if (!raw || typeof raw !== "object") return DEFAULT_BOAT;
  const r = raw as Record<string, unknown>;
  const pos = (v: unknown, fallback: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= max ? n : fallback;
  };
  return {
    name: typeof r.name === "string" ? r.name.slice(0, MAX_NAME_LEN) : DEFAULT_BOAT.name,
    cruise_speed_motor_kn: pos(r.cruise_speed_motor_kn, DEFAULT_BOAT.cruise_speed_motor_kn, 30),
    hull_speed_kn: pos(r.hull_speed_kn, DEFAULT_BOAT.hull_speed_kn, 40),
    upwind_no_go_deg: pos(r.upwind_no_go_deg, DEFAULT_BOAT.upwind_no_go_deg, 90),
    drive_efficiency: pos(r.drive_efficiency, DEFAULT_BOAT.drive_efficiency, 1),
  };
}
