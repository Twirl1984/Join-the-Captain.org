// POST /api/toern/share — teilbaren Törn-Link anlegen (REQ-EXP-009).
//
// Body: { revierId, punkte: [{lat,lon,name?}], plan: {total_nm,eta,warnings},
// highlights?: [{name,lat,lon,typ}] }. Antwort: { id }. Read-only Ansicht
// lebt unter /toern/[id].

import { NextRequest } from "next/server";
import { buildShareSnapshot, createToernShare } from "@/lib/toern/share";
import { ok, fehler } from "@/lib/http";
import type { Waypoint, RoutePlan } from "@/lib/weather/route-forecast";
import type { ToernShareHighlight } from "@/lib/toern/share";

export async function POST(request: NextRequest) {
  let body: {
    revierId?: string;
    punkte?: Waypoint[];
    plan?: RoutePlan;
    highlights?: ToernShareHighlight[];
  };
  try {
    body = await request.json();
  } catch {
    return fehler("Ungültiger Body.", 400);
  }

  const { revierId, punkte, plan, highlights } = body;
  if (!revierId || !punkte || punkte.length === 0 || !plan) {
    return fehler("revierId, punkte und plan sind erforderlich.", 400);
  }

  try {
    const snapshot = buildShareSnapshot({ revierId, punkte, plan, highlights });
    const id = await createToernShare(snapshot);
    return ok({ id });
  } catch (err) {
    console.error("[toern-share] POST fehler:", err);
    return fehler("Internal server error", 500);
  }
}
