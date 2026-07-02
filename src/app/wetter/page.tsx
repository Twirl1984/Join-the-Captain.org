import type { Metadata } from "next";
import { WetterApp } from "@/components/wetter/WetterApp";

export const metadata: Metadata = {
  title: "Wetter & Routen-Planer",
  description:
    "Route auf der Karte setzen und Wind, Welle, Sturm- und Gewitterwarnungen plus " +
    "Ankunftszeit für jeden Abschnitt bekommen. Mit einstellbarer Warn-Empfindlichkeit.",
  alternates: { canonical: "/wetter" },
};

// Erstes JTC-Eigenbau-Tool: Wetter + ETA entlang der Route (kein Affiliate).
export default function WetterPage() {
  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6, marginBottom: 20 }}>
        <span className="section-label">JTC-Eigenbau · Planung</span>
        <h1>Wetter & Routen-Planer</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          Route klicken, Abfahrt wählen — wir rechnen Wind, Welle, Warnungen und
          Ankunftszeit für jeden Abschnitt. Wie vorsichtig gewarnt wird, stellst du
          selbst ein.
        </p>
      </div>
      <WetterApp />
    </div>
  );
}
