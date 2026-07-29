import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NavApp } from "@/components/navigation/NavApp";
import { navigationEnabled } from "@/lib/flags";
import { aktuelleSprache, uebersetzer } from "@/lib/i18n/server";
import { WOERTERBUECHER } from "@/lib/i18n/woerterbuch";

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
export default async function NavigationPage() {
  // Kill-Switch (Reversibilität): NEXT_PUBLIC_FEATURE_NAVIGATION=off → 404.
  if (!navigationEnabled()) notFound();
  // Sprache serverseitig bestimmen und an die Client-Shell reichen (REQ-I18N-001),
  // damit dort nicht kurz die falsche Sprache aufblitzt.
  const sprache = await aktuelleSprache();
  const t = await uebersetzer();
  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6, marginBottom: 20 }}>
        <span className="section-label">{t("navseite.eyebrow")}</span>
        <h1>{t("navseite.titel")}</h1>
        <p className="muted" style={{ maxWidth: 620 }}>
          {t("navseite.einleitung")}{" "}
          {/*
            BEWUSST NICHT ÜBERSETZT (REQ-I18N-001, REQ-SAFE-002): Der
            Sicherheitshinweis ist die haftungsrelevante Abgrenzung zwischen
            Planungshilfe und amtlicher Seekarte. Sein Wortlaut ist bewusst
            gewählt; eine selbst formulierte Übersetzung könnte die Aussage
            verschieben. Eine englische Fassung braucht juristische Freigabe.
          */}
          <span lang="de">Planungshilfe: ersetzt keine amtlichen Seekarten.</span>
        </p>
      </div>
      <NavApp woerter={WOERTERBUECHER[sprache]} />
    </div>
  );
}
