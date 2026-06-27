import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Plausible-Proxy optional; externe Bilder werden hier nicht geladen (Icon-Keys statt URLs).
  poweredByHeader: false,
};

export default nextConfig;
