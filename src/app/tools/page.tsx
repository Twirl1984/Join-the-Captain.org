import type { Metadata } from "next";
import Link from "next/link";
import { getTools } from "@/lib/data";
import { ToolCard } from "@/components/ToolCard";
import { Icon } from "@/components/Icon";
import { JourneyTag } from "@/components/JourneyTag";
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
  // Eigenbau /wetter erscheint bei "Alle" und in seiner Phase (Planung).
  const showWetter = !phase || phase === "planung";

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

      {tools.length === 0 && !showWetter ? (
        <div className="empty">
          <p>Für diese Phase haben wir noch kein Tool im Verzeichnis.</p>
        </div>
      ) : (
        <div className="grid-tools">
          {showWetter && <WetterToolCard />}
          {tools.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </div>
      )}
    </div>
  );
}

// Eigenbau-Tool /wetter: fester Eintrag (keine DB, KEIN Affiliate-Hinweis).
function WetterToolCard() {
  return (
    <Link href="/navigation" className="card card-hover stack" style={{ gap: 12 }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            display: "grid", placeItems: "center", width: 36, height: 36,
            background: "rgba(47,158,192,0.16)", color: "var(--accent-2)",
            flexShrink: 0,
          }}
        >
          <Icon name="cloud" size={20} />
        </span>
        <div className="stack" style={{ gap: 6 }}>
          <h3 style={{ fontSize: 14, fontFamily: "var(--font-sans)", fontWeight: 500 }}>
            Navigation & Wetter
          </h3>
          <JourneyTag phase="planung" />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 300, lineHeight: 1.6, color: "var(--fg-muted)" }}>
        Seekarte mit Tiefen, Route um Land herum, Wetter-Warnungen und echte
        Ankunftszeiten — mit einstellbarer Warn-Empfindlichkeit.
      </p>
      <div className="row-between" style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        <span className="caption">JTC-Eigenbau · kostenlos</span>
        <span className="row" style={{ color: "var(--accent)", fontWeight: 500, fontSize: 12 }}>
          Öffnen <Icon name="arrow-right" size={14} />
        </span>
      </div>
    </Link>
  );
}
