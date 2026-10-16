// Pflicht-Kennzeichnung für Provisions-/Affiliate-Links (§ 5a UWG): sichtbar VOR dem Link.
// Bewusst nur deutsch (siehe Hinweis in SiteFooter); EN-Fassung braucht juristische Freigabe.
export function AffiliateLabel({ className }: { className?: string }) {
  return (
    <span className={`affiliate-label${className ? ` ${className}` : ""}`} lang="de">
      Werbung
    </span>
  );
}

/** rel-Wert für alle Partnerlinks. */
export const AFFILIATE_REL = "sponsored nofollow noopener noreferrer";
