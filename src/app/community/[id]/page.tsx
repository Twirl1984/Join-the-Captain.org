import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getFeature, getPledges } from "@/lib/data";
import { getUser } from "@/lib/session";
import { Icon } from "@/components/Icon";
import { JourneyTag } from "@/components/JourneyTag";

export const dynamic = "force-dynamic";

function eur(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const feature = await getFeature(id, null);
  if (!feature) return { title: "Feature nicht gefunden" };
  return {
    title: feature.titel,
    description: feature.nutzen || feature.problem || feature.titel,
    robots: { index: false }, // Detail-Seiten nicht indexieren (dünner Inhalt)
  };
}

export default async function FeatureDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  const feature = await getFeature(id, user?.id ?? null);
  if (!feature) notFound();
  const pledges = await getPledges(id);

  const statusLabel: Record<string, string> = {
    voting: "Im Voting",
    build: "Build-Kandidat",
    affiliate: "Gibt's schon",
    verworfen: "Verworfen",
    umgesetzt: "Umgesetzt",
  };

  return (
    <div className="container section stack" style={{ maxWidth: 760, gap: 20 }}>
      <Link href="/community" className="row" style={{ color: "var(--teal)" }}>
        <Icon name="arrow-right" size={16} style={{ transform: "rotate(180deg)" }} /> Zum Board
      </Link>

      <header className="stack" style={{ gap: 10 }}>
        <h1>{feature.titel}</h1>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <JourneyTag phase={feature.journey_phase} />
          <span className="badge badge-build" style={{ background: "var(--navy-mid)" }}>
            {statusLabel[feature.status] || feature.status}
          </span>
          {feature.size && (
            <span className="sizing-tag">
              <Icon name="ruler" size={12} /> Größe {feature.size}
            </span>
          )}
        </div>
      </header>

      <section className="stack prose" style={{ gap: 8 }}>
        {feature.problem && (
          <>
            <h3>Das Problem</h3>
            <p>{feature.problem}</p>
          </>
        )}
        {feature.nutzen && (
          <>
            <h3>Der Nutzen</h3>
            <p>{feature.nutzen}</p>
          </>
        )}
      </section>

      {feature.sizing_begruendung && (
        <section className="card stack" style={{ gap: 8 }}>
          <strong className="row" style={{ gap: 6, color: "var(--navy-deep)" }}>
            <Icon name="ruler" size={16} style={{ color: "var(--teal)" }} /> KI-Sizing
          </strong>
          <p className="muted">{feature.sizing_begruendung}</p>
          {feature.eur_min != null && feature.eur_max != null && (
            <span className="caption">
              Geschätzte Kosten: {feature.eur_min.toLocaleString("de-DE")} €–
              {feature.eur_max.toLocaleString("de-DE")} € ·{" "}
              {feature.dev_tage_min}–{feature.dev_tage_max} Dev-Tage
            </span>
          )}
        </section>
      )}

      {feature.pledge_ziel_cent > 0 && (
        <section className="card stack" style={{ gap: 8 }}>
          <strong className="row" style={{ gap: 6, color: "var(--navy-deep)" }}>
            <Icon name="heart" size={16} style={{ color: "var(--gold)" }} /> Unterstützung
          </strong>
          <span className="caption">
            {eur(feature.pledge_summe_cent)} von {eur(feature.pledge_ziel_cent)} ·{" "}
            {feature.unterstuetzer} Unterstützer
          </span>
          <div className="progress">
            <span
              style={{
                width: `${Math.min(
                  100,
                  Math.round((feature.pledge_summe_cent / feature.pledge_ziel_cent) * 100),
                )}%`,
              }}
            />
          </div>
        </section>
      )}

      <section className="stack" style={{ gap: 10 }}>
        <strong>Unterstützer</strong>
        {pledges.length === 0 ? (
          <p className="muted">Noch keine bestätigten Beiträge. Sei die erste Unterstützung.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {pledges.map((p) => (
              <li key={p.id} className="muted">
                {eur(p.betrag_cent)} beigetragen
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Kommentare — Stub */}
      <section className="card stack" style={{ gap: 8 }}>
        <strong>Kommentare</strong>
        <p className="muted">
          Die Crew-Kommentare kommen bald. Bis dahin: diskutier mit uns auf Discord.
        </p>
      </section>
    </div>
  );
}
