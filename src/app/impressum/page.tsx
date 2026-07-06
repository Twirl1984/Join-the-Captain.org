import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum",
  robots: { index: false },
  alternates: { canonical: "/impressum" },
};

// ⚠️ PLATZHALTER: Vor Veröffentlichung die [ECKIGEN] Angaben befüllen und
// juristisch gegenprüfen. Pflichtangaben nach § 5 DDG.
export default function ImpressumPage() {
  return (
    <div className="container section prose" style={{ maxWidth: 720 }}>
      <span className="section-label">Rechtliches</span>
      <h1>Impressum</h1>

      <h3>Angaben gemäß § 5 DDG</h3>
      <p>
        [VORNAME NACHNAME]
        <br />
        [STRASSE HAUSNUMMER]
        <br />
        [PLZ ORT]
        <br />
        Deutschland
      </p>

      <h3>Kontakt</h3>
      <p>
        E-Mail: [KONTAKT@ADRESSE.DE]
        <br />
        Telefon: [+49 …] <em>(optional, aber empfohlen)</em>
      </p>

      <h3>Verantwortlich für den Inhalt</h3>
      <p>[VORNAME NACHNAME], Anschrift wie oben.</p>

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

      <h3>Streitschlichtung</h3>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
        vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </div>
  );
}
