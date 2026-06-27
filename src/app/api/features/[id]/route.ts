import { getFeature, getPledges } from "@/lib/data";
import { getUser } from "@/lib/session";
import { ok, fehler } from "@/lib/http";

// GET /api/features/:id — Detail inkl. Pledge-Liste.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUser();
  const feature = await getFeature(id, user?.id ?? null);
  if (!feature) return fehler("Feature nicht gefunden.", 404);
  const pledges = await getPledges(id);
  return ok({ feature, pledges });
}
