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

// ── Beaufort-Windfahne (Windbarb) fürs Karten-Overlay (REQ-WET-015) ───────────
// Seemannschafts-/Stationsmodell-Standard: ein Glyph kodiert Richtung UND Stärke.
// Zerlegung der (auf 5 kn gerundeten) Windgeschwindigkeit in Wimpel (50 kn),
// Vollstriche (10 kn) und Halbstriche (5 kn). Der Schaft zeigt zur WIND-HERKUNFT
// (anders als der bisherige Pfeil, der die Flow-Richtung zeigt).

export interface WindBarb {
  /** Wimpel (je 50 kn). */
  pennants: number;
  /** Vollstriche (je 10 kn). */
  fullBarbs: number;
  /** Halbstriche (je 5 kn). */
  halfBarbs: number;
  /** true bei (nahezu) Windstille (< 3 kn) — statt Federn ein Kreis. */
  calm: boolean;
}

/** Windgeschwindigkeit (kn) → Barb-Zerlegung (auf 5 kn gerundet). */
export function windBarb(kn: number): WindBarb {
  if (!Number.isFinite(kn) || kn < 3) {
    return { pennants: 0, fullBarbs: 0, halfBarbs: 0, calm: true };
  }
  const v = Math.round(kn / 5) * 5;
  if (v < 3) return { pennants: 0, fullBarbs: 0, halfBarbs: 0, calm: true };
  const pennants = Math.floor(v / 50);
  const rem = v % 50;
  const fullBarbs = Math.floor(rem / 10);
  const halfBarbs = Math.floor((rem % 10) / 5);
  return { pennants, fullBarbs, halfBarbs, calm: false };
}

/**
 * SVG-`d`-Pfade der Federn (OHNE Schaft) für einen Barb im 24×32-viewBox: Schaft
 * senkrecht bei x=12, Spitze (Herkunfts-Ende) oben. Wimpel zuerst (nahe Spitze),
 * dann Vollstriche, dann Halbstriche — nach unten gestaffelt. Länge = Feder-Anzahl
 * (`pennants + fullBarbs + halfBarbs`); bei `calm` leer.
 */
export function barbSvgPaths(b: WindBarb): string[] {
  const paths: string[] = [];
  const x = 12;
  const FLEN = 10; // Vollstrich-Länge (horizontal)
  const HLEN = 5; // Halbstrich-Länge
  const SLANT = 4; // Neigung der Feder zur Spitze
  let y = 5; // Start nahe der Schaft-Spitze
  for (let i = 0; i < b.pennants; i++) {
    paths.push(`M${x},${y} L${x + FLEN},${y + 3} L${x},${y + 6} Z`);
    y += 8;
  }
  for (let i = 0; i < b.fullBarbs; i++) {
    paths.push(`M${x},${y} L${x + FLEN},${y - SLANT}`);
    y += 4;
  }
  for (let i = 0; i < b.halfBarbs; i++) {
    paths.push(`M${x},${y} L${x + HLEN},${y - SLANT / 2}`);
    y += 4;
  }
  return paths;
}

/**
 * CSS-Rotation der Windfahne: Schaft in Grundstellung senkrecht (zeigt nach Nord).
 * Der Barb soll zur Wind-HERKUNFT zeigen → Rotation = windFromDeg (normalisiert).
 * (Kontrast zu `windArrowRotationDeg`, das die Flow-Richtung + 180° zeigt.)
 */
export function windBarbRotationDeg(windFromDeg: number): number {
  return (((windFromDeg % 360) + 360) % 360);
}

// ── Temperatur & Niederschlag als Kartensymbole (REQ-WET-016) ─────────────────

/** 2-m-Temperatur → kurzes Label „17°"; `null`/NaN → `null` (kein Symbol). */
export function formatTemp(c: number | null | undefined): string | null {
  if (c == null || Number.isNaN(c)) return null;
  return `${Math.round(c)}°`;
}

export type PrecipKey = "leicht" | "mäßig" | "stark";

export interface PrecipInfo {
  key: PrecipKey;
  /** Regen-Glyph fürs Overlay. */
  glyph: string;
  /** Barrierefreies Label / Tooltip. */
  label: string;
}

/**
 * Niederschlag (mm/h) → Intensitäts-Glyph. Trocken (`< 0.1`, `null`, NaN) → `null`
 * (kein Symbol, damit die Karte nicht überladen wirkt). Bänder: < 0.5 leicht,
 * < 4 mäßig, sonst stark.
 */
export function precipInfo(mm: number | null | undefined): PrecipInfo | null {
  if (mm == null || Number.isNaN(mm) || mm < 0.1) return null;
  if (mm < 0.5) return { key: "leicht", glyph: "🌦️", label: "leichter Regen" };
  if (mm < 4) return { key: "mäßig", glyph: "🌧️", label: "mäßiger Regen" };
  return { key: "stark", glyph: "⛈️", label: "starker Regen" };
}
