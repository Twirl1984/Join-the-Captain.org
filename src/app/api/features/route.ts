import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getBoard } from "@/lib/data";
import { getOrCreateUser, getUser } from "@/lib/session";
import { moderateText, logModeration } from "@/lib/moderation";
import { runPipeline } from "@/lib/pipeline";
import { ok, fehler } from "@/lib/http";
import type { FeatureRequest } from "@/lib/types";

// GET /api/features — Karten der aktuellen Runde, sortiert nach Votes.
export async function GET() {
  const user = await getUser();
  const board = await getBoard(user?.id ?? null);
  return ok(board);
}

// POST /api/features — neuen Wunsch einreichen, dann KI-Pipeline anstoßen.
export async function POST(req: NextRequest) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return fehler("Ungültiger Body.");
  }

  const text = (body.text ?? "").trim();
  if (text.length < 8) {
    return fehler("Magst du deinen Wunsch etwas ausführlicher beschreiben?");
  }
  if (text.length > 2000) {
    return fehler("Das ist etwas lang. Fass dich bitte kürzer.");
  }

  const user = await getOrCreateUser();

  // Moderation zuerst. block = freundlich ablehnen.
  const mod = await moderateText(text);
  if (mod.verdict === "block") {
    await logModeration(null, mod, text);
    return fehler(
      "Diesen Wunsch können wir so nicht aufnehmen. Formulier ihn gern " +
        "freundlich neu — dann ist die Crew dabei.",
      422,
    );
  }

  // Einreichung anlegen (roh_text bleibt erhalten → Pipeline retrybar).
  const feature = await queryOne<FeatureRequest>(
    `INSERT INTO feature_request (autor_id, autor_name, titel, status, roh_text)
     VALUES ($1, $2, $3, 'neu', $4)
     RETURNING *`,
    [user.id, user.name, text.slice(0, 120), text],
  );
  if (!feature) return fehler("Konnte den Wunsch nicht speichern.", 500);

  if (mod.verdict === "flag") {
    await logModeration(feature.id, mod, text);
  }

  // Pipeline synchron anstoßen. Fehler hier sollen die Einreichung nicht
  // verlieren — der Wunsch bleibt 'neu' und ist per CLI/Endpoint retrybar.
  try {
    const result = await runPipeline(feature.id);
    return ok({ feature: result }, { status: 201 });
  } catch (err) {
    console.error("[features] Pipeline-Fehler:", err);
    return ok(
      {
        feature,
        hinweis:
          "Dein Wunsch ist gespeichert. Der Bot prüft ihn gleich — schau " +
          "in Kürze noch mal vorbei.",
      },
      { status: 201 },
    );
  }
}
