import { getToolBySlug, getVerwandteTools } from "@/lib/data";
import { ok, fehler } from "@/lib/http";

// GET /api/tools/:slug — Tool-Detail + verwandte Tools.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return fehler("Tool nicht gefunden.", 404);
  const verwandt = await getVerwandteTools(tool);
  return ok({ tool, verwandt });
}
