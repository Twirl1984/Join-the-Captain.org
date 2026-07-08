import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  robots: { index: false },
  alternates: { canonical: "/datenschutz" },
};

// Verantwortlichen-Daten übernommen von join-the-captain.de (Stand 2026-07).
// Deckt den realen Stand der Website/App ab: Server-Logs (Strato-VPS, nginx),
// Karten-Tiles (OSM/OpenSeaMap/EMODnet), Wetterdaten (Open-Meteo), Plausible
// (cookielos), Feedback-Formular (Name/E-Mail optional), GPS im Browser.
export default function DatenschutzPage() {
  return (
    <div className="container section prose" style={{ maxWidth: 720 }}>
      <span className="section-label">Rechtliches</span>
      <h1>Datenschutzerklärung</h1>

      <h3>1. Verantwortlicher</h3>
      <p>
        Christoph Funda · Dr. Funda Engineering · Wiesenstraße 52B, 90443
        Nürnberg, Deutschland · E-Mail: datenschutz@join-the-captain.de
      </p>

      <h3>2. Hosting &amp; Server-Logs</h3>
      <p>
        Diese Website wird auf einem Server der Strato AG (Berlin) betrieben.
        Beim Aufruf verarbeitet der Webserver technisch notwendige Daten
        (IP-Adresse, Zeitpunkt, aufgerufene URL, User-Agent) in Log-Dateien —
        Rechtsgrundlage Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO (sicherer
        Betrieb). Logs werden turnusmäßig gelöscht.
      </p>

      <h3>3. Kartendarstellung (OpenStreetMap, OpenSeaMap, EMODnet)</h3>
      <p>
        Zur Darstellung der See- und Tiefenkarten lädt dein Browser Kartenkacheln
        direkt von der OpenStreetMap Foundation (Großbritannien), OpenSeaMap und
        EMODnet (EU). Dabei wird deine IP-Adresse an diese Anbieter übertragen.
        Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO (Darstellung
        interaktiver Karten als Kernfunktion). Ohne Kartenaufruf werden keine
        Daten übertragen.
      </p>

      <h3>4. Wetter-, Strömungs- und Tiefendaten</h3>
      <p>
        Für Prognosen fragt <em>unser Server</em> die Dienste Open-Meteo,
        EMODnet Bathymetry und GEBCO an. Übertragen werden dabei nur die
        angefragten Koordinaten deiner geplanten Route — nicht deine IP-Adresse
        und keine Kontodaten.
      </p>

      <h3>5. GPS-Position (Navigations-App)</h3>
      <p>
        Wenn du die GPS-Funktion aktivierst, fragt dein Browser deine
        Standortfreigabe ab (Einwilligung, Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a
        DSGVO). Die Position wird ausschließlich in deinem Browser verarbeitet
        und — nur zur Routenberechnung — als Koordinate an unseren Server
        gesendet. Sie wird <strong>nicht gespeichert</strong> und nicht mit
        deiner Person verknüpft. Du kannst die Freigabe jederzeit in den
        Browser-Einstellungen widerrufen.
      </p>

      <h3>6. Reichweitenmessung (Plausible)</h3>
      <p>
        Wir nutzen Plausible Analytics (EU-gehostet), eine cookielose
        Reichweitenmessung ohne personenbezogenes Tracking — Rechtsgrundlage
        Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO. Es werden keine Cookies
        gesetzt und keine geräteübergreifenden Profile gebildet.
      </p>

      <h3>7. Feedback-Formular</h3>
      <p>
        Beim Wetter-Feedback speichern wir deine Bewertung, optionalen Freitext
        und — nur wenn du sie freiwillig angibst — Name und E-Mail-Adresse
        (Einwilligung, Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a DSGVO), zusammen mit
        dem Planungs-Kontext (Route, Zeitraum, Einstellungen) zur Verbesserung
        der Vorhersagequalität. Löschung auf Anfrage an die o.&nbsp;g.
        Kontaktadresse.
      </p>

      <h3>8. Community-Funktionen</h3>
      <p>
        Für Votes/Pledges wird eine zufällige Kennung in einem Cookie
        gespeichert (technisch notwendig, § 25 Abs.&nbsp;2 TDDDG), ohne
        Personenbezug. Zahlungen laufen über Stripe (eigene
        Datenschutzhinweise von Stripe gelten).
      </p>

      <h3>9. SSL-/TLS-Verschlüsselung</h3>
      <p>
        Diese Website nutzt aus Sicherheitsgründen eine SSL- bzw.
        TLS-Verschlüsselung (erkennbar an „https://" und dem Schloss-Symbol).
        Damit können übermittelte Daten nicht von Dritten mitgelesen werden.
      </p>

      <h3>10. Widerruf deiner Einwilligung</h3>
      <p>
        Bereits erteilte Einwilligungen (z.&nbsp;B. GPS-Freigabe,
        Feedback-Kontaktdaten) kannst du jederzeit mit Wirkung für die Zukunft
        widerrufen — formlos an die o.&nbsp;g. Kontaktadresse. Die
        Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt
        unberührt.
      </p>

      <h3>11. Deine Rechte</h3>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung
        der Verarbeitung, Datenübertragbarkeit sowie Widerspruch
        (Art.&nbsp;15–21 DSGVO) und auf Beschwerde bei einer
        Datenschutz-Aufsichtsbehörde. Wende dich dafür an die o.&nbsp;g.
        Kontaktadresse.
      </p>

      <p className="caption">Stand: Juli 2026 · Quelle Grundstruktur: e-recht24.de / join-the-captain.de</p>
    </div>
  );
}
