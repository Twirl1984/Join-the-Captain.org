// GET /api/discovery/outreach — Draft-Queue (Admin)
// PATCH /api/discovery/outreach/[id] — draft editieren, approve/send/discard

import { query, queryOne } from "@/lib/db";
import { getUser } from "@/lib/session";
import { ok, fehler } from "@/lib/http";
import { approveOutreach, discardOutreach } from "@/lib/discovery";
import type { OutreachQueue } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return fehler("Unauthorized", 401);
  }

  try {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");

    let whereClause = "";
    if (statusFilter) {
      whereClause = ` WHERE status = '${statusFilter.replace(/'/g, "''")}'`;
    }

    const queue = await query<OutreachQueue>(
      `SELECT * FROM outreach_queue
       ${whereClause}
       ORDER BY status ASC, created_at DESC`,
    );

    return ok({ queue });
  } catch (err) {
    console.error("[discovery-outreach] GET fehler:", err);
    return fehler("Internal server error", 500);
  }
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return fehler("Unauthorized", 401);
  }

  try {
    const { id, action, draft_body, draft_subject } = (await request.json()) as {
      id: string;
      action: "edit" | "approve" | "discard";
      draft_body?: string;
      draft_subject?: string;
    };

    if (!id || !action) {
      return fehler("Missing id or action", 400);
    }

    let updated: OutreachQueue | null = null;

    if (action === "edit") {
      // Draft editieren (nur wenn status='draft')
      updated = await queryOne<OutreachQueue>(
        `UPDATE outreach_queue
         SET draft_body = COALESCE($1, draft_body),
             draft_subject = COALESCE($2, draft_subject)
         WHERE id = $3 AND status = 'draft'
         RETURNING *`,
        [draft_body || null, draft_subject || null, id],
      );

      if (!updated) {
        return fehler("Outreach nicht gefunden oder falscher Status (nicht draft)", 404);
      }
    } else if (action === "approve") {
      const success = await approveOutreach(id, user.id);
      if (!success) {
        return fehler("Outreach nicht gefunden oder falscher Status", 404);
      }
      updated = await queryOne<OutreachQueue>(
        "SELECT * FROM outreach_queue WHERE id = $1",
        [id],
      );
    } else if (action === "discard") {
      const success = await discardOutreach(id);
      if (!success) {
        return fehler("Outreach nicht gefunden oder falscher Status", 404);
      }
      updated = await queryOne<OutreachQueue>(
        "SELECT * FROM outreach_queue WHERE id = $1",
        [id],
      );
    } else {
      return fehler("Invalid action", 400);
    }

    return ok({ outreach: updated });
  } catch (err) {
    console.error("[discovery-outreach] PATCH fehler:", err);
    return fehler("Internal server error", 500);
  }
}
