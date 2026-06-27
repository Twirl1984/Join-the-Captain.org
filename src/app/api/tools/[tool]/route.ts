import { getToolBySlug, getVerwandteTools } from "@/lib/data";
import { ok, fehler } from "@/lib/http";

// GET /api/tools/:slug — Tool-Detail + verwandte Tools.
// (Segment heißt [tool], damit es mit /[tool]/click kollisionsfrei ist;
// hier wird der Wert als Slug interpretiert.)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool: slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return fehler("Tool nicht gefunden.", 404);
  const verwandt = await getVerwandteTools(tool);
  return ok({ tool, verwandt });
}
