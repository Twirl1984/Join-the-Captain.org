// Kurations-Routine (REQ-EXP-002) — Append-and-Review-Entscheidungen.
//
// Reine Entscheidungslogik (I/O-frei, testbar); DB-Zugriff + der eigentliche
// HTTP-Erreichbarkeits-Check leben in scripts/erlebnis-kuration.ts. Folgt dem
// Guardrail-Muster aus .claude/skills/erlebnis-wissen/SKILL.md:
// - Review-Zyklus: älteste zuerst, kein Eintrag > 6 Monate ungereviewt.
// - Events: gueltig_bis überschritten → archiviert.
// - Auto-Publish (entwurf → live) nur bei Confidence ≥ Schwelle UND
//   erreichbarem Quell-Link.

import type { RevierPoi } from "../types";

export const REVIEW_INTERVAL_MONATE = 6;
export const AUTO_PUBLISH_CONFIDENCE_SCHWELLE = 0.7;

function monateSpaeter(datumIso: string, monate: number): Date {
  const d = new Date(datumIso);
  d.setUTCMonth(d.getUTCMonth() + monate);
  return d;
}

/** Ältester-zuerst-Review-Fälligkeit: nie reviewed ODER älter als 6 Monate. */
export function istReviewFaellig(
  poi: Pick<RevierPoi, "reviewed_am">,
  jetzt: Date,
): boolean {
  if (!poi.reviewed_am) return true;
  return monateSpaeter(poi.reviewed_am, REVIEW_INTERVAL_MONATE) <= jetzt;
}

/** Events mit überschrittenem gueltig_bis werden automatisch archiviert. */
export function istEventAbgelaufen(
  poi: Pick<RevierPoi, "gueltig_bis">,
  jetzt: Date,
): boolean {
  if (!poi.gueltig_bis) return false;
  return new Date(poi.gueltig_bis) < jetzt;
}

export type ReviewAktion =
  | { typ: "archivieren"; grund: "event_abgelaufen" | "quelle_nicht_erreichbar" }
  | { typ: "pruefen"; grund: "quelle_nicht_erreichbar" }
  | { typ: "reviewed_aktualisieren" };

/**
 * Entscheidung für einen review-fälligen live-POI. Events mit abgelaufener
 * Gültigkeit werden direkt archiviert (Lebenszyklus). Sonst: nicht mehr
 * erreichbare Quelle → 'prüfen' (Mensch entscheidet), sonst reviewed_am
 * auffrischen.
 */
export function entscheideReview(
  poi: Pick<RevierPoi, "typ" | "gueltig_bis">,
  jetzt: Date,
  quelleErreichbar: boolean,
): ReviewAktion {
  if (istEventAbgelaufen(poi, jetzt)) {
    return { typ: "archivieren", grund: "event_abgelaufen" };
  }
  if (!quelleErreichbar) {
    return { typ: "pruefen", grund: "quelle_nicht_erreichbar" };
  }
  return { typ: "reviewed_aktualisieren" };
}

/** Auto-Publish-Guardrail: Confidence ≥ Schwelle UND Quelle erreichbar. */
export function erfuelltAutoPublishSchwelle(
  poi: Pick<RevierPoi, "confidence">,
  quelleErreichbar: boolean,
  schwelle: number = AUTO_PUBLISH_CONFIDENCE_SCHWELLE,
): boolean {
  return quelleErreichbar && poi.confidence >= schwelle;
}

/** HTTP-Erreichbarkeits-Check (HEAD, Fallback GET) — injizierbarer fetch. */
export async function urlErreichbar(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!/^https?:\/\//.test(url)) return false;
  const versuch = async (method: "HEAD" | "GET"): Promise<boolean> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetchImpl(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "user-agent": "JTC-ErlebnisKuration/1.0" },
      });
      return res.status < 400;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  };
  return (await versuch("HEAD")) || (await versuch("GET"));
}
