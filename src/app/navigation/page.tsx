import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NavApp } from "@/components/navigation/NavApp";
import { navigationEnabled } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Navigation & Wetter — Seekarte, Tiefen & GPS",
  description:
    "Seekarte mit Tiefen (EMODnet), Routenplanung die Land automatisch umfährt, GPS-Position, " +
    "echte Ankunftszeiten, Strömung, Windrichtung und Wolkenfelder über die Zeit — für Nordsee, " +
    "Ostsee, Mittelmeer und mehr.",
  alternates: { canonical: "/navigation" },
};

// Navigations-App (Ausbau des /wetter-Tools): eigenes Sub-Modul, /wetter bleibt
// als stabiler Test-Tab bestehen. Konzept: docs/navigation-app-plan.md
export default function NavigationPage() {
  // Kill-Switch (Reversibilität): NEXT_PUBLIC_FEATURE_NAVIGATION=off → 404.
  if (!navigationEnabled()) notFound();
  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6, marginBottom: 20 }}>
        <span className="section-label">JTC-Eigenbau · Beta</span>
        <h1>Navigation &amp; Wetter</h1>
        <p className="muted" style={{ maxWidth: 620 }}>
          Seekarte mit Tiefen, Route, die automatisch um Land herumführt, deine GPS-Position
          und echte Ankunftszeiten — dazu Strömung, Wind und Wolkenfelder über die Zeit.
          Planungshilfe: ersetzt keine amtlichen Seekarten.
        </p>
      </div>
      <NavApp />
    </div>
  );
}
