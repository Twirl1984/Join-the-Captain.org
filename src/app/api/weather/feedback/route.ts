import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getOrCreateUser } from "@/lib/session";
import { ok, fehler } from "@/lib/http";
import { MAX_BODY_BYTES } from "@/lib/weather/api-helpers";

export const runtime = "nodejs";

// POST /api/weather/feedback — Feedback-Schleife des Wetter-Tools.
// Body: { zufriedenheit?: 1..5, vorhersage_ok?: boolean, freitext?: string,
//         kontext?: {waypoints, startTime, sensitivity, source, eta} }
// Mindestens EIN inhaltliches Feld muss gesetzt sein. kontext hält die Planung
// fest, damit "Vorhersage war falsch" später gegen Archivdaten prüfbar ist.
export async function POST(req: NextRequest) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return fehler("Anfrage zu groß.", 413);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fehler("Ungültiger Body.");
  }

  const zufriedenheit = body.zufriedenheit == null ? null : Number(body.zufriedenheit);
  if (zufriedenheit != null && !(Number.isInteger(zufriedenheit) && zufriedenheit >= 1 && zufriedenheit <= 5)) {
    return fehler("zufriedenheit: 1–5 oder weglassen.");
  }
  const vorhersageOk = typeof body.vorhersage_ok === "boolean" ? body.vorhersage_ok : null;
  const freitext = typeof body.freitext === "string" ? body.freitext.trim().slice(0, 2000) || null : null;
  if (zufriedenheit == null && vorhersageOk == null && !freitext) {
    return fehler("Leeres Feedback — mindestens eine Angabe machen.");
  }
  // Optionale Kontaktdaten (für Rückfragen) — freiwillig, grob geprüft, gekappt.
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) || null : null;
  let email: string | null = null;
  if (typeof body.email === "string" && body.email.trim()) {
    const e = body.email.trim().slice(0, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
      return fehler("email: bitte eine gültige Adresse angeben oder das Feld leer lassen.");
    }
    email = e;
  }
  // Kontext nur als geprüftes, kompaktes JSON übernehmen (kein Blob-Durchgriff).
  let kontext: string | null = null;
  if (body.kontext && typeof body.kontext === "object") {
    const s = JSON.stringify(body.kontext);
    if (s.length <= 8000) kontext = s;
  }

  const user = await getOrCreateUser().catch(() => null);

  await query(
    `INSERT INTO weather_feedback (user_id, zufriedenheit, vorhersage_ok, freitext, kontext_json, name, email)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
    [user?.id ?? null, zufriedenheit, vorhersageOk, freitext, kontext, name, email],
  );
  return ok({ ok: true });
}
