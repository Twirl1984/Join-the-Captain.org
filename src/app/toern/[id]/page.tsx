import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToernShare } from "@/lib/toern/share";
import { alleReviere } from "@/lib/navigation/reviere";
import ToernShareMap from "@/components/toern/ToernShareMapLoader";

// Teilbarer, read-only Törn-Link (REQ-EXP-009) — Vogelperspektive + Highlights
// als Anreiz für Crew-Bewerbungen ("Wir ankern in dieser Bucht!"). Kein
// Editieren, keine Live-Fetches — reiner Snapshot aus geteilter_toern.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const share = await getToernShare(id);
  if (!share) return { title: "Törn-Link nicht gefunden" };
  const revier = alleReviere().find((r) => r.id === share.revier_id);
  return {
    title: `Törn — ${revier?.label ?? share.revier_id} · join-the-captain.org`,
    description: share.plan_json ? `${share.plan_json.total_nm} sm Seemeilen geplant.` : undefined,
    robots: { index: false },
  };
}

export default async function ToernSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const share = await getToernShare(id);
  if (!share) notFound();

  const revier = alleReviere().find((r) => r.id === share.revier_id);
  const highlights = share.highlights_json ?? [];

  return (
    <main className="container stack" style={{ gap: 20, padding: "24px 0" }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="tag phase-planung">Geteilter Törn</span>
        <h1>{revier?.label ?? share.revier_id}</h1>
        {share.plan_json && (
          <p className="caption">
            {share.plan_json.total_nm} sm · Ankunft {new Date(share.plan_json.eta).toLocaleString("de-DE")}
          </p>
        )}
      </div>

      <div className="card" style={{ height: 420, overflow: "hidden" }} data-testid="toern-share-map">
        <ToernShareMap punkte={share.punkte_json} highlights={highlights} />
      </div>

      {highlights.length > 0 && (
        <div className="card stack" style={{ gap: 8 }} data-testid="toern-share-highlights">
          <span className="section-label">Erlebnisse entlang der Route</span>
          {highlights.map((h, i) => (
            <p key={i} data-testid="toern-share-highlight-item">
              ★ {h.name}
            </p>
          ))}
        </div>
      )}

      <p className="caption">
        Planungshilfe, ersetzt keine amtlichen Seekarten. Diese Ansicht ist read-only — die volle
        Planung gibt es unter{" "}
        <a href="/navigation">join-the-captain.org/navigation</a>.
      </p>
    </main>
  );
}
