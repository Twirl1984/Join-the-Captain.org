import { JOURNEY_PHASE_LABEL, type JourneyPhase } from "@/lib/types";

// Farbiger Journey-Phasen-Tag (Farbe nach Phase, Teil A.2).
export function JourneyTag({ phase }: { phase: JourneyPhase | null }) {
  if (!phase) return null;
  return <span className={`tag phase-${phase}`}>{JOURNEY_PHASE_LABEL[phase]}</span>;
}
