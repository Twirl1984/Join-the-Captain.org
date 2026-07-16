// Buchten-Ranking nach vorhergesagter Abend-Windrichtung (REQ-EXP-005).
//
// Reine Logik ohne I/O (wie route-forecast.ts): Wetter-Sampler injiziert.
// `windschutz_sektoren` = Kompass-Sektoren, aus denen die Bucht durch Land
// geschützt ist (z. B. 'N,NO,O'). Reine Info-Einordnung, KEINE Ankerplatz-
// Freigabe — ersetzt keine amtliche Seekarte/Seemannschaft.

import type { SampleForecast } from "../weather/route-forecast";
import type { RevierPoi } from "../types";

export type Sektor = "N" | "NO" | "O" | "SO" | "S" | "SW" | "W" | "NW";
const SEKTOREN: Sektor[] = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];

export type SchutzKategorie = "geschuetzt" | "unbekannt" | "exponiert";
const KATEGORIE_RANG: Record<SchutzKategorie, number> = {
  geschuetzt: 0,
  unbekannt: 1,
  exponiert: 2,
};

export interface BuchtWindRanking {
  poi: RevierPoi;
  windFromDeg: number;
  windSektor: Sektor;
  schutzKategorie: SchutzKategorie;
}

/** Ordnet eine Windrichtung (Grad, "kommt aus") dem naechsten 8-Punkte-Sektor zu. */
export function windSektorAusGrad(deg: number): Sektor {
  const normalisiert = ((deg % 360) + 360) % 360;
  const index = Math.round(normalisiert / 45) % SEKTOREN.length;
  return SEKTOREN[index];
}

/**
 * Parst 'N,NO,O' zu ["N","NO","O"], robust gegen Whitespace/Kleinschreibung.
 * Unbekannte Tokens werden verworfen statt zu crashen (kuratierte Freitext-
 * Herkunft, kein Schema-Zwang auf der DB-Spalte).
 */
export function parseWindschutzSektoren(raw: string | null | undefined): Sektor[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter((token): token is Sektor => (SEKTOREN as string[]).includes(token));
}

/**
 * Ordnet einen Abendwind einer Bucht zu: 'geschuetzt' wenn der Wind aus einem
 * der Windschutz-Sektoren kommt, 'exponiert' wenn nicht, 'unbekannt' ohne
 * (auswertbare) Windschutz-Angabe.
 */
export function beurteileWindschutz(
  poi: Pick<RevierPoi, "windschutz_sektoren">,
  windFromDeg: number,
): SchutzKategorie {
  // Sicherheits-Asymmetrie: ein kaputter/fehlender Wetterwert (NaN/Infinity)
  // darf nie als "exponiert" (vermeintlich verlaessliches Negativ-Signal)
  // erscheinen, sondern bleibt explizit 'unbekannt'.
  if (!Number.isFinite(windFromDeg)) return "unbekannt";
  const geschuetzteSektoren = parseWindschutzSektoren(poi.windschutz_sektoren);
  if (geschuetzteSektoren.length === 0) return "unbekannt";
  return geschuetzteSektoren.includes(windSektorAusGrad(windFromDeg)) ? "geschuetzt" : "exponiert";
}

/**
 * Rankt Übernachtungs-Buchten (typ='bucht') nach dem vorhergesagten Abendwind
 * an ihrer Position: geschützte Buchten zuerst, dann Buchten ohne Windschutz-
 * Info, dann exponierte. Innerhalb einer Kategorie bleibt die Eingabe-
 * reihenfolge erhalten (stabile Sortierung).
 */
export function rankeBuchtenNachAbendwind(params: {
  buchten: RevierPoi[];
  sampleForecast: SampleForecast;
  abendZeitpunkt: Date;
}): BuchtWindRanking[] {
  const { buchten, sampleForecast, abendZeitpunkt } = params;

  const bewertet = buchten
    .filter((poi) => poi.typ === "bucht")
    .map((poi): BuchtWindRanking => {
      const sample = sampleForecast({ lat: poi.lat, lon: poi.lon, at: abendZeitpunkt });
      const windSektor = windSektorAusGrad(sample.wind_from_deg);
      return {
        poi,
        windFromDeg: sample.wind_from_deg,
        windSektor,
        schutzKategorie: beurteileWindschutz(poi, sample.wind_from_deg),
      };
    });

  return bewertet.sort((a, b) => KATEGORIE_RANG[a.schutzKategorie] - KATEGORIE_RANG[b.schutzKategorie]);
}
