import Link from "next/link";
import { getTools } from "@/lib/data";
import { HomeToolFilter } from "@/components/HomeToolFilter";
import { Icon } from "@/components/Icon";
import { AffiliateLabel } from "@/components/AffiliateLabel";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tools = await getTools();

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
            Ausgewählte Tools und Empfehlungen (teils mit Werbe-/Affiliate-Links)
            und Törnberichte rund um deinen Törn.
          </p>
        </div>
      </section>

      {/* ── Reiseblog-Strip ────────────────────────────────────── */}
      <section className="podcast-strip">
        <span className="mic"><Icon name="compass" size={24} /></span>
        <div className="stack" style={{ gap: 4, flex: 1 }}>
          <span className="eyebrow" style={{ letterSpacing: "0.3em" }}>Reiseblog</span>
          <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 20, color: "var(--fg)" }}>
            Echte Törns, ehrlich erzählt
          </strong>
          <span className="caption">
            Schären · Dänische Südsee · Kanaren · Äolische Inseln
          </span>
        </div>
        <Link href="/reisen" className="btn btn-gold">
          <Icon name="arrow-right" size={16} /> Berichte lesen
        </Link>
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
            Kautionsversicherung kann den Selbstbehalt abdecken, eine
            Skipper-Haftpflicht Personen- und Sachschäden. Wichtig: rechtzeitig <strong>vor dem Törn</strong>{" "}
            abschließen — danach ist es zu spät. Später bleibt höchstens noch
            Support, um einen Schadensfall zu klären.
          </p>
          <ul className="focus-list">
            <li><Icon name="shield-check" size={17} /> Laut Anbieter: Kaution &amp; Selbstbehalt abgedeckt (Höchstbeträge siehe Bedingungen)</li>
            <li><Icon name="anchor" size={17} /> Laut Anbieter: Skipper-Haftpflicht für Personen- &amp; Sachschäden</li>
            <li><Icon name="clock" size={17} /> Laut Anbieter: tageweise buchbar</li>
          </ul>
          <div className="row" style={{ gap: 18, flexWrap: "wrap", marginTop: 4 }}>
            <Link href="/tools?phase=planung" className="btn btn-gold">
              Versicherung ansehen <Icon name="arrow-right" size={15} />
            </Link>
            <span className="affiliate-note"><AffiliateLabel /> Provisionslink – für dich ohne Mehrkosten</span>
          </div>
        </div>
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

      {/* ── Affiliate-Disclaimer ───────────────────────────────── */}
      <div className="affiliate-footer-note">
        <Icon name="info-circle" size={15} style={{ color: "var(--accent)" }} />
        Mit „Werbung“ gekennzeichnete Links sind Provisions-/Affiliate-Links: Wenn du
        darüber kaufst oder buchst, erhält Join the Captain eine Provision — für dich
        ohne Mehrkosten.
      </div>
    </div>
  );
}
