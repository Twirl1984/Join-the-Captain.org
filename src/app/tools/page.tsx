import type { Metadata } from "next";
import Link from "next/link";
import { getTools } from "@/lib/data";
import { ToolCard } from "@/components/ToolCard";
import { JOURNEY_PHASES, JOURNEY_PHASE_LABEL, type JourneyPhase } from "@/lib/types";

export const metadata: Metadata = {
  title: "Tools für deinen Törn",
  description:
    "Geprüfte Apps und Dienste für jede Phase deines Törns — von der " +
    "Planung bis nach dem Anlegen. Ehrlich eingeschätzt, klar gekennzeichnet.",
  alternates: { canonical: "/tools" },
};

export const dynamic = "force-dynamic";

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  const { phase: phaseParam } = await searchParams;
  const phase =
    phaseParam && JOURNEY_PHASES.includes(phaseParam as JourneyPhase)
      ? (phaseParam as JourneyPhase)
      : null;
  const tools = await getTools(phase);

  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6, marginBottom: 8 }}>
        <span className="section-label">Tool-Verzeichnis</span>
        <h1>Tools für deinen Törn</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          Wir empfehlen nur, was wir selbst nutzen würden. Jeder Affiliate-Link
          ist gekennzeichnet — für dich ohne Mehrkosten.
        </p>
      </div>

      <nav className="pills" style={{ margin: "20px 0" }} aria-label="Nach Phase filtern">
        <Link href="/tools" className={`pill ${!phase ? "active" : ""}`}>
          Alle
        </Link>
        {JOURNEY_PHASES.map((p) => (
          <Link
            key={p}
            href={`/tools?phase=${p}`}
            className={`pill ${phase === p ? "active" : ""}`}
          >
            {JOURNEY_PHASE_LABEL[p]}
          </Link>
        ))}
      </nav>

      {tools.length === 0 ? (
        <div className="empty">
          <p>Für diese Phase haben wir noch kein Tool im Verzeichnis.</p>
        </div>
      ) : (
        <div className="grid-tools">
          {tools.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </div>
      )}
    </div>
  );
}
