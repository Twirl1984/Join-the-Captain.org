import type { Metadata } from "next";
import { getPartner } from "@/lib/data";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Segler-Entrepreneurs",
  description:
    "Kollegen, die gute Arbeit machen: Charter, Ausbildung, Versicherung, " +
    "Foto & Film. Das Partner-Netzwerk von Join the Captain.",
  alternates: { canonical: "/entrepreneurs" },
};

export const dynamic = "force-dynamic";

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default async function EntrepreneursPage() {
  const partner = await getPartner();

  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6, marginBottom: 24 }}>
        <span className="section-label">Segler-Entrepreneurs</span>
        <h1>Kollegen, die gute Arbeit machen</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          Menschen und Betriebe aus der Szene, hinter denen wir stehen. Schau
          dich um — vielleicht ist genau die Hilfe dabei, die du suchst.
        </p>
      </div>

      {partner.length === 0 ? (
        <div className="empty">
          <p>Das Netzwerk wächst gerade. Bald mehr.</p>
        </div>
      ) : (
        <div className="grid-tools">
          {partner.map((p) => {
            const inner = (
              <>
                <div className="row" style={{ gap: 12 }}>
                  <span
                    style={{
                      display: "grid", placeItems: "center", width: 44, height: 44,
                      borderRadius: 999, background: "var(--navy-deep)",
                      color: "var(--salt-white)", fontWeight: 600, flexShrink: 0,
                    }}
                  >
                    {initialen(p.name)}
                  </span>
                  <div className="stack" style={{ gap: 2 }}>
                    <h3 style={{ fontSize: 15 }}>{p.name}</h3>
                    {p.rolle && <span className="caption">{p.rolle}</span>}
                  </div>
                </div>
                {p.kurzbeschreibung && (
                  <p className="muted" style={{ marginTop: 10 }}>{p.kurzbeschreibung}</p>
                )}
                {p.url && (
                  <span className="row" style={{ color: "var(--teal)", marginTop: 10, fontSize: 13 }}>
                    Ansehen <Icon name="arrow-right" size={16} />
                  </span>
                )}
              </>
            );
            return p.url ? (
              <a
                key={p.id}
                className="card card-hover stack"
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <div key={p.id} className="card stack">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
