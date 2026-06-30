"use client";

import { useState } from "react";
import { ToolCard } from "./ToolCard";
import { JOURNEY_PHASES, JOURNEY_PHASE_LABEL } from "@/lib/types";
import type { AffiliateTool, JourneyPhase } from "@/lib/types";

// Tool-Verzeichnis-Auszug mit Journey-Phase-Filter-Pills (Startseite).
export function HomeToolFilter({ tools }: { tools: AffiliateTool[] }) {
  const [phase, setPhase] = useState<JourneyPhase | null>(null);

  const gefiltert = (phase ? tools.filter((t) => t.journey_phase === phase) : tools).slice(0, 6);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="pills">
        <button
          className={`pill${phase === null ? " active" : ""}`}
          onClick={() => setPhase(null)}
        >
          Alle
        </button>
        {JOURNEY_PHASES.map((p) => (
          <button
            key={p}
            className={`pill${phase === p ? " active" : ""}`}
            onClick={() => setPhase(p)}
          >
            {JOURNEY_PHASE_LABEL[p]}
          </button>
        ))}
      </div>

      {gefiltert.length > 0 ? (
        <div className="grid-tools">
          {gefiltert.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </div>
      ) : (
        <div className="empty">Für diese Phase ist noch kein Tool eingetragen.</div>
      )}
    </div>
  );
}
