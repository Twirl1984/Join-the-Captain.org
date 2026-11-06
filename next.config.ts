import type { NextConfig } from "next";

// Kill-Switch des Törn-Manöver-Duells (gleiche Auswertung wie flagEnabled() in
// src/lib/flags.ts: Default an, "off"/"false"/"0" aus). Hier dupliziert, weil
// next.config beim Start ohne Pfad-Aliase geladen wird.
const duellAn = !["off", "false", "0"].includes((process.env.NEXT_PUBLIC_FEATURE_DUELL ?? "").trim().toLowerCase());

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Plausible-Proxy optional; externe Bilder werden hier nicht geladen (Icon-Keys statt URLs).
  poweredByHeader: false,
  // /reisen ist eine statische Uebersichtsseite (public/reisen/index.html) —
  // ohne Rewrite wuerde Next dort eine Route erwarten und 404 liefern.
  async rewrites() {
    return [{ source: "/reisen", destination: "/reisen/index.html" }];
  },
  // Toern-Manoever-Duell (REQ-DUEL-005): statische Offline-App in public/toern-duell/.
  // Next entfernt den abschliessenden Slash, relative Pfade der App wuerden dann
  // gegen "/" aufgeloest — darum ein Redirect auf die Datei selbst.
  async redirects() {
    return duellAn
      ? [{ source: "/toern-duell", destination: "/toern-duell/index.html", permanent: false }]
      : [{ source: "/toern-duell/:path*", destination: "/tools", permanent: false }];
  },
  async headers() {
    return [
      // Nur fuer den Skipper gedacht: nicht indexieren; SW-Skript nie HTTP-cachen,
      // damit neue Versionen sofort ausgerollt werden.
      { source: "/toern-duell/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/toern-duell/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
