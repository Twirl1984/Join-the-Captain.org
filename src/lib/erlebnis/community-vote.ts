// Community-Bewertung „stimmt noch?" (REQ-EXP-003) — reine Auswertungslogik.
//
// Ab AUTO_ZURUECKSTUFUNG_SCHWELLE „stimmt nicht mehr"-Meldungen IN FOLGE, ohne
// eine dazwischenliegende „stimmt noch"-Gegenstimme, wird ein Eintrag auf
// status='pruefen' zurueckgestuft (docs/erlebnis-system.md Lebenszyklus,
// .claude/skills/erlebnis-wissen/SKILL.md: "Community schlägt Kurator"). Reine
// Funktion (I/O-frei) nach dem Muster aus kuration.ts — DB-Anbindung (Trigger
// nach INSERT auf poi_vote, UPDATE revier_poi) folgt im lokalen Schritt.

import type { PoiVote } from "../types";

export const AUTO_ZURUECKSTUFUNG_SCHWELLE = 2;

export type CommunityVoteAktion =
  | { typ: "auf_pruefen"; grund: "negativ_ohne_gegenstimme"; negativStreak: number }
  | { typ: "keine_aenderung" };

type VoteInput = Pick<PoiVote, "stimmt" | "created_at">;

/**
 * Sortiert Votes chronologisch nach created_at (aufsteigend), ohne die
 * Eingabe zu mutieren. Nicht parsebare Zeitstempel gelten als aeltest (fallen
 * damit zuerst in die Auswertung) statt die Sortierung zum Absturz zu
 * bringen — Sicherheits-Asymmetrie: lieber zu frueh in die Serie zaehlen als
 * eine echte Negativ-Serie durch kaputte Daten verschlucken.
 */
function chronologisch(votes: VoteInput[]): VoteInput[] {
  return [...votes].sort((a, b) => {
    const ta = Date.parse(a.created_at);
    const tb = Date.parse(b.created_at);
    const naNa = Number.isNaN(ta);
    const naNb = Number.isNaN(tb);
    if (naNa && naNb) return 0;
    if (naNa) return -1;
    if (naNb) return 1;
    return ta - tb;
  });
}

/**
 * Laenge der aktuellen Negativ-Serie seit der letzten Gegenstimme. Eine
 * „stimmt noch"-Meldung setzt die Serie auf 0 zurueck, auch wenn sie zeitlich
 * NACH einer bereits erreichten Zweier-Serie kommt (Gegenstimme entschaerft).
 */
export function negativStreakSeitGegenstimme(votes: VoteInput[]): number {
  let streak = 0;
  for (const v of chronologisch(votes)) {
    streak = v.stimmt ? 0 : streak + 1;
  }
  return streak;
}

/**
 * Entscheidung fuer einen POI anhand seiner Votes: ab `schwelle`
 * aufeinanderfolgenden Negativ-Meldungen ohne Gegenstimme -> 'pruefen'.
 */
export function entscheideCommunityVote(
  votes: VoteInput[],
  schwelle: number = AUTO_ZURUECKSTUFUNG_SCHWELLE,
): CommunityVoteAktion {
  const streak = negativStreakSeitGegenstimme(votes);
  if (streak >= schwelle) {
    return { typ: "auf_pruefen", grund: "negativ_ohne_gegenstimme", negativStreak: streak };
  }
  return { typ: "keine_aenderung" };
}
