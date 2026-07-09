// GET /api/discovery/submissions — Pending/approved submissions (Admin-Liste)
// PATCH /api/discovery/submissions/[id] — approve/reject

import { query, queryOne } from "@/lib/db";
import { getUser } from "@/lib/session";
import { ok, fehler } from "@/lib/http";
import { approvePendingSubmission, rejectSubmission } from "@/lib/discovery";
import type { CreatorSubmission } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return fehler("Unauthorized", 401);
  }

  try {
    // Status-Filter optional (URL-Param)
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");

    let whereClause = "";
    if (statusFilter) {
      whereClause = ` WHERE status = '${statusFilter.replace(/'/g, "''")}'`;
    }

    const submissions = await query<CreatorSubmission>(
      `SELECT * FROM creator_submissions
       ${whereClause}
       ORDER BY status DESC, created_at DESC`,
    );

    return ok({ submissions });
  } catch (err) {
    console.error("[discovery-submissions] GET fehler:", err);
    return fehler("Internal server error", 500);
  }
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return fehler("Unauthorized", 401);
  }

  try {
    const { id, action, reason } = (await request.json()) as {
      id: string;
      action: "approve" | "reject";
      reason?: string;
    };

    if (!id || !action) {
      return fehler("Missing id or action", 400);
    }

    let success = false;
    if (action === "approve") {
      success = await approvePendingSubmission(id, user.id);
    } else if (action === "reject") {
      if (!reason) {
        return fehler("Rejection reason required", 400);
      }
      success = await rejectSubmission(id, reason);
    } else {
      return fehler("Invalid action", 400);
    }

    if (!success) {
      return fehler("Submission nicht gefunden oder falscher Status", 404);
    }

    const updated = await queryOne<CreatorSubmission>(
      "SELECT * FROM creator_submissions WHERE id = $1",
      [id],
    );

    return ok({ submission: updated });
  } catch (err) {
    console.error("[discovery-submissions] PATCH fehler:", err);
    return fehler("Internal server error", 500);
  }
}
