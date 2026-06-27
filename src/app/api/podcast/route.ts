import { getEpisodes } from "@/lib/data";
import { ok } from "@/lib/http";

// GET /api/podcast — veröffentlichte Folgen, neueste zuerst.
export async function GET() {
  const episodes = await getEpisodes();
  return ok({ episodes });
}
