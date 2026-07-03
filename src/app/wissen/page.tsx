import type { Metadata } from "next";
import { getWissenVideos } from "@/lib/data";
import { WissenVideoCard } from "@/components/WissenVideoCard";

export const metadata: Metadata = {
  title: "Segel-Wissen — Videos aus der Szene",
  description:
    "Handverlesene Segel-Tutorials von Seglern und Bootsschulen — nach Thema " +
    "sortiert, geprüft und eingebettet. Knoten, Anlegen, Wetter und mehr.",
  alternates: { canonical: "/wissen" },
};

export const dynamic = "force-dynamic";

export default async function WissenPage() {
  const gruppen = await getWissenVideos();

  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6, marginBottom: 8 }}>
        <span className="section-label">Segel-Wissen</span>
        <h1>Videos aus der Szene</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          Handverlesene Tutorials von Seglern und Bootsschulen — nach Thema
          sortiert, geprüft und eingebettet. Kein Download, direkt von YouTube.
        </p>
      </div>

      {gruppen.length === 0 ? (
        <div className="empty">
          <p>Noch keine Videos freigegeben. Schau bald wieder vorbei.</p>
        </div>
      ) : (
        gruppen.map((g) => (
          <section key={g.topic} style={{ marginTop: 28 }}>
            <div className="row-between" style={{ alignItems: "baseline", marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>{g.topic}</h2>
              <span className="caption">
                {g.videos.length} Video{g.videos.length === 1 ? "" : "s"}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              }}
            >
              {g.videos.map((v) => (
                <WissenVideoCard key={v.id} video={v} />
              ))}
            </div>
          </section>
        ))
      )}

      <div className="affiliate-footer-note" style={{ marginTop: 32 }}>
        Videos werden nur eingebettet (kein Download). Die Rechte bleiben bei den Creatorn.
      </div>
    </div>
  );
}
