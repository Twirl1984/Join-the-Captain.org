import type { Metadata } from "next";
import { getEpisodes } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Der Podcast — Segeln & Selbstständigkeit",
  description:
    "Stimmen aus der Szene: Folgen über Segeln, Törns und das Leben " +
    "zwischen Hafen und Business. Hör rein.",
  alternates: { canonical: "/podcast" },
};

export const dynamic = "force-dynamic";

function dauer(sek: number | null): string {
  if (!sek) return "";
  const m = Math.round(sek / 60);
  return `${m} Min`;
}

function datum(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function PodcastPage() {
  const episodes = await getEpisodes();

  return (
    <div className="container section" style={{ maxWidth: 820 }}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "PodcastSeries",
          name: "Segeln & Selbstständigkeit",
          description: "Der Podcast von Join the Captain.",
        }}
      />
      <div className="stack" style={{ gap: 6, marginBottom: 24 }}>
        <span className="section-label">Der Podcast</span>
        <h1>Segeln &amp; Selbstständigkeit</h1>
        <p className="muted">Stimmen aus der Szene. Neue Folge etwa jeden Monat.</p>
      </div>

      {episodes.length === 0 ? (
        <div className="empty">
          <p>Die erste Folge ist in Arbeit. Schau bald wieder vorbei.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {episodes.map((ep) => (
            <article key={ep.id} className="card card-hover stack" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                <span className="mic" style={{ width: 46, height: 46 }}>
                  <Icon name="microphone" size={22} />
                </span>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="caption">
                    Folge {ep.folge_nr} · {datum(ep.veroeffentlicht_am)}
                    {ep.dauer_sek ? ` · ${dauer(ep.dauer_sek)}` : ""}
                  </span>
                  <h3 style={{ fontSize: 16 }}>{ep.titel}</h3>
                  {ep.beschreibung && <p className="muted">{ep.beschreibung}</p>}
                </div>
              </div>
              {/* Einfacher Player via Audio-Embed. */}
              <audio controls preload="none" style={{ width: "100%" }} src={ep.audio_url}>
                Dein Browser kann dieses Audio nicht abspielen.
              </audio>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
