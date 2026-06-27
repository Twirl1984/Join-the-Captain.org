import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { ok, fehler } from "@/lib/http";
import type { AffiliateTool } from "@/lib/types";

// Affiliate-Klick erfassen und weiterleiten.
// Compliance: Klick läuft IMMER über diesen Endpoint (Tracking + Redirect),
// nie direkt auf die affiliate_url. Keine PII im Tracking (nur Referrer-Host).

async function track(id: string, req: NextRequest): Promise<AffiliateTool | null> {
  const tool = await queryOne<AffiliateTool>(
    "SELECT * FROM affiliate_tool WHERE id = $1 AND veroeffentlicht = true",
    [id],
  );
  if (!tool) return null;

  // Nur Host des Referrers speichern – keine vollständige URL mit PII.
  let referrerHost: string | null = null;
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      referrerHost = new URL(ref).host;
    } catch {
      referrerHost = null;
    }
  }

  await query(
    "INSERT INTO tool_click (tool_id, referrer) VALUES ($1, $2)",
    [id, referrerHost],
  );
  return tool;
}

// GET — direkter Link-Klick: erfassen, dann 302 auf die App.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tool = await track(id, req);
  if (!tool) return fehler("Tool nicht gefunden.", 404);
  if (!tool.affiliate_url) {
    return fehler("Für dieses Tool ist noch kein Link hinterlegt.", 409);
  }
  return NextResponse.redirect(tool.affiliate_url, 302);
}

// POST — programmatisch: erfassen, Ziel-URL zurückgeben.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tool = await track(id, req);
  if (!tool) return fehler("Tool nicht gefunden.", 404);
  return ok({ url: tool.affiliate_url });
}
