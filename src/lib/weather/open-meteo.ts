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
import { classify, DEFAULT_SENSITIVITY, type WeatherMetrics } from "./warnings";

const ATMO_BASE = process.env.OPEN_METEO_FORECAST_URL || "https://api.open-meteo.com/v1/forecast";
const MARINE_BASE = process.env.OPEN_METEO_MARINE_URL || "https://marine-api.open-meteo.com/v1/marine";
// Archiv der damaligen VORHERSAGEN — für "hätte das Tool gewarnt?"-Validierung.
const ARCHIVE_BASE =
  process.env.OPEN_METEO_HISTORICAL_URL || "https://historical-forecast-api.open-meteo.com/v1/forecast";
const API_KEY = process.env.OPEN_METEO_API_KEY || ""; // leer = Free-Tier

const REVALIDATE_S = 3600; // 1 h Cache (Open-Meteo-Update-Takt)
const ARCHIVE_THRESHOLD_H = 12; // Fenster älter als das → Archiv-APIs

/** Zeitfenster, das der Sampler abdecken soll (Route: Start bis grobe Ankunft). */
export interface TimeWindow {
  start: Date;
  end: Date;
}

// ── Wettermodelle (transparent & wählbar) ────────────────────────────────────
// Open-Meteo bündelt viele nationale Modelle. Wir lassen EIN Modell je Anfrage
// zu (kein Variablen-Suffix-Problem) und erklären dem Nutzer die Wahl. Das
// datengetriebene JTC-Ranking je Revier folgt aus der Validierungsstudie.
export const WEATHER_MODELS = {
  best_match: {
    label: "Automatisch (best match)",
    grund: "Open-Meteo wählt je Region das lokal beste Modell — guter Default.",
  },
  icon_seamless: {
    label: "ICON (DWD)",
    grund: "Deutsches ICON: hohe Auflösung über Nord-/Ostsee und Mitteleuropa.",
  },
  ecmwf_ifs025: {
    label: "ECMWF IFS",
    grund: "Führendes globales Modell, besonders stark auf 3–7 Tage.",
  },
  gfs_seamless: {
    label: "GFS (NOAA)",
    grund: "Globales US-Modell — bewährte Vergleichsbasis.",
  },
} as const;

export type WeatherModel = keyof typeof WEATHER_MODELS;

export function parseModel(raw: unknown): WeatherModel {
  return typeof raw === "string" && raw in WEATHER_MODELS ? (raw as WeatherModel) : "best_match";
}

export interface SamplerOpts {
  sensitivity?: number;
  window?: TimeWindow;
  model?: WeatherModel;
}

interface PointSeries {
  lat: number;
  lon: number;
  times: number[]; // ms-Timestamps (UTC), aufsteigend
  wind_speed_kn: number[];
  wind_gusts_kn: number[];
  wind_from_deg: number[];
  cape: number[];
  cloud_pct: (number | null)[];
  /** Tag/Nacht (1/0) je Stunde — für das Himmels-Icon der Zeitreise (REQ-WET-014). */
  is_day: (number | null)[];
  wave_height_m: (number | null)[];
  current_kn: (number | null)[];
  current_to_deg: (number | null)[];
  /** Wasserstand rel. MSL (m) — Tide (REQ-NAV-012). */
  tide_m: (number | null)[];
}

/**
 * Holt Open-Meteo für alle `points` und liefert einen synchronen Sampler.
 * `points` sollten die Punkte abdecken, an denen route-forecast.ts sampelt
 * (die Leg-Mittelpunkte) — der Sampler ordnet jede Anfrage dem nächsten Punkt zu.
 */
export async function buildSampler(
  points: Waypoint[],
  opts: SamplerOpts = {},
): Promise<SampleForecast> {
  if (!points.length) throw new Error("Keine Sample-Punkte.");
  const sensitivity = opts.sensitivity ?? DEFAULT_SENSITIVITY;
  const series = await fetchSeries(points, opts.window, opts.model);

  return ({ lat, lon, at }): ForecastSample => {
    const ps = nearestSeries(series, { lat, lon });
    const i = nearestTimeIndex(ps.times, at.getTime());
    const wind = ps.wind_speed_kn[i] ?? 0;
    const gust = ps.wind_gusts_kn[i] ?? wind;
    const metrics: WeatherMetrics = {
      gust_kn: gust,
      wind_speed_kn: wind,
      cape: ps.cape[i] ?? 0,
      wave_height_m: ps.wave_height_m[i] ?? null,
    };
    // Warn-Flags über die einstellbare Risiko-Klassifikation (warnings.ts).
    const w = classify(metrics, sensitivity);
    return {
      wind_speed_kn: wind,
      wind_from_deg: ps.wind_from_deg[i] ?? 0,
      gust_kn: gust,
      wave_height_m: metrics.wave_height_m,
      current_kn: ps.current_kn[i] ?? null,
      current_to_deg: ps.current_to_deg[i] ?? null,
      tide_m: ps.tide_m[i] ?? null,
      gale: w.sturm,
      thunderstorm: w.gewitter,
      high_wave: w.welle,
    };
  };
}

/** true, wenn das Fenster klar in der Vergangenheit liegt → Archiv-APIs. */
export function isArchiveWindow(window?: TimeWindow): boolean {
  if (!window) return false;
  return window.end.getTime() < Date.now() - ARCHIVE_THRESHOLD_H * 3600e3;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function fetchSeries(
  points: Waypoint[],
  window?: TimeWindow,
  model: WeatherModel = "best_match",
): Promise<PointSeries[]> {
  const lats = points.map((p) => p.lat).join(",");
  const lons = points.map((p) => p.lon).join(",");
  const key = API_KEY ? `&apikey=${encodeURIComponent(API_KEY)}` : "";
  // best_match = Open-Meteo-Default (kein Param); sonst genau EIN Modell.
  const modelParam = model === "best_match" ? "" : `&models=${model}`;

  // Zukunft: Live-Forecast (+7 Tage Rückblick — deckt lückenlos alles ab, was
  // nicht schon im Archiv-Modus landet). Vergangenheit: archivierte Vorhersagen
  // + historische Wellen über start_date/end_date — damit lassen sich vergangene
  // Sturm-/Gewitterlagen nachstellen ("hätte das Tool gewarnt?").
  let atmoBase = ATMO_BASE;
  let range = `&past_days=7&forecast_days=7`;
  let marineRange = `&past_days=7&forecast_days=7`;
  if (isArchiveWindow(window) && window) {
    atmoBase = ARCHIVE_BASE;
    const startD = isoDate(window.start);
    // +1 Tag Puffer hinter der erwarteten Ankunft, aber nie in der Zukunft.
    const endMs = Math.min(window.end.getTime() + 24 * 3600e3, Date.now());
    const endD = isoDate(new Date(endMs));
    range = `&start_date=${startD}&end_date=${endD}`;
    marineRange = range;
  }

  const atmoUrl =
    `${atmoBase}?latitude=${lats}&longitude=${lons}` +
    `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,cape,cloud_cover,is_day` +
    `&wind_speed_unit=kn&timezone=UTC${range}${modelParam}${key}`;
  const marineUrl =
    `${MARINE_BASE}?latitude=${lats}&longitude=${lons}` +
    `&hourly=wave_height,ocean_current_velocity,ocean_current_direction,sea_level_height_msl&timezone=UTC${marineRange}${key}`;

  // Marine-API liefert für Binnen-/landnahe Punkte ggf. einen Fehler → tolerieren.
  const [atmo, marine] = await Promise.all([
    fetchJson(atmoUrl),
    fetchJson(marineUrl).catch(() => null),
  ]);

  const atmoLocs = asLocations(atmo);
  const marineLocs = marine ? asLocations(marine) : [];

  // Antworten müssen 1:1 zu den angefragten Punkten passen. Atmo-Mismatch ist
  // ein harter Fehler (sonst rechnen wir mit dem Wetter des falschen Punktes);
  // Marine-Mismatch heißt nur: keine Wellendaten — nie Punkt 0 wiederverwenden.
  if (atmoLocs.length !== points.length) {
    throw new Error(`Open-Meteo: ${atmoLocs.length} statt ${points.length} Punkte erhalten.`);
  }
  const marineOk = marineLocs.length === points.length;

  return points.map((p, idx) => {
    const a = atmoLocs[idx];
    const m = marineOk ? marineLocs[idx] : undefined;
    const aH = a.hourly ?? {};
    const mH = m?.hourly ?? {};
    const times = (aH.time ?? []).map(parseUtc);
    return {
      lat: p.lat,
      lon: p.lon,
      times,
      wind_speed_kn: aH.wind_speed_10m ?? [],
      wind_gusts_kn: aH.wind_gusts_10m ?? [],
      wind_from_deg: aH.wind_direction_10m ?? [],
      cape: aH.cape ?? [],
      cloud_pct: aH.cloud_cover ?? times.map(() => null),
      is_day: aH.is_day ?? times.map(() => null),
      wave_height_m: alignWave(times, mH.time, mH.wave_height),
      // Open-Meteo liefert Strömung in km/h → Knoten; Richtung = WOHIN sie setzt.
      current_kn: alignWave(times, mH.time, mH.ocean_current_velocity).map((v) =>
        v == null ? null : Math.round((v / 1.852) * 10) / 10,
      ),
      current_to_deg: alignWave(times, mH.time, mH.ocean_current_direction),
      tide_m: alignWave(times, mH.time, mH.sea_level_height_msl),
    };
  });
}

// ── Timeline fürs Playback ───────────────────────────────────────────────────

/** Ein Zeitschritt an einem Punkt (fürs Karten-Overlay). */
export interface TimelineStep {
  t: string; // ISO
  wind_kn: number;
  gust_kn: number;
  wind_from_deg: number;
  cloud_pct: number | null;
  /** Tag (true) / Nacht (false) — steuert das Himmels-Icon; null = unbekannt. */
  is_day: boolean | null;
  wave_m: number | null;
  tide_m: number | null;
  gale: boolean;
  thunderstorm: boolean;
  high_wave: boolean;
}

export interface TimelinePoint {
  lat: number;
  lon: number;
  steps: TimelineStep[];
}

/**
 * Zeitreihen für das Playback: je Punkt die Schritte im Fenster (Raster stepH),
 * inkl. Warn-Flags gemäß Risiko-Regler. Alle Punkte teilen dasselbe Zeitraster
 * (das der UI-Slider abspielt).
 */
export async function buildTimeline(
  points: Waypoint[],
  opts: SamplerOpts & { stepH?: number } = {},
): Promise<{ times: string[]; points: TimelinePoint[] }> {
  if (!points.length) throw new Error("Keine Sample-Punkte.");
  const sensitivity = opts.sensitivity ?? DEFAULT_SENSITIVITY;
  const stepH = Math.max(1, opts.stepH ?? 3);
  const window = opts.window;
  const series = await fetchSeries(points, window, opts.model);

  // Gemeinsames Zeitraster aus dem ersten Punkt, auf das Fenster beschnitten.
  const base = series[0];
  const startMs = window?.start.getTime() ?? base.times[0];
  const endMs = window?.end.getTime() ?? base.times[base.times.length - 1];
  const idxs: number[] = [];
  for (let i = 0; i < base.times.length; i++) {
    const t = base.times[i];
    if (t >= startMs - 1 && t <= endMs + 1) idxs.push(i);
  }
  const stepped = idxs.filter((_, k) => k % stepH === 0);
  const times = stepped.map((i) => new Date(base.times[i]).toISOString());

  const outPoints: TimelinePoint[] = series.map((ps) => ({
    lat: ps.lat,
    lon: ps.lon,
    steps: stepped.map((i) => {
      const wind = ps.wind_speed_kn[i] ?? 0;
      const gust = ps.wind_gusts_kn[i] ?? wind;
      const metrics: WeatherMetrics = {
        gust_kn: gust,
        wind_speed_kn: wind,
        cape: ps.cape[i] ?? 0,
        wave_height_m: ps.wave_height_m[i] ?? null,
      };
      const w = classify(metrics, sensitivity);
      return {
        t: new Date(ps.times[i] ?? base.times[i]).toISOString(),
        wind_kn: Math.round(wind),
        gust_kn: Math.round(gust),
        wind_from_deg: Math.round(ps.wind_from_deg[i] ?? 0),
        cloud_pct: ps.cloud_pct[i] ?? null,
        is_day: ps.is_day[i] == null ? null : ps.is_day[i] === 1,
        wave_m: ps.wave_height_m[i] != null ? Math.round(ps.wave_height_m[i]! * 10) / 10 : null,
        tide_m: ps.tide_m[i] != null ? Math.round(ps.tide_m[i]! * 100) / 100 : null,
        gale: w.sturm,
        thunderstorm: w.gewitter,
        high_wave: w.welle,
      };
    }),
  }));

  return { times, points: outPoints };
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

// RequestInit + Next.js-Cache-Option (Next augmentiert RequestInit zur Laufzeit;
// lokal typisiert, damit die Datei auch isoliert typecheckt).
type NextFetchInit = RequestInit & { next?: { revalidate?: number } };

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "JTC-Weather/1.0 (join-the-captain.org)" },
    // Harter Timeout: ein hängendes Open-Meteo darf keine Worker binden
    // (gilt zentral für route/departure/timeline/navigation).
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: REVALIDATE_S },
  } as NextFetchInit);
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
    cloud_cover?: (number | null)[];
    is_day?: (number | null)[];
    wave_height?: (number | null)[];
    ocean_current_velocity?: (number | null)[];
    ocean_current_direction?: (number | null)[];
    sea_level_height_msl?: (number | null)[];
  };
}
