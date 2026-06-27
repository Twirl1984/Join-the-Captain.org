import Link from "next/link";
import { getTools, getEpisodes, getPartner } from "@/lib/data";
import { ToolCard } from "@/components/ToolCard";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

function initialen(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function Home() {
  const [tools, episodes, partner] = await Promise.all([
    getTools(),
    getEpisodes(),
    getPartner(),
  ]);
  const neuesteFolge = episodes[0];

  return (
    <div className="container section stack" style={{ gap: 48 }}>
      {/* Hero */}
      <section className="hero">
        <h2>Alles für deinen Törn — von der Planung bis nach dem Anlegen</h2>
        <p className="subline">
          Geprüfte Tools, ehrliche Empfehlungen und Stimmen aus der Szene. Von
          Seglern für Segler.
        </p>
      </section>

      {/* Tool-Verzeichnis-Auszug */}
      <section className="stack" style={{ gap: 16 }}>
        <div className="row-between">
          <div className="stack" style={{ gap: 4 }}>
            <span className="section-label">Tools für deinen Törn</span>
            <h2 style={{ fontSize: 20 }}>Geprüft und ehrlich eingeschätzt</h2>
          </div>
          <Link href="/tools" className="row" style={{ color: "var(--teal)", fontWeight: 500 }}>
            Alle ansehen <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="grid-tools">
          {tools.slice(0, 6).map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </div>
      </section>

      {/* Podcast-Strip */}
      {neuesteFolge && (
        <section className="podcast-strip">
          <span className="mic">
            <Icon name="microphone" size={24} />
          </span>
          <div className="stack" style={{ gap: 2 }}>
            <span className="section-label">Der Podcast</span>
            <strong style={{ color: "var(--salt-white)", fontWeight: 500 }}>
              Segeln &amp; Selbstständigkeit
            </strong>
            <span className="caption" style={{ color: "var(--grau-200)" }}>
              Folge {neuesteFolge.folge_nr} · {neuesteFolge.titel}
            </span>
          </div>
          <Link href="/podcast" className="btn btn-gold" style={{ marginLeft: "auto" }}>
            <Icon name="play" size={16} /> Hören
          </Link>
        </section>
      )}

      {/* Feature-Board-Teaser */}
      <section className="card stack" style={{ gap: 12, padding: "24px 22px" }}>
        <span className="section-label">Community</span>
        <h2 style={{ fontSize: 20 }}>Wünsch dir ein Feature</h2>
        <p className="muted" style={{ maxWidth: 560 }}>
          Du sagst, was deinem Törn fehlt. Die KI strukturiert und prüft, die
          Crew votet — und wir bauen, empfehlen oder legen es ehrlich zur Seite.
        </p>
        <Link href="/community" className="btn btn-teal" style={{ alignSelf: "flex-start" }}>
          Zum Feature-Board <Icon name="arrow-right" size={18} />
        </Link>
      </section>

      {/* Segler-Entrepreneurs */}
      {partner.length > 0 && (
        <section className="card stack" style={{ gap: 14 }}>
          <div className="stack" style={{ gap: 4 }}>
            <span className="section-label">Segler-Entrepreneurs</span>
            <h2 style={{ fontSize: 20 }}>Kollegen, die gute Arbeit machen</h2>
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 14 }}>
            {partner.map((p) => (
              <div key={p.id} className="row" style={{ gap: 10 }}>
                <span
                  style={{
                    display: "grid", placeItems: "center", width: 40, height: 40,
                    borderRadius: 999, background: "var(--navy-deep)",
                    color: "var(--salt-white)", fontWeight: 600,
                  }}
                >
                  {initialen(p.name)}
                </span>
                <div className="stack" style={{ gap: 0 }}>
                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  <span className="caption">{p.rolle}</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/entrepreneurs" className="row" style={{ color: "var(--teal)", fontWeight: 500 }}>
            Zum Netzwerk <Icon name="arrow-right" size={16} />
          </Link>
        </section>
      )}
    </div>
  );
}
