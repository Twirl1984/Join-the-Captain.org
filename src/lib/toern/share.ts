// Teilbarer Törn-Link (REQ-EXP-009) — read-only Route + Highlights per Kurz-ID.
//
// Route + Plan werden auf das Nötigste gekürzt (keine Legs-Details, keine
// personenbezogenen Daten) — der Link ist ein Anreiz-Teaser ("Wir ankern in
// dieser Bucht!"), kein Planungswerkzeug. Reine Formfunktionen sind I/O-frei
// und testbar; DB-Zugriff separat (CLAUDE.md-Konvention).

import { query, queryOne } from "../db";
import type { Waypoint, RoutePlan } from "../weather/route-forecast";

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LAENGE = 8;

/** Validiert, dass eine ID exakt 8 Zeichen aus dem base36-Alphabet ist [BUG-056]. */
export function validateToernShareId(id: string): void {
  if (id.length !== ID_LAENGE) {
    throw new Error(`Kurz-ID muss genau ${ID_LAENGE} Zeichen lang sein, erhalten: ${id.length}`);
  }
  if (!id.match(/^[a-z0-9]{8}$/)) {
    throw new Error(`Kurz-ID muss nur a-z und 0-9 enthalten (base36), erhalten: ${id}`);
  }
}

export interface ToernShareHighlight {
  name: string;
  lat: number;
  lon: number;
  typ: string;
}

export interface ToernSharePunkt {
  lat: number;
  lon: number;
  name?: string | null;
}

export interface ToernSharePlan {
  total_nm: number;
  eta: string;
  warnings: string[];
}

export interface ToernShareSnapshot {
  id: string;
  revier_id: string;
  punkte_json: ToernSharePunkt[];
  plan_json: ToernSharePlan | null;
  highlights_json: ToernShareHighlight[] | null;
  created_at: string;
}

/** Kurz-ID (8 Zeichen, base36-Alphabet) — injizierbarer Zufall für Tests. */
export function generateShareId(zufall: () => number = Math.random): string {
  let id = "";
  for (let i = 0; i < ID_LAENGE; i++) {
    id += ID_ALPHABET[Math.floor(zufall() * ID_ALPHABET.length)];
  }
  return id;
}

// Limits für DoS-Prävention (REQ-EXP-009 Sicherheit)
const MAX_NAME_LENGTH = 500; // Zeichen pro Punkt-Name/Highlight-Name
const MAX_HIGHLIGHTS = 1000; // Maximale Anzahl Highlights pro Snapshot

/** Kurzt einen Namen auf MAX_NAME_LENGTH. */
function truncateName(name: string | null | undefined): string | null {
  if (!name || typeof name !== "string") return null;
  return name.length > MAX_NAME_LENGTH ? name.substring(0, MAX_NAME_LENGTH) : name;
}

/** Formt die vollständige Route/Plan auf den Teaser-Umfang herunter (reine Funktion). */
export function buildShareSnapshot(params: {
  revierId: string;
  punkte: Waypoint[];
  plan: Pick<RoutePlan, "total_nm" | "eta" | "warnings">;
  highlights?: ToernShareHighlight[];
  maxPunkte?: number;
}): Pick<ToernShareSnapshot, "revier_id" | "punkte_json" | "plan_json" | "highlights_json"> {
  const { revierId, punkte, plan, highlights, maxPunkte = 60 } = params;
  const punkteGekuerzt =
    punkte.length <= maxPunkte
      ? punkte
      : thinPunkte(punkte, maxPunkte);

  // Kürze Highlights: Limit auf MAX_HIGHLIGHTS, Namenstruncation
  let highlightsGekuerzt: ToernShareHighlight[] | null = null;
  if (highlights && highlights.length > 0) {
    const sliced = highlights.slice(0, MAX_HIGHLIGHTS);
    highlightsGekuerzt = sliced.map((h) => ({
      name: truncateName(h.name) ?? "",
      lat: h.lat,
      lon: h.lon,
      typ: h.typ,
    }));
  }

  return {
    revier_id: revierId,
    punkte_json: punkteGekuerzt.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      name: truncateName(p.name),
    })),
    plan_json: { total_nm: plan.total_nm, eta: plan.eta, warnings: plan.warnings },
    highlights_json: highlightsGekuerzt && highlightsGekuerzt.length > 0 ? highlightsGekuerzt : null,
  };
}

function thinPunkte<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  if (max <= 0) return [];
  if (max === 1) return [arr[0]];
  const out: T[] = [arr[0]];
  for (let k = 1; k < max - 1; k++) {
    out.push(arr[Math.round((k * (arr.length - 1)) / (max - 1))]);
  }
  out.push(arr[arr.length - 1]);
  return out;
}

/** Legt einen neuen Törn-Share an; erzeugt bei Kollision eine neue ID (selten, 36^8 Raum). */
export async function createToernShare(
  snapshot: Pick<ToernShareSnapshot, "revier_id" | "punkte_json" | "plan_json" | "highlights_json">,
): Promise<string> {
  for (let versuch = 0; versuch < 5; versuch++) {
    const id = generateShareId();
    validateToernShareId(id); // BUG-056: Validiere die ID vor Insert
    const bestehend = await queryOne(`SELECT id FROM geteilter_toern WHERE id = $1`, [id]);
    if (bestehend) continue;
    await query(
      `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, highlights_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, snapshot.revier_id, JSON.stringify(snapshot.punkte_json), JSON.stringify(snapshot.plan_json), JSON.stringify(snapshot.highlights_json)],
    );
    return id;
  }
  throw new Error("Konnte keine freie Kurz-ID erzeugen.");
}

export async function getToernShare(id: string): Promise<ToernShareSnapshot | null> {
  return queryOne<ToernShareSnapshot>(`SELECT * FROM geteilter_toern WHERE id = $1`, [id]);
}
