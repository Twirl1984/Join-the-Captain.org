// Bucht-Windschutz-Ranking (REQ-EXP-005) — reine Logik für Übernachtungs-Bucht-Wertung
// nach Windrichtung.
//
// Eine Bucht wird durch einen Öffnungssektor beschrieben: die Richtung, in die
// die Bucht zum offenen Wasser hin offen ist (oeffnungsrichtung_deg, 0–360,
// rechtweisend), und die Breite dieses Sektors (oeffnungsbreite_deg, z. B. 90 = 45°
// links/rechts der Öffnung sind noch exponiert).
//
// Windschutz-Konvention (meteorologisch): windAusDeg = Richtung, AUS der der Wind kommt.
// Eine Bucht ist voll exponiert (score ≈ 0), wenn der Wind AUS der Öffnungsrichtung kommt
// (Wellen/Schwell laufen ein), und voll geschützt (score ≈ 1), wenn der Wind AUS der
// Gegenrichtung kommt (Öffnung + 180°).
//
// Formel: score = (zirkuläre Winkeldistanz) / 180, wobei Distanz die kleinere der zwei
// Winkeldifferenzen auf dem Kreis ist (0..180°). Dies ist ein I/O-freies, steuerbares Modell
// für Tests und künftige UI-Integration.
//
// Sicherheits-Wording: Windschutz-Sektoren sind eine Entscheidungs-INFO, KEINE amtliche
// Freigabe oder Seekarten-Ersatz (siehe WINDSCHUTZ_HINWEIS).

export interface BuchtSektor {
  id: string;
  name: string;
  /** Kompass-Richtung der Öffnung zur offenen See hin, 0–360°, rechtweisend. */
  oeffnungsrichtung_deg: number;
  /** Breite des exponiert-Sektors, in Grad, z. B. 90 = 45° beidseitig der Öffnung. */
  oeffnungsbreite_deg: number;
}

/**
 * Berechnet den Windschutz-Score einer Bucht bei gegebener Windrichtung.
 *
 * @param bucht — Bucht mit Öffnungsrichtung und -breite.
 * @param windAusDeg — Richtung, AUS der der Wind kommt (0–360, rechtweisend).
 * @returns Score zwischen 0 (voll exponiert) und 1 (voll geschützt), oder NaN wenn
 *          Eingabe ungültig (robustes Verhalten statt throw).
 *
 * Formel: Zirkuläre Winkeldistanz zwischen windAusDeg und oeffnungsrichtung_deg,
 * dann skaliert auf [0, 1] über die Spanne [0°, 180°].
 */
export function windschutzScore(bucht: BuchtSektor, windAusDeg: number): number {
  // Normalisiere beide Winkel auf [0, 360)
  const normWind = normalizeAngle(windAusDeg);
  const normOffnung = normalizeAngle(bucht.oeffnungsrichtung_deg);

  // Robust: Falls Eingabe ungültig (z. B. NaN), gibt normalizeAngle NaN zurück.
  // Wir behandeln das als "keine Windinfo" → neutral (0.5 Score).
  if (!Number.isFinite(normWind) || !Number.isFinite(normOffnung)) {
    return 0.5;
  }

  // Zirkuläre Winkeldistanz: kleinere der zwei Differenzen auf dem Kreis
  const rawDiff = Math.abs(normWind - normOffnung);
  const distance = rawDiff > 180 ? 360 - rawDiff : rawDiff;

  // Score: 0 bei distance = 0° (exponiert), 1 bei distance = 180° (geschützt)
  const score = distance / 180;

  return Math.min(1, Math.max(0, score)); // Clamp auf [0, 1]
}

/**
 * Rankt eine Liste von Buchten nach Windschutz (absteigend nach Score).
 *
 * @param buchten — Array von Buchten
 * @param windAusDeg — Richtung, AUS der der Wind kommt.
 * @returns Neu sortiertes Array mit Score-Eigenschaft hinzugefügt, absteigend nach
 *          Score. Bei Gleichstand wird die Eingabe-Reihenfolge beibehalten (stabil).
 */
export function rankBuchten(
  buchten: BuchtSektor[],
  windAusDeg: number,
): Array<BuchtSektor & { score: number }> {
  const bewertete = buchten.map((b, _index) => ({
    ...b,
    score: windschutzScore(b, windAusDeg),
    _index, // zur stabilen Sortierung
  }));

  // Absteigend nach Score, dann stabil (_index) bei Gleichstand
  bewertete.sort((a, b) => {
    const diff = b.score - a.score;
    if (diff !== 0) return diff;
    return a._index - b._index;
  });

  // _index entfernen (nicht im Resultat)
  return bewertete.map(({ _index, ...rest }) => rest);
}

/**
 * Sicherheits-Hinweis für die UI: Windschutz-Sektoren sind eine Info-Hilfe,
 * aber KEINE Freigabe oder Seemannschaft-Ersatz.
 */
export const WINDSCHUTZ_HINWEIS =
  "Windschutz-Sektoren sind eine Info-Hilfe, keine Ankerplatz-Freigabe. " +
  "Ankergrund, Schwoiraum, Wassertiefe und die amtliche Seekarte selbst prüfen.";

// === Hilfsfunktionen ===

/**
 * Normalisiert einen Winkel auf das Intervall [0, 360).
 * Robust gegen NaN und Infinity: gibt bei ungültiger Eingabe NaN zurück.
 */
function normalizeAngle(deg: number): number {
  if (!Number.isFinite(deg)) return NaN;
  const norm = deg % 360;
  return norm < 0 ? norm + 360 : norm;
}
