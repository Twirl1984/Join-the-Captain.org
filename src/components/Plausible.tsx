import Script from "next/script";

// Plausible Analytics (DSGVO-konform, ohne Cookies).
// Lädt nur, wenn Domain konfiguriert ist.
export function Plausible() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.js";
  if (!domain) return null;
  return <Script defer data-domain={domain} src={src} strategy="afterInteractive" />;
}

// Hilfsfunktion, um Custom-Events zu feuern (Client-Komponenten).
export function plausibleEvent(name: string, props?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    plausible?: (n: string, o?: { props: Record<string, string | number> }) => void;
  };
  w.plausible?.(name, props ? { props } : undefined);
}
