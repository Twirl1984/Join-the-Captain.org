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
      "Ankunftszeiten, Strömung, Wind und Wolkenfelder. Planungshilfe für Segler — " +
      "ersetzt keine amtlichen Seekarten und keine Seemannschaft.",
    start_url: "/navigation",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0B2545",
    theme_color: "#0B2545",
    lang: "de",
    categories: ["navigation", "weather", "sports"],
    icons: [
      // PNG in 192/512 (any + maskable mit Safe-Zone) — Pflicht für zuverlässige
      // Installs (Android/Chrome nutzt maskable, iOS nimmt 512er). SVG als Bonus.
      { src: "/assets/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/assets/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/assets/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/assets/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/assets/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
