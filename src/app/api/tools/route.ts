import { NextRequest } from "next/server";
import { getTools } from "@/lib/data";
import { ok } from "@/lib/http";
import { JOURNEY_PHASES, type JourneyPhase } from "@/lib/types";

// GET /api/tools?phase=auf_dem_toern — Verzeichnis, optional nach Phase.
export async function GET(req: NextRequest) {
  const phaseParam = req.nextUrl.searchParams.get("phase");
  const phase =
    phaseParam && JOURNEY_PHASES.includes(phaseParam as JourneyPhase)
      ? (phaseParam as JourneyPhase)
      : null;
  const tools = await getTools(phase);
  return ok({ tools, phase });
}
