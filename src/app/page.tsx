import Link from "next/link";
import { getTools, getEpisodes, getPartner } from "@/lib/data";
import { HomeToolFilter } from "@/components/HomeToolFilter";
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
    <div className="container home">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="home-hero">
        <img src="/assets/photos/hero-sail.jpg" alt="Segelyacht unter vollen Segeln vor der Küste" />
        <div className="overlay" />
        <div className="inner">
          <span className="eyebrow">Von Seglern für Segler</span>
          <h1 className="home-hero-title">
            Alles für deinen <em>Törn</em> — von der Planung bis nach dem Anlegen
          </h1>
          <p className="home-hero-sub">
            Geprüfte Tools, ehrliche Empfehlungen und Stimmen aus der Szene. Kein
            Marketing-Lärm — nur, was an Bord wirklich hilft.
          </p>
        </div>
      </section>

      {/* ── Tool-Verzeichnis ───────────────────────────────────── */}
      <section>
        <div className="row-between" style={{ alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
          <div className="home-section-head" style={{ marginBottom: 0 }}>
            <span className="eyebrow">Tool-Verzeichnis</span>
            <h2>Tools für deinen <em>Törn</em></h2>
          </div>
          <Link href="/tools" className="row" style={{ color: "var(--accent)", fontWeight: 500, fontSize: 13 }}>
            Alle ansehen <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <HomeToolFilter tools={tools} />
      </section>

      {/* ── Im Fokus: Absicherung ──────────────────────────────── */}
      <section className="focus">
        <div className="focus-media">
          <img src="/assets/photos/captain-crash.jpg" alt="Crew an Bord nach einem Anlegemanöver" />
        </div>
        <div className="focus-body">
          <span className="eyebrow">Vor dem Törn · Absicherung</span>
          <h2 style={{ margin: 0 }}>
            Kaution &amp; Captain-Crash — <em>entspannt</em> abgesichert
          </h2>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 300, lineHeight: 1.8, color: "var(--fg-muted)" }}>
            Die Kaution beim Charter ist schnell vierstellig. Eine
            Kautionsversicherung deckt den Selbstbehalt, plus Skipper-Haftpflicht,
            wenn es ernster wird. Wichtig: rechtzeitig <strong>vor dem Törn</strong>{" "}
            abschließen — danach ist es zu spät. Später bleibt höchstens noch
            Support, um einen Schadensfall zu klären.
          </p>
          <ul className="focus-list">
            <li><Icon name="shield-check" size={17} /> Kaution &amp; Selbstbehalt bis 5.000&nbsp;€ abgedeckt</li>
            <li><Icon name="anchor" size={17} /> Skipper-Haftpflicht für Personen- &amp; Sachschäden</li>
            <li><Icon name="clock" size={17} /> Tagesgenau buchbar — auch für den einen Törn</li>
          </ul>
          <div className="row" style={{ gap: 18, flexWrap: "wrap", marginTop: 4 }}>
            <Link href="/tools?phase=planung" className="btn btn-gold">
              Versicherung ansehen <Icon name="arrow-right" size={15} />
            </Link>
            <span className="affiliate-note">Affiliate · ohne Mehrkosten</span>
          </div>
        </div>
      </section>

      {/* ── Podcast-Strip ──────────────────────────────────────── */}
      <section className="podcast-strip">
        <span className="mic"><Icon name="microphone" size={24} /></span>
        <div className="stack" style={{ gap: 4, flex: 1 }}>
          <span className="eyebrow" style={{ letterSpacing: "0.3em" }}>Der Podcast</span>
          <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 20, color: "var(--fg)" }}>
            Segeln &amp; Selbstständigkeit
          </strong>
          <span className="caption">
            {neuesteFolge
              ? `Folge ${neuesteFolge.folge_nr} · ${neuesteFolge.titel}`
              : "Folge 1 · in Vorbereitung"}
          </span>
        </div>
        {neuesteFolge ? (
          <Link href="/podcast" className="btn btn-gold">
            <Icon name="play" size={16} /> Hören
          </Link>
        ) : (
          <span className="status-pill"><Icon name="clock" size={14} className="ic" /> Coming soon</span>
        )}
      </section>

      {/* ── Community / Feature-Loop ───────────────────────────── */}
      <section className="card stack" style={{ gap: 14, padding: "28px 26px" }}>
        <span className="eyebrow">Community</span>
        <h2 style={{ margin: 0 }}>
          Wünsch dir ein <em>Feature</em>
        </h2>
        <p style={{ margin: 0, maxWidth: 580, fontSize: 14, fontWeight: 300, lineHeight: 1.8, color: "var(--fg-muted)" }}>
          Du sagst, was deinem Törn fehlt. Die KI strukturiert und prüft, die Crew
          votet — und wir bauen, empfehlen oder legen es ehrlich zur Seite.
        </p>
        <Link href="/community" className="btn btn-outline-gold" style={{ alignSelf: "flex-start" }}>
          Zum Feature-Board <Icon name="arrow-right" size={16} />
        </Link>
      </section>

      {/* ── Segler-Entrepreneurs ───────────────────────────────── */}
      <section>
        <div className="home-section-head">
          <span className="eyebrow">Netzwerk</span>
          <h2 style={{ margin: 0 }}>Kollegen, die gute <em>Arbeit</em> machen</h2>
        </div>
        {partner.length > 0 ? (
          <div className="row" style={{ flexWrap: "wrap", gap: 14 }}>
            {partner.map((p) => (
              <div key={p.id} className="partner-chip">
                <span className="avatar">{initialen(p.name)}</span>
                <div className="stack" style={{ gap: 2 }}>
                  <strong style={{ fontSize: 14, fontWeight: 500, color: "var(--fg)" }}>{p.name}</strong>
                  {p.rolle && <span className="caption">{p.rolle}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>Echte Partner folgen, sobald sie bestätigt sind.</p>
        )}
        <Link href="/entrepreneurs" className="row" style={{ marginTop: 20, color: "var(--accent)", fontWeight: 500, fontSize: 13 }}>
          Zum Netzwerk <Icon name="arrow-right" size={16} />
        </Link>
      </section>

      {/* ── Affiliate-Disclaimer ───────────────────────────────── */}
      <div className="affiliate-footer-note">
        <Icon name="info-circle" size={15} style={{ color: "var(--accent)" }} />
        Mit Affiliate gekennzeichnete Links bringen JTC eine Provision — für dich
        ohne Mehrkosten.
      </div>
    </div>
  );
}
