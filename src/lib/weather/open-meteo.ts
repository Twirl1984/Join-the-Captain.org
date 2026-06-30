// open-meteo.ts — Wetterdaten-Adapter für den Routen-Forecast.
//
// Holt freie Vorhersagen von Open-Meteo (kein API-Key) und baut daraus einen
// synchronen `sampleForecast(lat, lon, at)`, den route-forecast.ts injiziert
// bekommt. Datenquellen (1:1 aus dem jtc.de-Fetcher übernommen):
//   - Atmosphäre/Wind/Gewitter: api.open-meteo.com/v1/forecast
//   - Welle:                    marine-api.open-meteo.com/v1/marine
//
// Effizienz: pro Aufruf EIN Request je API (Multi-Location: alle Sample-Punkte
// als komma-getrennte Koordinaten). Caching via Next.js `revalidate` (1 h) —
// Open-Meteo aktualisiert ohnehin nur stündlich. So bleibt der Free-Tier-
// Verbrauch minimal. Bei kommerzieller Last: BASE-URLs + API-Key via env tauschen.

import { haversineNm, type Waypoint, type ForecastSample, type SampleForecast } from "./route-forecast";

const ATMO_BASE = process.env.OPEN_METEO_FORECAST_URL || "https://api.open-meteo.com/v1/forecast";
const MARINE_BASE = process.env.OPEN_METEO_MARINE_URL || "https://marine-api.open-meteo.com/v1/marine";
const API_KEY = process.env.OPEN_METEO_API_KEY || ""; // leer = Free-Tier

const GALE_KN = 34.0; // 8 Bft (Böen) → Sturm-Warnung
const CAPE_THRESH = 800.0; // grobe Gewitter-Proxy (J/kg) — wie im jtc.de-Fetcher
const REVALIDATE_S = 3600; // 1 h Cache (Open-Meteo-Update-Takt)

interface PointSeries {
  lat: number;
  lon: number;
  times: number[]; // ms-Timestamps (UTC), aufsteigend
  wind_speed_kn: number[];
  wind_gusts_kn: number[];
  wind_from_deg: number[];
  cape: number[];
  wave_height_m: (number | null)[];
}

/**
 * Holt Open-Meteo für alle `points` und liefert einen synchronen Sampler.
 * `points` sollten die Punkte abdecken, an denen route-forecast.ts sampelt
 * (die Leg-Mittelpunkte) — der Sampler ordnet jede Anfrage dem nächsten Punkt zu.
 */
export async function buildSampler(points: Waypoint[]): Promise<SampleForecast> {
  if (!points.length) throw new Error("Keine Sample-Punkte.");
  const series = await fetchSeries(points);

  return ({ lat, lon, at }): ForecastSample => {
    const ps = nearestSeries(series, { lat, lon });
    const i = nearestTimeIndex(ps.times, at.getTime());
    const wind = ps.wind_speed_kn[i] ?? 0;
    const gust = ps.wind_gusts_kn[i] ?? wind;
    const cape = ps.cape[i] ?? 0;
    const wave = ps.wave_height_m[i] ?? null;
    return {
      wind_speed_kn: wind,
      wind_from_deg: ps.wind_from_deg[i] ?? 0,
      gust_kn: gust,
      wave_height_m: wave,
      gale: gust >= GALE_KN,
      thunderstorm: cape >= CAPE_THRESH,
    };
  };
}

async function fetchSeries(points: Waypoint[]): Promise<PointSeries[]> {
  const lats = points.map((p) => p.lat).join(",");
  const lons = points.map((p) => p.lon).join(",");
  const key = API_KEY ? `&apikey=${encodeURIComponent(API_KEY)}` : "";

  const atmoUrl =
    `${ATMO_BASE}?latitude=${lats}&longitude=${lons}` +
    `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,cape` +
    `&wind_speed_unit=kn&timezone=UTC&forecast_days=7${key}`;
  const marineUrl =
    `${MARINE_BASE}?latitude=${lats}&longitude=${lons}` +
    `&hourly=wave_height&timezone=UTC&forecast_days=7${key}`;

  // Marine-API liefert für Binnen-/landnahe Punkte ggf. einen Fehler → tolerieren.
  const [atmo, marine] = await Promise.all([
    fetchJson(atmoUrl),
    fetchJson(marineUrl).catch(() => null),
  ]);

  const atmoLocs = asLocations(atmo);
  const marineLocs = marine ? asLocations(marine) : [];

  return points.map((p, idx) => {
    const a = atmoLocs[idx] ?? atmoLocs[0] ?? {};
    const m = marineLocs[idx] ?? marineLocs[0] ?? {};
    const aH = a.hourly ?? {};
    const mH = m.hourly ?? {};
    const times = (aH.time ?? []).map(parseUtc);
    return {
      lat: p.lat,
      lon: p.lon,
      times,
      wind_speed_kn: aH.wind_speed_10m ?? [],
      wind_gusts_kn: aH.wind_gusts_10m ?? [],
      wind_from_deg: aH.wind_direction_10m ?? [],
      cape: aH.cape ?? [],
      wave_height_m: alignWave(times, mH.time, mH.wave_height),
    };
  });
}

/** Open-Meteo liefert bei mehreren Koordinaten ein Array, bei einer ein Objekt. */
function asLocations(resp: unknown): OpenMeteoLocation[] {
  if (Array.isArray(resp)) return resp as OpenMeteoLocation[];
  if (resp && typeof resp === "object") return [resp as OpenMeteoLocation];
  return [];
}

/** Wellen-Serie auf das Atmo-Zeitraster mappen (Marine kann eigenes Raster haben). */
function alignWave(
  atmoTimes: number[],
  marineTimes?: string[],
  waves?: (number | null)[],
): (number | null)[] {
  if (!marineTimes || !waves) return atmoTimes.map(() => null);
  const byTime = new Map<number, number | null>();
  marineTimes.forEach((t, i) => byTime.set(parseUtc(t), waves[i] ?? null));
  return atmoTimes.map((t) => byTime.get(t) ?? null);
}

function nearestSeries(series: PointSeries[], at: Waypoint): PointSeries {
  let best = series[0];
  let bestD = Infinity;
  for (const s of series) {
    const d = haversineNm({ lat: s.lat, lon: s.lon }, at);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Index der zeitlich nächsten Stunde (clamped auf den verfügbaren Bereich). */
function nearestTimeIndex(times: number[], targetMs: number): number {
  if (!times.length) return 0;
  if (targetMs <= times[0]) return 0;
  if (targetMs >= times[times.length - 1]) return times.length - 1;
  // Binärsuche auf dem aufsteigenden Raster
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= targetMs) lo = mid;
    else hi = mid;
  }
  return targetMs - times[lo] <= times[hi] - targetMs ? lo : hi;
}

/** Open-Meteo-Zeit ("YYYY-MM-DDTHH:MM", UTC) → ms-Timestamp. */
function parseUtc(t: string): number {
  // Ohne Sekunden/Z ergänzen, sonst interpretiert JS den String als Lokalzeit.
  let s = t;
  if (/T\d\d:\d\d$/.test(s)) s += ":00";
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s += "Z";
  return Date.parse(s);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "JTC-Weather/1.0 (join-the-captain.org)" },
    next: { revalidate: REVALIDATE_S },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Open-Meteo ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

interface OpenMeteoLocation {
  hourly?: {
    time?: string[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
    wind_direction_10m?: number[];
    cape?: number[];
    wave_height?: (number | null)[];
  };
}
