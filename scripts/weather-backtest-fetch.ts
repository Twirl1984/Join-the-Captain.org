// weather-backtest-fetch.ts — baut den historischen Backtest-Datensatz.
//
// Für jeden Revier-Hafen holt es zwei Zeitreihen von Open-Meteo (frei, kein Key):
//   VORHERSAGE (was das Modell sagte): historical-forecast-api  (Böen, Wind, CAPE)
//   WAHRHEIT   (was wirklich eintrat) : archive-api (ERA5)       (Böen, weather_code)
// und verknüpft sie stundengenau zu LabeledSample-Zeilen (fixtures/weather-backtest.jsonl).
//
// Die WAHRHEIT nutzt feste physikalische Schwellen (unabhängig vom Regler):
//   sturm    = beobachtete Böe ≥ 34 kn (8 Bft)
//   gewitter = weather_code ∈ {95,96,99}  (ERA5-abgeleitet; Konvektion ist schwach
//              erfasst → bekannte Limitierung, s. docs/weather-test-plan.md)
//   welle    = (nicht belegt: keine unabhängige Wellen-Wahrheit → false)
// Der Regler (sensitivity) wirkt NUR auf die VORHERSAGE-Klassifikation im Backtest.
//
// Lauf (Netz nötig):
//   npx tsx scripts/weather-backtest-fetch.ts 2025-06-01 2025-08-31
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REVIERE } from "../src/lib/weather/reviere";
import type { LabeledSample } from "../src/lib/weather/backtest";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(REPO, "fixtures", "weather-backtest.jsonl");

const GALE_TRUTH_KN = 34; // 8 Bft — "Sturm trat ein"
const TSTORM_CODES = new Set([95, 96, 99]);

const PRED_BASE = "https://historical-forecast-api.open-meteo.com/v1/forecast";
const TRUTH_BASE = "https://archive-api.open-meteo.com/v1/archive";

const POINTS = REVIERE.flatMap((r) =>
  r.haefen.map((h) => ({ id: `${r.id}:${h.name}`, lat: h.lat, lon: h.lon })),
);

interface Loc {
  hourly?: Record<string, (number | null)[] | string[]>;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": "JTC-Weather-Backtest/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 80)}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function asLocations(resp: unknown): Loc[] {
  if (Array.isArray(resp)) return resp as Loc[];
  if (resp && typeof resp === "object") return [resp as Loc];
  return [];
}

async function main() {
  const start = process.argv[2] || "2025-06-01";
  const end = process.argv[3] || "2025-08-31";
  const lats = POINTS.map((p) => p.lat).join(",");
  const lons = POINTS.map((p) => p.lon).join(",");
  const range = `&start_date=${start}&end_date=${end}&wind_speed_unit=kn&timezone=UTC`;

  const predUrl = `${PRED_BASE}?latitude=${lats}&longitude=${lons}&hourly=wind_speed_10m,wind_gusts_10m,cape${range}`;
  const truthUrl = `${TRUTH_BASE}?latitude=${lats}&longitude=${lons}&hourly=wind_gusts_10m,weather_code${range}`;

  console.error(`Fetch ${POINTS.length} Punkte, ${start}..${end} …`);
  const [predResp, truthResp] = await Promise.all([fetchJson(predUrl), fetchJson(truthUrl)]);
  const pred = asLocations(predResp);
  const truth = asLocations(truthResp);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const fd = fs.openSync(OUT, "w");
  let n = 0;
  let stormTruth = 0;
  let tstormTruth = 0;
  let capeMissing = 0;

  POINTS.forEach((pt, idx) => {
    const p = pred[idx]?.hourly;
    const tr = truth[idx]?.hourly;
    if (!p || !tr) return;
    const pTime = (p.time as string[]) || [];
    const tTime = (tr.time as string[]) || [];
    const pGust = (p.wind_gusts_10m as (number | null)[]) || [];
    const pWind = (p.wind_speed_10m as (number | null)[]) || [];
    const pCape = (p.cape as (number | null)[]) || [];
    const tGust = (tr.wind_gusts_10m as (number | null)[]) || [];
    const tCode = (tr.weather_code as (number | null)[]) || [];

    const truthByTime = new Map<string, number>();
    tTime.forEach((t, i) => truthByTime.set(t, i));

    pTime.forEach((t, i) => {
      const j = truthByTime.get(t);
      if (j === undefined) return;
      const predGust = pGust[i];
      const obsGust = tGust[j];
      if (predGust == null || obsGust == null) return; // ohne beides kein Sample
      const cape = pCape[i];
      if (cape == null) capeMissing++;
      const code = tCode[j];
      const obsSturm = obsGust >= GALE_TRUTH_KN;
      const obsGewitter = code != null && TSTORM_CODES.has(code);
      if (obsSturm) stormTruth++;
      if (obsGewitter) tstormTruth++;

      const sample: LabeledSample = {
        point_id: pt.id,
        valid_at: t,
        metrics: {
          gust_kn: predGust,
          wind_speed_kn: pWind[i] ?? undefined,
          cape: cape ?? 0,
          wave_height_m: null,
        },
        observed: { sturm: obsSturm, gewitter: obsGewitter, welle: false },
        observed_gust_kn: obsGust,
      };
      fs.writeSync(fd, JSON.stringify(sample) + "\n");
      n++;
    });
  });
  fs.closeSync(fd);
  console.error(
    `OK: ${n} Samples → ${path.relative(REPO, OUT)} · Sturm-Wahrheit=${stormTruth} · Gewitter-Wahrheit=${tstormTruth} · CAPE fehlt in ${capeMissing}`,
  );
}

main().catch((e) => {
  console.error("FEHLER:", e.message);
  process.exit(1);
});
