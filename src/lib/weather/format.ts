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
