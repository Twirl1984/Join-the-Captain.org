// Community-Votum: Bewertung „stimmt noch?" pro Eintrag (REQ-EXP-003).
//
// Kurations-Prinzip Append-and-Review: Nutzer stimmen je POI ab — „stimmt noch
// (aktuell)" oder „stimmt nicht mehr". Reine Auswertungslogik ist bewusst I/O-frei
// gehalten, damit offline-testbar bleibt (CLAUDE.md-Konvention wie lib/weather,
// lib/navigation). Die Zurückstufungs-Regel: ab 2 Negativ-Meldungen OHNE
// Gegenstimme wird der Eintrag zurückgestuft (Signal für den Kurator).

import { query } from "../db";

/**
 * Minimal: eine Votum-Stimme (Abstimmung pro Nutzer/Session).
 * `stimmt=true`: „Eintrag ist noch aktuell" (korrekt).
 * `stimmt=false`: „Eintrag ist nicht mehr aktuell" (veraltet).
 */
export interface PoiVotum {
  stimmt: boolean;
}

/**
 * Bewertet eine Menge von Vota und entscheidet über Zurückstufung.
 *
 * Regeln:
 * - positiv: Anzahl der `stimmt: true`-Vota.
 * - negativ: Anzahl der `stimmt: false`-Vota.
 * - zurueckstufen: true iff negativ >= 2 UND positiv === 0
 *   (ab 2 Negativ OHNE Gegenstimme → Eintrag prüfungsbedürftig).
 *
 * Reine Funktion, kein DB-Zugriff.
 */
export function bewerteVotum(votes: PoiVotum[]): {
  positiv: number;
  negativ: number;
  zurueckstufen: boolean;
} {
  let positiv = 0;
  let negativ = 0;

  for (const vote of votes) {
    if (vote.stimmt) {
      positiv++;
    } else {
      negativ++;
    }
  }

  const zurueckstufen = negativ >= 2 && positiv === 0;

  return { positiv, negativ, zurueckstufen };
}

/**
 * Filtert eine POI-Liste und entfernt alle POIs, deren Votum zurückgestuft
 * werden soll. POIs ohne Vota (nicht in der Map) bleiben drin.
 *
 * Reine Funktion, kein DB-Zugriff.
 */
export function ohneZurueckgestufte<T extends { id: string }>(
  pois: T[],
  votesByPoiId: Map<string, PoiVotum[]>,
): T[] {
  return pois.filter((poi) => {
    const vota = votesByPoiId.get(poi.id);
    if (!vota || vota.length === 0) {
      // Keine Vota → POI bleibt.
      return true;
    }
    const { zurueckstufen } = bewerteVotum(vota);
    // Nur zurückgeben, wenn NICHT zurückgestuft.
    return !zurueckstufen;
  });
}

/**
 * Dünne Query: liest alle Vota für eine Menge POI-IDs (nur stimmt-Flag,
 * minimal). Rückgabe: Map<poi_id, PoiVotum[]>, gruppiert nach POI.
 *
 * Nur die Spalte `stimmt` wird abgerufen (nicht kommentar, created_at, etc.).
 * Kommentare sind für spätere Features reserviert (z. B. Kurator-Dashboard).
 */
export async function votesFuerPois(poiIds: string[]): Promise<Map<string, PoiVotum[]>> {
  if (poiIds.length === 0) {
    return new Map();
  }

  // Platzhalter-Array für die SQL-Abfrage: $1, $2, ..., $N.
  const placeholders = poiIds.map((_, i) => `$${i + 1}`).join(",");

  const rows = await query<{ poi_id: string; stimmt: boolean }>(
    `SELECT poi_id, stimmt FROM poi_vote WHERE poi_id = ANY(ARRAY[${placeholders}])`,
    poiIds,
  );

  const result = new Map<string, PoiVotum[]>();
  for (const row of rows) {
    if (!result.has(row.poi_id)) {
      result.set(row.poi_id, []);
    }
    result.get(row.poi_id)!.push({ stimmt: row.stimmt });
  }

  return result;
}
