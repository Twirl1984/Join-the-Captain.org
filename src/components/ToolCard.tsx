import Link from "next/link";
import { Icon, iconForKey } from "./Icon";
import { JourneyTag } from "./JourneyTag";
import type { AffiliateTool } from "@/lib/types";

// Tool-Karte fürs Verzeichnis und den Startseiten-Auszug.
export function ToolCard({ tool }: { tool: AffiliateTool }) {
  return (
    <Link href={`/tools/${tool.slug}`} className="card card-hover stack" style={{ gap: 12 }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            display: "grid", placeItems: "center", width: 36, height: 36,
            background: "rgba(47,158,192,0.16)", color: "var(--accent-2)",
            flexShrink: 0,
          }}
        >
          <Icon name={iconForKey(tool.icon_key)} size={20} />
        </span>
        <div className="stack" style={{ gap: 6 }}>
          <h3 style={{ fontSize: 14, fontFamily: "var(--font-sans)", fontWeight: 500 }}>{tool.name}</h3>
          <JourneyTag phase={tool.journey_phase} />
        </div>
      </div>
      {tool.kurzbeschreibung && (
        <p style={{ margin: 0, fontSize: 12, fontWeight: 300, lineHeight: 1.6, color: "var(--fg-muted)" }}>
          {tool.kurzbeschreibung}
        </p>
      )}
      <div className="row-between" style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        <span className="caption">Affiliate · ohne Mehrkosten</span>
        <span className="row" style={{ color: "var(--accent)", fontWeight: 500, fontSize: 12 }}>
          Ansehen <Icon name="arrow-right" size={14} />
        </span>
      </div>
    </Link>
  );
}
