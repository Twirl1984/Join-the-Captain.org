// POI-Wissensbasis (REQ-EXP-001) — Zugriff auf revier_poi/poi_vote.
//
// Kurations-Prinzip Append-and-Review (.claude/skills/erlebnis-wissen/SKILL.md):
// neue Funde landen in status='entwurf', nur 'live' wird ausgeliefert. Reine
// Filterlogik (Saison/Gültigkeit) ist bewusst I/O-frei gehalten, damit sie
// offline testbar bleibt (CLAUDE.md-Konvention wie lib/weather, lib/navigation).

import { query } from "../db";
import { haversineNm, type Waypoint } from "../weather/route-forecast";
import type { RevierPoi, PoiStatus } from "../types";

export interface PoiListFilter {
  revierId?: string;
  bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  status?: RevierPoi["status"];
  /** Kalendermonat 1-12, für Saison-/Gültigkeitsfilter (Standard: kein Filter). */
  monat?: number;
  /** Stichdatum (ISO) für konkrete Event-Gültigkeit (Standard: kein Filter). */
  datum?: string;
}

/**
 * Prüft, ob ein POI zu einem gegebenen Monat/Datum passt. Reine Funktion,
 * kein DB-Zugriff — Basis für REQ-EXP-004 (Erlebnisse entlang der Route).
 *
 * Regeln:
 * - Kein saison_von/saison_bis UND kein gueltig_von/gueltig_bis → immer gültig.
 * - saison_von/saison_bis: Monatsbereich, wrap-around über Jahreswechsel
 *   erlaubt (z. B. 11 → 2 für "November bis Februar").
 * - gueltig_von/gueltig_bis: konkretes Datumsfenster (Events); beide Grenzen
 *   inklusiv. Nur gesetzt, wenn eine Primärquelle das Datum bestätigt.
 */
export function poiIstGueltig(
  poi: Pick<RevierPoi, "saison_von" | "saison_bis" | "gueltig_von" | "gueltig_bis">,
  { monat, datum }: { monat?: number; datum?: string } = {},
): boolean {
  if (poi.gueltig_von || poi.gueltig_bis) {
    if (!datum) return true; // kein Stichdatum angefragt → nicht ausschließen
    const d = datum;
    if (poi.gueltig_von && d < poi.gueltig_von) return false;
    if (poi.gueltig_bis && d > poi.gueltig_bis) return false;
  }

  // Asymmetrische Saison-Filter sind ungültig: BUG-QA-003, BUG-QA-004
  const hasSaisonVon = poi.saison_von != null;
  const hasSaisonBis = poi.saison_bis != null;
  if (hasSaisonVon !== hasSaisonBis) {
    // Nur einer gesetzt → asymmetrisch → ungültig
    return false;
  }

  if (poi.saison_von != null && poi.saison_bis != null) {
    if (!monat) return true; // kein Monat angefragt → nicht ausschließen
    const { saison_von: von, saison_bis: bis } = poi;
    if (von <= bis) {
      if (monat < von || monat > bis) return false;
    } else {
      // Wrap-around (z. B. 11..2)
      if (monat < von && monat > bis) return false;
    }
  }

  return true;
}

/** Bbox-Treffer für Korridor-/Kartenausschnitt-Abfragen (reine Funktion). */
export function poiInBbox(
  poi: Pick<RevierPoi, "lat" | "lon">,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
): boolean {
  return (
    poi.lat >= bbox.minLat &&
    poi.lat <= bbox.maxLat &&
    poi.lon >= bbox.minLon &&
    poi.lon <= bbox.maxLon
  );
}

/**
 * Korridor-Filter für REQ-EXP-004: kürzeste Distanz des POI zu irgendeinem
 * Punkt der Route (Vertex-Näherung, kein exaktes Punkt-zu-Segment-Lot — bei
 * der üblichen Wegpunkt-Dichte der bestehenden Routen ausreichend genau,
 * kein zweiter Routing-Stack). Nutzt die geteilte haversineNm-Basis
 * (CLAUDE.md: /wetter UND /navigation teilen sich lib/weather).
 */
export function poiImKorridor(
  poi: Pick<RevierPoi, "lat" | "lon">,
  routenPunkte: Waypoint[],
  korridorNm: number,
): boolean {
  if (routenPunkte.length === 0) return false;
  if (korridorNm <= 0) return false; // BUG-046: Korridor deaktiviert bei ≤ 0
  const poiPunkt: Waypoint = { lat: poi.lat, lon: poi.lon };
  return routenPunkte.some((p) => haversineNm(poiPunkt, p) <= korridorNm);
}

/** Grob-Bbox um die Route (+ Rand für den Korridor) für den SQL-Vorfilter. */
export function bboxUmRoute(routenPunkte: Waypoint[], korridorNm: number) {
  // BUG-057: Validiere korridorNm > 0
  if (korridorNm <= 0) {
    throw new Error(`Korridor muss > 0 sein, erhalten: ${korridorNm}`);
  }

  const randGrad = korridorNm / 60; // 1° Breite ≈ 60 sm; grobe, konservative Näherung
  const lats = routenPunkte.map((p) => p.lat);
  const lons = routenPunkte.map((p) => p.lon);

  // BUG-058: Prüfe auf NaN-Koordinaten
  if (lats.some((lat) => !Number.isFinite(lat)) || lons.some((lon) => !Number.isFinite(lon))) {
    throw new Error("Route enthält ungültige Koordinaten (NaN oder Infinity)");
  }

  // BUG-053, BUG-054: Leere Route → Infinity/NaN, sonst clamp auf gültige Grenzen
  const isEmpty = lats.length === 0;
  const clampLat = (v: number) => (isEmpty ? v : Math.max(-90, Math.min(90, v)));
  const clampLon = (v: number) => (isEmpty ? v : Math.max(-180, Math.min(180, v)));

  return {
    minLat: clampLat(Math.min(...lats) - randGrad),
    maxLat: clampLat(Math.max(...lats) + randGrad),
    minLon: clampLon(Math.min(...lons) - randGrad),
    maxLon: clampLon(Math.max(...lons) + randGrad),
  };
}

/** Live-POIs im Korridor um eine Route, optional nach Saison/Datum gefiltert. */
export async function listPoisAmKorridor(params: {
  routenPunkte: Waypoint[];
  korridorNm: number;
  revierId?: string;
  monat?: number;
  datum?: string;
}): Promise<RevierPoi[]> {
  const { routenPunkte, korridorNm, revierId, monat, datum } = params;
  if (routenPunkte.length === 0) return [];

  const bbox = bboxUmRoute(routenPunkte, korridorNm);
  const kandidaten = await listRevierPois({ revierId, bbox, status: "live" });
  const imKorridor = kandidaten.filter((poi) => poiImKorridor(poi, routenPunkte, korridorNm));

  if (monat == null && datum == null) return imKorridor;
  return imKorridor.filter((poi) => poiIstGueltig(poi, { monat, datum }));
}

/** Mindestens eine Quelle mit URL + Abrufdatum — Guardrail aus dem Skill. */
export function poiHatPflichtquellen(poi: Pick<RevierPoi, "quellen_json">): boolean {
  return (
    Array.isArray(poi.quellen_json) &&
    poi.quellen_json.length > 0 &&
    poi.quellen_json.every((q) => Boolean(q.url) && Boolean(q.abgerufen_am))
  );
}

function buildWhere(filter: PoiListFilter): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  conditions.push(`status = $${params.push(filter.status ?? "live")}`);

  if (filter.revierId) {
    conditions.push(`revier_id = $${params.push(filter.revierId)}`);
  }
  if (filter.bbox) {
    conditions.push(`lat BETWEEN $${params.push(filter.bbox.minLat)} AND $${params.push(filter.bbox.maxLat)}`);
    conditions.push(`lon BETWEEN $${params.push(filter.bbox.minLon)} AND $${params.push(filter.bbox.maxLon)}`);
  }

  return { clause: conditions.join(" AND "), params };
}

/**
 * Listet POIs nach Revier und/oder Bbox, Default status='live'. Saison-/
 * Gültigkeitsfilter läuft danach in-memory über poiIstGueltig (kein SQL-
 * Datumsbereich nötig, hält die Query einfach).
 */
export async function listRevierPois(filter: PoiListFilter): Promise<RevierPoi[]> {
  const { clause, params } = buildWhere(filter);
  const rows = await query<RevierPoi>(
    `SELECT * FROM revier_poi WHERE ${clause} ORDER BY name ASC`,
    params,
  );

  if (filter.monat == null && filter.datum == null) return rows;
  return rows.filter((poi) => poiIstGueltig(poi, { monat: filter.monat, datum: filter.datum }));
}

/** Review-fällige live-POIs, älteste zuerst (NULL = nie reviewed → zuerst). */
export async function listReviewFaelligePois(): Promise<RevierPoi[]> {
  return query<RevierPoi>(
    `SELECT * FROM revier_poi WHERE status = 'live' ORDER BY reviewed_am ASC NULLS FIRST`,
  );
}

/** Entwürfe, die auf ihre erste Kuration warten (Append-and-Review Inbox). */
export async function listEntwuerfe(): Promise<RevierPoi[]> {
  return query<RevierPoi>(
    `SELECT * FROM revier_poi WHERE status = 'entwurf' ORDER BY created_at ASC`,
  );
}

export async function setPoiStatus(id: string, status: PoiStatus): Promise<void> {
  await query(`UPDATE revier_poi SET status = $1 WHERE id = $2`, [status, id]);
}

export async function markPoiReviewed(id: string): Promise<void> {
  await query(`UPDATE revier_poi SET reviewed_am = now() WHERE id = $1`, [id]);
}
