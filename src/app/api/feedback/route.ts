import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getOrCreateUser } from "@/lib/session";
import { reagiereAufFeedback } from "@/lib/research";
import { ok, fehler } from "@/lib/http";
import type { FeedbackSignal, FeedbackZielTyp } from "@/lib/types";

// POST /api/feedback — Community-Review für Scout-Funde.
// Body: { ziel_typ: "affiliate_tool"|"oss_kandidat", ziel_id: uuid,
//         signal: "melden"|"hilfreich", grund?: string }
//
// Auto-Publish ohne Handarbeit, aber die Crew ist die Review-Schicht: ab
// RESEARCH_MELDE_SCHWELLE Meldungen depubliziert der Scout den Fund und
// reiht das Thema zur erneuten Nacht-Recherche wieder ein.
const ZIEL_TYPEN: FeedbackZielTyp[] = ["affiliate_tool", "oss_kandidat"];
const SIGNALE: FeedbackSignal[] = ["melden", "hilfreich"];

export async function POST(req: NextRequest) {
  let body: { ziel_typ?: string; ziel_id?: string; signal?: string; grund?: string };
  try {
    body = await req.json();
  } catch {
    return fehler("Ungültiger Body.");
  }

  const zielTyp = body.ziel_typ as FeedbackZielTyp;
  const zielId = (body.ziel_id ?? "").trim();
  const signal = body.signal as FeedbackSignal;
  const grund = (body.grund ?? "").trim().slice(0, 500) || null;

  if (!ZIEL_TYPEN.includes(zielTyp)) return fehler("Unbekannter ziel_typ.");
  if (!SIGNALE.includes(signal)) return fehler("Unbekanntes signal.");
  if (!/^[0-9a-f-]{36}$/i.test(zielId)) return fehler("Ungültige ziel_id.");

  // Ziel muss existieren (kein Feedback ins Leere).
  const tabelle = zielTyp === "affiliate_tool" ? "affiliate_tool" : "oss_kandidat";
  const exists = await queryOne(`SELECT 1 FROM ${tabelle} WHERE id = $1`, [zielId]);
  if (!exists) return fehler("Ziel nicht gefunden.", 404);

  const user = await getOrCreateUser();

  // Ein Signal pro User pro Ziel (Upsert).
  await query(
    `INSERT INTO community_feedback (ziel_typ, ziel_id, user_id, signal, grund)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (ziel_typ, ziel_id, user_id)
     DO UPDATE SET signal = EXCLUDED.signal, grund = EXCLUDED.grund`,
    [zielTyp, zielId, user.id, signal, grund],
  );

  // Bei 'melden' prüfen, ob die Schwelle erreicht ist → reagieren.
  let reaktion = { depubliziert: false, meldungen: 0 };
  if (signal === "melden") {
    reaktion = await reagiereAufFeedback(zielTyp, zielId);
  }

  return ok({
    gespeichert: true,
    ...reaktion,
    hinweis: reaktion.depubliziert
      ? "Danke — wir nehmen das raus und schauen es uns noch mal an."
      : "Danke fürs Feedback.",
  });
}
