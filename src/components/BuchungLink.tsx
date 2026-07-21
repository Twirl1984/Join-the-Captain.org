"use client";

import { Icon } from "./Icon";
import { plausibleEvent } from "./Plausible";
import { EREIGNIS, mitUtm, type BuchungHerkunft } from "@/lib/analytics/ereignisse";

// Der Klick von der .org (Reichweite) zur .de (Umsatz) ist DIE Konversion des
// Funnels (REQ-BIZ-001). Kopf und Fuß sind Server-Komponenten und können kein
// onClick — deshalb diese kleine Client-Komponente. Sie misst den Klick UND
// hängt die Herkunft als UTM an, damit auf der .de-Seite ankommt, woher der
// Besucher kam.
export function BuchungLink({
  von,
  className,
  children,
  mitPfeil = false,
}: {
  von: BuchungHerkunft;
  className?: string;
  children: React.ReactNode;
  mitPfeil?: boolean;
}) {
  const url = mitUtm(
    "https://join-the-captain.de",
    { source: "org", medium: "funnel", content: von },
    "https://join-the-captain.de",
  );
  return (
    <a
      className={className}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`buchung-link-${von}`}
      onClick={() => plausibleEvent(EREIGNIS.BUCHUNG_GEKLICKT, { von })}
    >
      {children}
      {mitPfeil && <Icon name="arrow-right" size={16} />}
    </a>
  );
}
