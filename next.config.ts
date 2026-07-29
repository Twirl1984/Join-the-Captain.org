import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Plausible-Proxy optional; externe Bilder werden hier nicht geladen (Icon-Keys statt URLs).
  poweredByHeader: false,
  // /reisen ist eine statische Uebersichtsseite (public/reisen/index.html) —
  // ohne Rewrite wuerde Next dort eine Route erwarten und 404 liefern.
  async rewrites() {
    return [{ source: "/reisen", destination: "/reisen/index.html" }];
  },
};

export default nextConfig;
