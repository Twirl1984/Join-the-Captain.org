// poi.ts — POI-Wissensbasis (REQ-EXP-001): Buchten, Sehenswürdigkeiten, Events
// und Versorgung je Revier. Schema/Lebenszyklus: docs/erlebnis-system.md,
// Kurations-Prinzip: .claude/skills/erlebnis-wissen/SKILL.md.
//
// DB-Zugriff (list*) und reine Prüf-Logik (istAktuellGueltig) sind getrennt,
// damit Letztere ohne Datenbank testbar bleibt (aspice-istqb-workflow SKILL.md).

import { query } from "@/lib/db";
import type { Bbox } from "@/lib/navigation/reviere";

export type PoiTyp =
  | "bucht"
  | "hafen-highlight"
  | "sehenswuerdigkeit"
  | "event"
  | "versorgung";

export type PoiStatus = "entwurf" | "live" | "pruefen" | "archiviert";

export interface PoiQuelle {
  url: string;
  titel: string;
  abgerufen_am: string; // YYYY-MM-DD
}

export interface RevierPoi {
  id: number;
  revier_id: string;
  typ: PoiTyp;
  name: string;
  lat: number;
  lon: number;
  beschreibung: string;
  windschutz_sektoren: string | null;
  saison_von: number | null;
  saison_bis: number | null;
  gueltig_von: string | null;
  gueltig_bis: string | null;
  quellen_json: PoiQuelle[];
  confidence: number;
  score: number | null;
  stand_datum: string;
  status: PoiStatus;
}

/**
 * Prüft, ob ein POI zu einem Referenzdatum aktuell gültig ist: Events müssen
 * innerhalb gueltig_von/gueltig_bis liegen, saisonale Einträge (z. B. Blaue
 * Grotte Mai-Oktober) innerhalb saison_von/saison_bis (Monat, mit Wraparound
 * über den Jahreswechsel, z. B. 11-2 für November bis Februar). Ohne beide
 * Felder gilt der POI ganzjährig als gültig.
 */
export function istAktuellGueltig(
  poi: Pick<RevierPoi, "gueltig_von" | "gueltig_bis" | "saison_von" | "saison_bis">,
  referenzDatum: Date,
): boolean {
  if (poi.gueltig_von && referenzDatum < new Date(poi.gueltig_von)) return false;
  if (poi.gueltig_bis && referenzDatum > new Date(poi.gueltig_bis)) return false;

  if (poi.saison_von != null && poi.saison_bis != null) {
    const monat = referenzDatum.getMonth() + 1;
    if (poi.saison_von <= poi.saison_bis) {
      if (monat < poi.saison_von || monat > poi.saison_bis) return false;
    } else {
      // Wraparound, z. B. saison_von=11, saison_bis=2
      if (monat > poi.saison_bis && monat < poi.saison_von) return false;
    }
  }

  return true;
}

/** Live-POIs eines Reviers, neueste/beste zuerst. */
export async function listPoisByRevier(revierId: string): Promise<RevierPoi[]> {
  return query<RevierPoi>(
    `SELECT id, revier_id, typ, name, lat, lon, beschreibung,
            windschutz_sektoren, saison_von, saison_bis,
            gueltig_von, gueltig_bis, quellen_json, confidence, score,
            stand_datum, status
       FROM revier_poi
      WHERE revier_id = $1 AND status = 'live'
      ORDER BY score DESC NULLS LAST, name ASC`,
    [revierId],
  );
}

/** Live-POIs innerhalb einer bbox [Süd, West, Nord, Ost] (für Korridor-Filter in Etappe 2.3). */
export async function listPoisByBbox(bbox: Bbox): Promise<RevierPoi[]> {
  const [sued, west, nord, ost] = bbox;
  return query<RevierPoi>(
    `SELECT id, revier_id, typ, name, lat, lon, beschreibung,
            windschutz_sektoren, saison_von, saison_bis,
            gueltig_von, gueltig_bis, quellen_json, confidence, score,
            stand_datum, status
       FROM revier_poi
      WHERE status = 'live'
        AND lat BETWEEN $1 AND $2
        AND lon BETWEEN $3 AND $4
      ORDER BY score DESC NULLS LAST, name ASC`,
    [sued, nord, west, ost],
  );
}
