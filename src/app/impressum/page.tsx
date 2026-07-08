import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum",
  robots: { index: false },
  alternates: { canonical: "/impressum" },
};

// Angaben übernommen von join-the-captain.de (Impressum, Stand 2026-07) —
// bewusst OHNE Telefonnummer: § 5 DDG verlangt neben der E-Mail nur einen
// schnellen elektronischen Kommunikationsweg (EuGH C-298/07), kein Telefon.
export default function ImpressumPage() {
  return (
    <div className="container section prose" style={{ maxWidth: 720 }}>
      <span className="section-label">Rechtliches</span>
      <h1>Impressum</h1>

      <h3>Angaben gemäß § 5 DDG</h3>
      <p>
        Christoph Funda
        <br />
        Dr. Funda Engineering
        <br />
        Einzelunternehmer
        <br />
        Wiesenstraße 52B
        <br />
        90443 Nürnberg
        <br />
        Deutschland
      </p>

      <h3>Kontakt</h3>
      <p>E-Mail: impressum@join-the-captain.de</p>

      <h3>Verantwortlich für den Inhalt</h3>
      <p>Christoph Funda, Anschrift wie oben.</p>

      <h3>Hinweis zu Navigations- und Wetterdaten</h3>
      <p>
        Die auf dieser Website bereitgestellten Wetter-, Tiefen- und Routendaten
        (u.&nbsp;a. Open-Meteo, EMODnet Bathymetry, OpenStreetMap — frei verfügbare
        Open-Source-Quellen) sind eine <strong>Planungs- und Entscheidungshilfe</strong>.
        Die Anwendung ist <strong>nicht als Navigationsmittel zugelassen</strong> und
        darf nur unterstützend verwendet werden. Sie ersetzen keine
        amtlichen Seekarten, keine amtlichen Warnungen und keine Seemannschaft.
        Die Nutzung erfolgt auf eigene Verantwortung; für die Richtigkeit,
        Vollständigkeit und Aktualität der Daten wird keine Gewähr übernommen.
      </p>

      <h3>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h3>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor
        einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </div>
  );
}
