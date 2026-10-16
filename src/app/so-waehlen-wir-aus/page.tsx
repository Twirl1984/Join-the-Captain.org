import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "So wählen wir aus",
  description: "Wie Join the Captain Tools auswählt und wie Werbe- und Affiliate-Links gekennzeichnet sind.",
  alternates: { canonical: "/so-waehlen-wir-aus" },
};

// Transparenzseite zu Auswahl und Werbekennzeichnung (§ 5a UWG). Die Aussagen müssen
// zur Praxis passen — Änderungen an Auswahlprozess oder Provisionslogik hier nachziehen.
export default function SoWaehlenWirAusPage() {
  return (
    <div className="container section prose" style={{ maxWidth: 720 }}>
      <span className="section-label">Transparenz</span>
      <h1>So wählen wir aus</h1>

      <h3>Werbung und Provisionen</h3>
      <p>
        Links mit der Kennzeichnung <strong>„Werbung“</strong> sind Provisions- bzw.
        Affiliate-Links. Wenn du über so einen Link kaufst oder buchst, erhält
        Join the Captain eine Provision. Für dich entstehen dadurch keine
        Mehrkosten. Wir listen derzeit überwiegend Anbieter, mit denen eine
        Provisionsvereinbarung besteht.
      </p>

      <h3>Auswahlkriterien</h3>
      <p>
        Wir wählen Tools danach aus, ob sie für Törn-Planung und Bordalltag
        relevant sind. Die Beschreibungen sind redaktionelle Einschätzungen von
        Join the Captain und keine unabhängigen Tests. Angaben zu Leistungen und
        Preisen stammen von den Anbietern; maßgeblich sind deren aktuelle
        Bedingungen.
      </p>

      <h3>Keine Beratung</h3>
      <p>
        Hinweise zu Versicherungen sind keine Versicherungsberatung. Maßgeblich
        sind allein die Bedingungen des jeweiligen Versicherers.
      </p>

      <p>
        Fragen oder Korrekturen: <a href="mailto:impressum@join-the-captain.de">impressum@join-the-captain.de</a>
        {" · "}
        <Link href="/impressum">Impressum</Link>
      </p>
    </div>
  );
}
