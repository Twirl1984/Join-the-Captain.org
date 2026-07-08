import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { ok } from "@/lib/http";
import { WEATHER_MODELS } from "@/lib/weather/open-meteo";

export const runtime = "nodejs";

// GET /api/weather/model-scores?revier=ostsee
// Liefert das gemessene Modell-Ranking des Reviers (aus dem Feedback-Loop:
// weather_model_score, gepflegt vom wöchentlichen Verify-Lauf) und die daraus
// folgende Empfehlung (kleinste Böen-MAE, min. 24 Stichproben-Stunden).
// Ohne DB / ohne Messungen: empfehlung=null — die UI zeigt dann nichts an.
const MIN_SAMPLES = 24;

export interface ModelScoreRow {
  model: string;
  label: string;
  mae_gust_kn: number | null;
  mae_wind_kn: number | null;
  n_samples: number;
  n_feedbacks: number;
}

export async function GET(req: NextRequest) {
  const revier = (req.nextUrl.searchParams.get("revier") ?? "").slice(0, 60);
  if (!revier) return ok({ revier: null, empfehlung: null, scores: [] });

  try {
    const rows = await query<{
      model: string;
      var: string;
      mae_kn: number;
      n_samples: number;
      n_feedbacks: number;
    }>(
      `SELECT model, var, mae_kn, n_samples, n_feedbacks
       FROM weather_model_score WHERE revier = $1`,
      [revier],
    );
    const byModel = new Map<string, ModelScoreRow>();
    for (const r of rows) {
      const label =
        (WEATHER_MODELS as Record<string, { label: string }>)[r.model]?.label ?? r.model;
      const e = byModel.get(r.model) ?? {
        model: r.model, label, mae_gust_kn: null, mae_wind_kn: null,
        n_samples: 0, n_feedbacks: 0,
      };
      if (r.var === "gust") e.mae_gust_kn = Math.round(r.mae_kn * 10) / 10;
      if (r.var === "wind") e.mae_wind_kn = Math.round(r.mae_kn * 10) / 10;
      e.n_samples = Math.max(e.n_samples, r.n_samples);
      e.n_feedbacks = Math.max(e.n_feedbacks, r.n_feedbacks);
      byModel.set(r.model, e);
    }
    const scores = [...byModel.values()].sort(
      (a, b) => (a.mae_gust_kn ?? 99) - (b.mae_gust_kn ?? 99),
    );
    // Empfehlung: bestes Modell nach Böen-MAE (sicherheitsrelevanteste Größe),
    // erst ab MIN_SAMPLES Stunden — eine Einzelmessung empfiehlt noch nichts.
    const best = scores.find((s) => s.mae_gust_kn != null && s.n_samples >= MIN_SAMPLES) ?? null;
    return ok({ revier, empfehlung: best, scores });
  } catch {
    // DB nicht erreichbar (z.B. lokaler Lauf ohne DATABASE_URL) → leise leer.
    return ok({ revier, empfehlung: null, scores: [] });
  }
}
