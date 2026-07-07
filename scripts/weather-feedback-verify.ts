// weather-feedback-verify.ts — schließt den Feedback-Loop.
//
// Nimmt unverifizierte Feedbacks mit vollständigem Abfrage-Kontext
// (weather_feedback.kontext_json: Route, Zeitraum, eingestelltes Modell, Plan),
// und prüft für den bewerteten Zeitraum an den Routen-Punkten:
//   WAHRHEIT  = ERA5-Reanalyse (archive-api): Wind + Böen, stündlich
//   KANDIDATEN = damalige Vorhersagen JEDES Modells (historical-forecast-api)
// → MAE je Modell/Größe → laufendes Mittel in weather_model_score (je Revier).
//
// Damit beantwortet sich "war ein anderes Modell für den Ort besser?" mit Daten,
// und das Ranking speist die Modell-Empfehlung je Revier.
//
// Lauf (Netz + DATABASE_URL nötig, z.B. auf dem VPS oder gegen die Test-DB):
//   DATABASE_URL=postgres://... npx tsx scripts/weather-feedback-verify.ts
// Nur Feedbacks, deren Törn-Zeitraum ≥12 h vorbei ist, sind prüfbar (Rest bleibt offen).
import { Pool } from "pg";

const MODELS = ["best_match", "icon_seamless", "ecmwf_ifs025", "gfs_seamless"] as const;
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const HIST_FC = "https://historical-forecast-api.open-meteo.com/v1/forecast";

interface Wp { lat: number; lon: number }
interface Ctx {
  revier?: string;
  waypoints?: Wp[];
  startTime?: string;
  model?: string;
  plan?: { eta?: string };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")
    ? undefined
    : { rejectUnauthorized: false },
});

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": "JTC-Weather-Verify/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 100)}`);
  return res.json();
}

interface Hourly { time?: string[]; wind_speed_10m?: (number | null)[]; wind_gusts_10m?: (number | null)[] }
type Loc = { hourly?: Hourly };
const asLocs = (r: unknown): Loc[] => (Array.isArray(r) ? (r as Loc[]) : r ? [r as Loc] : []);

/** MAE zweier Stundenreihen über die Schnittmenge der Zeitstempel im Fenster. */
export function maeOver(
  predT: string[], predV: (number | null)[],
  truthT: string[], truthV: (number | null)[],
  fromMs: number, toMs: number,
): { mae: number; n: number } {
  const truth = new Map<string, number>();
  truthT.forEach((t, i) => {
    const v = truthV[i];
    if (v != null) truth.set(t, v);
  });
  let sum = 0;
  let n = 0;
  predT.forEach((t, i) => {
    const ms = Date.parse(t.endsWith("Z") ? t : t + ":00Z");
    if (ms < fromMs || ms > toMs) return;
    const p = predV[i];
    const o = truth.get(t);
    if (p == null || o == null) return;
    sum += Math.abs(p - o);
    n++;
  });
  return { mae: n ? sum / n : NaN, n };
}

async function verifyCase(ctx: Ctx): Promise<Record<string, { wind: number; gust: number; n: number }> | null> {
  const wps = ctx.waypoints ?? [];
  if (wps.length < 2 || !ctx.startTime || !ctx.plan?.eta) return null;
  const fromMs = Date.parse(ctx.startTime);
  const toMs = Date.parse(ctx.plan.eta) + 3 * 3600e3;
  if (!(toMs < Date.now() - 12 * 3600e3)) return null; // noch nicht prüfbar

  const mids: Wp[] = [];
  for (let i = 0; i < wps.length - 1; i++) {
    mids.push({ lat: (wps[i].lat + wps[i + 1].lat) / 2, lon: (wps[i].lon + wps[i + 1].lon) / 2 });
  }
  const lats = mids.map((p) => p.lat).join(",");
  const lons = mids.map((p) => p.lon).join(",");
  const range = `&start_date=${isoDate(fromMs)}&end_date=${isoDate(toMs)}&wind_speed_unit=kn&timezone=UTC`;
  const vars = `&hourly=wind_speed_10m,wind_gusts_10m`;

  const truthLocs = asLocs(await fetchJson(`${ARCHIVE}?latitude=${lats}&longitude=${lons}${vars}${range}`));
  const out: Record<string, { wind: number; gust: number; n: number }> = {};

  for (const model of MODELS) {
    const mp = model === "best_match" ? "" : `&models=${model}`;
    const predLocs = asLocs(await fetchJson(`${HIST_FC}?latitude=${lats}&longitude=${lons}${vars}${range}${mp}`));
    if (predLocs.length !== truthLocs.length) continue;
    let windSum = 0, gustSum = 0, nSum = 0, k = 0;
    predLocs.forEach((pl, i) => {
      const tl = truthLocs[i];
      const w = maeOver(pl.hourly?.time ?? [], pl.hourly?.wind_speed_10m ?? [], tl.hourly?.time ?? [], tl.hourly?.wind_speed_10m ?? [], fromMs, toMs);
      const g = maeOver(pl.hourly?.time ?? [], pl.hourly?.wind_gusts_10m ?? [], tl.hourly?.time ?? [], tl.hourly?.wind_gusts_10m ?? [], fromMs, toMs);
      if (w.n > 0) { windSum += w.mae; gustSum += Number.isNaN(g.mae) ? w.mae : g.mae; nSum += w.n; k++; }
    });
    if (k > 0) out[model] = { wind: windSum / k, gust: gustSum / k, n: nSum };
  }
  return Object.keys(out).length ? out : null;
}

async function upsertScore(revier: string, model: string, variable: string, mae: number, n: number) {
  await pool.query(
    `INSERT INTO weather_model_score (revier, model, var, mae_kn, n_samples, n_feedbacks)
     VALUES ($1,$2,$3,$4,$5,1)
     ON CONFLICT (revier, model, var) DO UPDATE SET
       mae_kn = (weather_model_score.mae_kn * weather_model_score.n_samples + EXCLUDED.mae_kn * EXCLUDED.n_samples)
                / NULLIF(weather_model_score.n_samples + EXCLUDED.n_samples, 0),
       n_samples = weather_model_score.n_samples + EXCLUDED.n_samples,
       n_feedbacks = weather_model_score.n_feedbacks + 1,
       updated_at = now()`,
    [revier, model, variable, mae, n],
  );
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, vorhersage_ok, kontext_json FROM weather_feedback
     WHERE kontext_json IS NOT NULL AND verifiziert_am IS NULL ORDER BY created_at`,
  );
  console.error(`Offene Feedbacks mit Kontext: ${rows.length}`);
  let done = 0, pending = 0;

  for (const row of rows) {
    const ctx = row.kontext_json as Ctx;
    const revier = ctx.revier ?? "unbekannt";
    let scores: Awaited<ReturnType<typeof verifyCase>> = null;
    try {
      scores = await verifyCase(ctx);
    } catch (e) {
      console.error(`  ${row.id}: Fehler (${(e as Error).message}) — bleibt offen`);
      continue;
    }
    if (!scores) { pending++; continue; }

    for (const [model, s] of Object.entries(scores)) {
      await upsertScore(revier, model, "wind", s.wind, s.n);
      await upsertScore(revier, model, "gust", s.gust, s.n);
    }
    const best = Object.entries(scores).sort((a, b) => a[1].gust - b[1].gust)[0];
    const eingestellt = ctx.model ?? "best_match";
    console.error(
      `  ${row.id} [${revier}] ok=${row.vorhersage_ok}: eingestellt=${eingestellt} · ` +
      `bestes Modell (Böen-MAE)=${best[0]} (${best[1].gust.toFixed(1)} kn)` +
      (best[0] !== eingestellt && row.vorhersage_ok === false ? "  ← Wechsel-Kandidat!" : ""),
    );
    await pool.query(`UPDATE weather_feedback SET verifiziert_am = now() WHERE id = $1`, [row.id]);
    done++;
  }

  const { rows: ranking } = await pool.query(
    `SELECT revier, model, var, round(mae_kn::numeric, 2) AS mae, n_samples, n_feedbacks
     FROM weather_model_score ORDER BY revier, var, mae_kn`,
  );
  console.error(`\nVerifiziert: ${done} · noch nicht prüfbar (Törn läuft/liegt vor): ${pending}`);
  console.error("Modell-Ranking je Revier (kleiner = besser):");
  for (const r of ranking) {
    console.error(`  ${r.revier} · ${r.var}: ${r.model} MAE ${r.mae} kn (n=${r.n_samples}, aus ${r.n_feedbacks} Feedbacks)`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error("FEHLER:", e);
  process.exit(1);
});
