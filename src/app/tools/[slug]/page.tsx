import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getToolBySlug, getVerwandteTools } from "@/lib/data";
import { ToolCard } from "@/components/ToolCard";
import { JourneyTag } from "@/components/JourneyTag";
import { Icon, iconForKey } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://join-the-captain.org";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return { title: "Tool nicht gefunden" };
  const desc = tool.kurzbeschreibung || `${tool.name} — empfohlen für deinen Törn.`;
  return {
    title: tool.name,
    description: desc,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: `${tool.name} · join-the-captain.org`,
      description: desc,
      type: "article",
      url: `${siteUrl}/tools/${tool.slug}`,
    },
  };
}

export default async function ToolDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) notFound();
  const verwandt = await getVerwandteTools(tool);
  const pc = tool.pro_contra_json;

  return (
    <div className="container section" style={{ maxWidth: 820 }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: tool.name,
          applicationCategory: tool.kategorie || "TravelApplication",
          description: tool.kurzbeschreibung || undefined,
          ...(tool.rating
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: tool.rating,
                  bestRating: 5,
                  ratingCount: 1,
                },
              }
            : {}),
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        }}
      />

      <Link href="/tools" className="row" style={{ color: "var(--teal)", marginBottom: 16 }}>
        <Icon name="arrow-right" size={16} style={{ transform: "rotate(180deg)" }} /> Zum Verzeichnis
      </Link>

      <header className="row" style={{ gap: 14, marginBottom: 16 }}>
        <span
          style={{
            display: "grid", placeItems: "center", width: 52, height: 52,
            borderRadius: 10, background: "var(--navy-deep)", color: "var(--teal)", flexShrink: 0,
          }}
        >
          <Icon name={iconForKey(tool.icon_key)} size={28} />
        </span>
        <div className="stack" style={{ gap: 6 }}>
          <h1>{tool.name}</h1>
          <JourneyTag phase={tool.journey_phase} />
        </div>
      </header>

      <div className="prose">
        {pc?.wofuer && (
          <>
            <h3>Wofür es gut ist</h3>
            <p>{pc.wofuer}</p>
          </>
        )}
        {pc?.kosten && (
          <>
            <h3>Was es kostet</h3>
            <p>{pc.kosten}</p>
          </>
        )}
        {pc?.crew && (
          <>
            <h3>Für welche Crew</h3>
            <p>{pc.crew}</p>
          </>
        )}

        {(pc?.pro?.length || pc?.contra?.length) && (
          <>
            <h3>Unsere ehrliche Einschätzung</h3>
            <div className="grid-tools" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="card">
                <strong style={{ color: "var(--phase-toern-text)" }}>Dafür</strong>
                <ul>{pc?.pro?.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
              <div className="card">
                <strong style={{ color: "var(--phase-danach-text)" }}>Dagegen</strong>
                <ul>{pc?.contra?.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Teal-CTA mit Affiliate-Kennzeichnung direkt darunter. */}
      <div className="stack" style={{ gap: 6, alignItems: "center", margin: "28px 0" }}>
        <a
          className="btn btn-teal"
          href={`/api/tools/${tool.id}/click`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Zur App <Icon name="external-link" size={18} />
        </a>
        <span className="caption">Affiliate · für dich ohne Mehrkosten</span>
      </div>

      {verwandt.length > 0 && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <span className="section-label">Verwandte Tools</span>
          <div className="grid-tools" style={{ marginTop: 12 }}>
            {verwandt.map((t) => (
              <ToolCard key={t.id} tool={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
