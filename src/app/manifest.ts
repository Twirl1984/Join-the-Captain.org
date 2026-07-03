import type { MetadataRoute } from "next";

// Web-App-Manifest: macht die Navigations-App als PWA installierbar
// ("Zum Startbildschirm hinzufügen") — der Zwischenschritt vor den nativen
// Capacitor-Builds (mobile/README.md). start_url ist bewusst /navigation:
// wer die App installiert, will die Karte, nicht die Website.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JTC Navigation — Seekarte, Tiefen & GPS",
    short_name: "JTC Navigation",
    description:
      "Seekarte mit Tiefen, Land-vermeidende Routenplanung, GPS-Position, echte " +
      "Ankunftszeiten, Strömung, Wind und Wolkenfelder — Planungshilfe für Segler.",
    start_url: "/navigation",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0B2545",
    theme_color: "#0B2545",
    lang: "de",
    categories: ["navigation", "weather", "sports"],
    icons: [
      // SVG skaliert verlustfrei; echte PNG-Größen (192/512/1024) kommen mit
      // dem Store-Release (mobile/README.md, Icon-Checkliste).
      { src: "/assets/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/assets/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
