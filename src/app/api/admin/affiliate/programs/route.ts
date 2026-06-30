// GET /api/admin/affiliate/programs — Liste aller Affiliate-Programme
// PATCH /api/admin/affiliate/programs/[id] — Status + affiliate_url aktualisieren
//
// Abgesichert: Session-Stub (getUser() != null). Für Produktion: echtes Admin-Auth.

import { query, queryOne } from "@/lib/db";
import { getUser } from "@/lib/session";
import { ok, fehler } from "@/lib/http";
import type { AffiliateProgramm } from "@/lib/types";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return fehler("Unauthorized", 401);
  }

  try {
    const programmes = await query<AffiliateProgramm>(
      `SELECT * FROM affiliate_programm
       ORDER BY status DESC, created_at DESC`,
    );
    return ok({ programmes });
  } catch (err) {
    console.error("[affiliate-programs] GET fehler:", err);
    return fehler("Internal server error", 500);
  }
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return fehler("Unauthorized", 401);
  }

  try {
    const { id, status, affiliate_url, notiz } = (await request.json()) as {
      id: string;
      status?: string;
      affiliate_url?: string;
      notiz?: string;
    };

    if (!id) {
      return fehler("Missing id", 400);
    }

    // Validiere Status
    const validStatus = ["gefunden", "beworben", "aktiv", "abgelehnt"];
    if (status && !validStatus.includes(status)) {
      return fehler(`Invalid status. Must be one of: ${validStatus.join(", ")}`, 400);
    }

    // Update
    const updated = await queryOne<AffiliateProgramm>(
      `UPDATE affiliate_programm
       SET status = COALESCE($1, status),
           affiliate_url = COALESCE(NULLIF($2, ''), affiliate_url),
           notiz = COALESCE($3, notiz),
           updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [status || null, affiliate_url || null, notiz || null, id],
    );

    if (!updated) {
      return fehler("Programme nicht gefunden", 404);
    }

    return ok({ programme: updated });
  } catch (err) {
    console.error("[affiliate-programs] PATCH fehler:", err);
    return fehler("Internal server error", 500);
  }
}
