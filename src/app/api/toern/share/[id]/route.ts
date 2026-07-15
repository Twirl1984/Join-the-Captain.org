// GET /api/toern/share/:id — read-only Törn-Snapshot auflösen (REQ-EXP-009).

import { getToernShare } from "@/lib/toern/share";
import { ok, fehler } from "@/lib/http";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const share = await getToernShare(id);
    if (!share) return fehler("Törn-Link nicht gefunden oder abgelaufen.", 404);
    return ok({ share });
  } catch (err) {
    console.error("[toern-share] GET fehler:", err);
    return fehler("Internal server error", 500);
  }
}
