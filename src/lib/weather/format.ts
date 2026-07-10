// format.ts — Anzeige-Helfer für Windrichtung (rein, getestet).
//
// Konventionen (Quelle vieler Missverständnisse, deshalb hier festgenagelt):
//   wind_from_deg  = meteorologisch, WOHER der Wind kommt (0 = aus Nord).
//   Windpfeil      = zeigt WOHIN der Wind weht (Flow-Richtung, wie bei
//                    Windy/Windfinder/Verklicker) = wind_from_deg + 180.
//   Text           = seglerüblich die Herkunft als Kompass-Kürzel („aus NW").

/** 8er-Kompass-Kürzel für die Richtung, AUS der der Wind kommt. */
export function compassPoint(windFromDeg: number): string {
  const pts = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  const d = ((windFromDeg % 360) + 360) % 360;
  return pts[Math.round(d / 45) % 8];
}

/** Basisrichtung des `send`-Icons (zeigt unrotiert nach Nordost = 45°). */
export const SEND_ICON_BASE_DEG = 45;

/**
 * CSS-Rotation, damit das `send`-Icon die FLOW-Richtung zeigt (wohin der Wind
 * weht): Ziel = windFrom + 180, Icon-Basis 45° → Rotation = windFrom + 135.
 */
export function windArrowRotationDeg(windFromDeg: number): number {
  return ((windFromDeg + 180 - SEND_ICON_BASE_DEG) % 360 + 360) % 360;
}

// ── Himmels-Zustand fürs Zeitreise-Overlay (REQ-WET-014) ─────────────────────
// Aus dem Bedeckungsgrad (0..100 %) ein Himmels-Icon ableiten, damit AUCH eine
// wolkenlose Lage sichtbar „klar“/„klare Nacht“ ist (statt nur Wind zu zeigen und
// leer zu wirken). Bei klarem/heiterem Himmel ist das Icon tag-/nachtabhängig:
// Sonne am Tag, Mond in der Nacht — bewusst KEINE Regen-/Gewitter-Aussage (die
// tragen die Warn-Flags gale/thunderstorm separat).

export type SkyKey = "klar" | "heiter" | "wolkig" | "bedeckt";

export interface SkyInfo {
  key: SkyKey;
  /** Emoji-Glyph fürs Karten-Overlay (bei klar/heiter nachtabhängig). */
  glyph: string;
  /** Barrierefreies Label / Tooltip. */
  label: string;
}

/**
 * Bedeckungsgrad → Himmels-Icon. `cloudPct == null` (keine Daten) → `null`
 * (dann kein Icon). `isDay === false` schaltet klar/heiter auf die Nacht-Glyphe
 * (Mond); fehlt die Info (`null`/Default), wird Tag angenommen.
 * Bänder in Achteln (okta-nah): <13 % klar, <38 % heiter, <75 % wolkig, sonst bedeckt.
 */
export function skyCondition(
  cloudPct: number | null | undefined,
  isDay: boolean | null = true,
): SkyInfo | null {
  if (cloudPct == null || Number.isNaN(cloudPct)) return null;
  const night = isDay === false;
  if (cloudPct < 13) {
    return night
      ? { key: "klar", glyph: "🌙", label: "klare Nacht" }
      : { key: "klar", glyph: "☀️", label: "klar, sonnig" };
  }
  if (cloudPct < 38) {
    return night
      ? { key: "heiter", glyph: "🌙", label: "heiter (Nacht)" }
      : { key: "heiter", glyph: "🌤️", label: "heiter" };
  }
  if (cloudPct < 75) {
    return { key: "wolkig", glyph: "⛅", label: "wolkig" };
  }
  return { key: "bedeckt", glyph: "☁️", label: "bedeckt" };
}
