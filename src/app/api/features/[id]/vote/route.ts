import { query, queryOne } from "@/lib/db";
import { getOrCreateUser } from "@/lib/session";
import { ok, fehler } from "@/lib/http";

// POST /api/features/:id/vote — Toggle, 1 Stimme pro User.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOrCreateUser();

  const feature = await queryOne(
    "SELECT status FROM feature_request WHERE id = $1",
    [id],
  );
  if (!feature) return fehler("Feature nicht gefunden.", 404);

  const vorhanden = await queryOne(
    "SELECT id FROM vote WHERE feature_id = $1 AND user_id = $2",
    [id, user.id],
  );

  let voted: boolean;
  if (vorhanden) {
    await query("DELETE FROM vote WHERE feature_id = $1 AND user_id = $2", [
      id,
      user.id,
    ]);
    voted = false;
  } else {
    // ON CONFLICT fängt Race-Conditions ab (UNIQUE feature_id+user_id).
    await query(
      `INSERT INTO vote (feature_id, user_id) VALUES ($1, $2)
       ON CONFLICT (feature_id, user_id) DO NOTHING`,
      [id, user.id],
    );
    voted = true;
  }

  const count = await queryOne<{ n: string }>(
    "SELECT COUNT(*)::int AS n FROM vote WHERE feature_id = $1",
    [id],
  );

  return ok({ voted, votes: Number(count?.n ?? 0) });
}
