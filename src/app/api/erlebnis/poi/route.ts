// GET /api/erlebnis/poi?revier=<id>          — Live-POIs eines Reviers (REQ-EXP-001)
// GET /api/erlebnis/poi?bbox=sued,west,nord,ost — Live-POIs in einer Kartenbox

import { ok, fehler } from "@/lib/http";
import { listPoisByRevier, listPoisByBbox } from "@/lib/erlebnis/poi";
import type { Bbox } from "@/lib/navigation/reviere";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const revier = url.searchParams.get("revier");
  const bboxParam = url.searchParams.get("bbox");

  try {
    if (revier) {
      const pois = await listPoisByRevier(revier);
      return ok({ pois });
    }

    if (bboxParam) {
      const teile = bboxParam.split(",").map(Number);
      if (teile.length !== 4 || teile.some((n) => Number.isNaN(n))) {
        return fehler("bbox muss 'sued,west,nord,ost' als Zahlen sein", 400);
      }
      const pois = await listPoisByBbox(teile as Bbox);
      return ok({ pois });
    }

    return fehler("revier oder bbox erforderlich", 400);
  } catch (err) {
    console.error("[erlebnis-poi] GET fehler:", err);
    return fehler("Internal server error", 500);
  }
}
