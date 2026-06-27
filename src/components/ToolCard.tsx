import Link from "next/link";
import { Icon, iconForKey } from "./Icon";
import { JourneyTag } from "./JourneyTag";
import type { AffiliateTool } from "@/lib/types";

// Tool-Karte fürs Verzeichnis und den Startseiten-Auszug.
export function ToolCard({ tool }: { tool: AffiliateTool }) {
  return (
    <Link href={`/tools/${tool.slug}`} className="card card-hover stack" style={{ gap: 10 }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            display: "grid", placeItems: "center", width: 34, height: 34,
            borderRadius: 8, background: "var(--navy-deep)", color: "var(--teal)",
            flexShrink: 0,
          }}
        >
          <Icon name={iconForKey(tool.icon_key)} size={18} />
        </span>
        <div className="stack" style={{ gap: 4 }}>
          <h3 style={{ fontSize: 13 }}>{tool.name}</h3>
          <JourneyTag phase={tool.journey_phase} />
        </div>
      </div>
      {tool.kurzbeschreibung && (
        <p className="caption" style={{ fontSize: 11, color: "var(--dunkelgrau)" }}>
          {tool.kurzbeschreibung}
        </p>
      )}
      <div className="row-between" style={{ marginTop: "auto" }}>
        <span className="caption">Affiliate · ohne Mehrkosten</span>
        <span className="row" style={{ color: "var(--teal)", fontWeight: 500, fontSize: 13 }}>
          Ansehen <Icon name="arrow-right" size={16} />
        </span>
      </div>
    </Link>
  );
}
