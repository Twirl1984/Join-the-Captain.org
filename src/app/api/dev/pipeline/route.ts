import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { ok, fehler } from "@/lib/http";

// POST /api/dev/pipeline — Pipeline manuell triggern (Test).
//   Body: { id: "<feature_id>" }  oder  { all_neu: true }
// Nur außerhalb der Produktion erreichbar.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return fehler("Nicht verfügbar.", 404);
  }

  let body: { id?: string; all_neu?: boolean };
  try {
    body = await req.json();
  } catch {
    return fehler("Ungültiger Body.");
  }

  let ids: string[];
  if (body.all_neu) {
    const rows = await query<{ id: string }>(
      "SELECT id FROM feature_request WHERE status IN ('neu','in_pruefung') ORDER BY created_at",
    );
    ids = rows.map((r) => r.id);
  } else if (body.id) {
    ids = [body.id];
  } else {
    return fehler("id oder all_neu erforderlich.");
  }

  const ergebnisse = [];
  for (const id of ids) {
    try {
      const result = await runPipeline(id);
      ergebnisse.push({ id, status: result.status, size: result.size });
    } catch (err) {
      ergebnisse.push({ id, fehler: String(err) });
    }
  }
  return ok({ ergebnisse });
}
