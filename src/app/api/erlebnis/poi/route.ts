// GET /api/erlebnis/poi — POI-Liste nach Revier oder Bbox (REQ-EXP-001).
//
// Query-Parameter: revier (revier_id), bbox=minLat,minLon,maxLat,maxLon,
// monat (1-12), datum (ISO). Default: status='live' — Entwürfe und
// archivierte Einträge werden nie ausgeliefert, ausser explizit über
// status=... angefragt (Kurations-UI, künftig admin-only).

import { NextRequest } from "next/server";
import { listRevierPois } from "@/lib/erlebnis/poi";
import { ok, fehler } from "@/lib/http";
import type { RevierPoi } from "@/lib/types";

function parseBbox(raw: string | null) {
  if (!raw) return undefined;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return undefined;
  const [minLat, minLon, maxLat, maxLon] = parts;
  return { minLat, minLon, maxLat, maxLon };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const revierId = url.searchParams.get("revier") ?? undefined;
  const bbox = parseBbox(url.searchParams.get("bbox"));
  const monatRaw = url.searchParams.get("monat");
  const monat = monatRaw ? Number(monatRaw) : undefined;
  const datum = url.searchParams.get("datum") ?? undefined;
  const statusRaw = url.searchParams.get("status") as RevierPoi["status"] | null;

  if (!revierId && !bbox) {
    return fehler("revier oder bbox ist erforderlich.", 400);
  }
  if (monat != null && (Number.isNaN(monat) || monat < 1 || monat > 12)) {
    return fehler("monat muss zwischen 1 und 12 liegen.", 400);
  }

  try {
    const pois = await listRevierPois({
      revierId,
      bbox,
      monat,
      datum,
      status: statusRaw ?? undefined,
    });
    return ok({ pois });
  } catch (err) {
    console.error("[erlebnis-poi] GET fehler:", err);
    return fehler("Internal server error", 500);
  }
}
