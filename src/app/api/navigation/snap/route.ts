import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { getNavRevier } from "@/lib/navigation/reviere";
import { getMaskForRevier } from "@/lib/navigation/masks";
import { nearestWaterCell, cellCenter, cellOf, cellIsWater } from "@/lib/navigation/watermask";
import { navigationEnabled } from "@/lib/flags";
import { clientKey, createLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

const limiter = createLimiter({ limit: 60, windowMs: 60_000 });
// Gleiche physische Grenze wie das Server-Routing (searoute.SNAP_METER).
const SNAP_METER = 1500;

// GET /api/navigation/snap?revier=…&lat=…&lon=… (REQ-NAV-010)
// Setzt einen Karten-Klick sichtbar auf die nächste Wasserstelle des Reviers:
//   { lat, lon, snapped } — snapped=true wenn verschoben wurde.
// 422 wenn der Punkt weiter als ~1,5 km im Land liegt. Reviere ohne Maske
// (Binnensee): Punkt unverändert zurück (snapped=false).
export async function GET(req: NextRequest) {
  if (!navigationEnabled()) return fehler("Navigation ist deaktiviert.", 404);
  if (!limiter.allow(clientKey(req.headers))) {
    return fehler("Zu viele Anfragen — bitte kurz warten.", 429);
  }
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    return fehler("lat/lon: gültige Koordinaten nötig.");
  }
  const revier = getNavRevier(String(sp.get("revier") ?? ""));
  if (!revier) return fehler("revier: unbekanntes Revier.");

  const mask = getMaskForRevier(revier.id);
  if (!mask) return ok({ lat, lon, snapped: false }); // Binnensee o. Ä.: unverändert

  const cell = cellOf(mask, lat, lon);
  if (cell && cellIsWater(mask, cell.row, cell.col)) {
    return ok({ lat, lon, snapped: false }); // schon im Wasser
  }
  // Ringsuche wie im Routing: Meter → Ringe über die Zellhöhe (Breitengrad).
  // bbox = [Süd, West, Nord, Ost] (reviere.Bbox).
  const cellMeter = ((mask.bbox[2] - mask.bbox[0]) / mask.rows) * 111_320;
  const maxRinge = Math.max(1, Math.ceil(SNAP_METER / cellMeter));
  const water = nearestWaterCell(mask, lat, lon, maxRinge);
  if (!water) {
    return fehler("Der Punkt liegt zu weit im Land — bitte näher ans Wasser klicken.", 422);
  }
  const c = cellCenter(mask, water.row, water.col);
  return ok({ lat: c.lat, lon: c.lon, snapped: true });
}
