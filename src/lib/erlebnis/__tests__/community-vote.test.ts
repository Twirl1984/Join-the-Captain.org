// Unit-Tests für die Community-Bewertungs-Auswertung (REQ-EXP-003).
// Lauf: node --import tsx --test src/lib/erlebnis/__tests__/community-vote.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  negativStreakSeitGegenstimme,
  entscheideCommunityVote,
  AUTO_ZURUECKSTUFUNG_SCHWELLE,
} from "../community-vote";

function vote(stimmt: boolean, created_at: string) {
  return { stimmt, created_at };
}

test("[REQ-EXP-003] ohne Votes: keine Aenderung", () => {
  assert.deepEqual(entscheideCommunityVote([]), { typ: "keine_aenderung" });
});

test("[REQ-EXP-003] eine einzelne Negativ-Meldung reicht nicht (Schwelle 2)", () => {
  const votes = [vote(false, "2026-07-15T10:00:00Z")];
  assert.equal(negativStreakSeitGegenstimme(votes), 1);
  assert.deepEqual(entscheideCommunityVote(votes), { typ: "keine_aenderung" });
});

test("[REQ-EXP-003] zwei Negativ-Meldungen in Folge -> auf pruefen", () => {
  const votes = [vote(false, "2026-07-15T10:00:00Z"), vote(false, "2026-07-16T09:00:00Z")];
  assert.equal(negativStreakSeitGegenstimme(votes), 2);
  assert.deepEqual(entscheideCommunityVote(votes), {
    typ: "auf_pruefen",
    grund: "negativ_ohne_gegenstimme",
    negativStreak: 2,
  });
});

test("[REQ-EXP-003] eine Gegenstimme zwischen den Negativ-Meldungen setzt die Serie zurueck", () => {
  const votes = [
    vote(false, "2026-07-10T10:00:00Z"),
    vote(true, "2026-07-12T10:00:00Z"),
    vote(false, "2026-07-15T10:00:00Z"),
  ];
  assert.equal(negativStreakSeitGegenstimme(votes), 1);
  assert.deepEqual(entscheideCommunityVote(votes), { typ: "keine_aenderung" });
});

test("[REQ-EXP-003] eine spaete Gegenstimme entschaerft auch eine bereits erreichte Zweier-Serie", () => {
  const votes = [
    vote(false, "2026-07-10T10:00:00Z"),
    vote(false, "2026-07-11T10:00:00Z"),
    vote(true, "2026-07-15T10:00:00Z"),
  ];
  assert.deepEqual(entscheideCommunityVote(votes), { typ: "keine_aenderung" });
});

test("[REQ-EXP-003] Eingabereihenfolge ist irrelevant, es zaehlt chronologisch nach created_at", () => {
  const chronologisch = [vote(false, "2026-07-10T10:00:00Z"), vote(false, "2026-07-11T10:00:00Z")];
  const vertauscht = [chronologisch[1], chronologisch[0]];
  assert.deepEqual(entscheideCommunityVote(vertauscht), entscheideCommunityVote(chronologisch));
  assert.deepEqual(entscheideCommunityVote(vertauscht), {
    typ: "auf_pruefen",
    grund: "negativ_ohne_gegenstimme",
    negativStreak: 2,
  });
});

test("[REQ-EXP-003] mehr als die Schwelle: negativStreak wird ehrlich weitergezaehlt, nicht gedeckelt", () => {
  const votes = [
    vote(false, "2026-07-10T10:00:00Z"),
    vote(false, "2026-07-11T10:00:00Z"),
    vote(false, "2026-07-12T10:00:00Z"),
  ];
  assert.deepEqual(entscheideCommunityVote(votes), {
    typ: "auf_pruefen",
    grund: "negativ_ohne_gegenstimme",
    negativStreak: 3,
  });
});

test("[REQ-EXP-003] konfigurierbare Schwelle: 3 ist bei zwei Negativen noch keine Zurueckstufung", () => {
  const votes = [vote(false, "2026-07-10T10:00:00Z"), vote(false, "2026-07-11T10:00:00Z")];
  assert.deepEqual(entscheideCommunityVote(votes, 3), { typ: "keine_aenderung" });
  assert.equal(AUTO_ZURUECKSTUFUNG_SCHWELLE, 2);
});

test("[QA] leere kommentare/kommentar=null beeinflussen die Entscheidung nicht", () => {
  const votes = [
    { stimmt: false, created_at: "2026-07-10T10:00:00Z", kommentar: null },
    { stimmt: false, created_at: "2026-07-11T10:00:00Z", kommentar: "riecht komisch" },
  ];
  assert.deepEqual(entscheideCommunityVote(votes), {
    typ: "auf_pruefen",
    grund: "negativ_ohne_gegenstimme",
    negativStreak: 2,
  });
});

test("[QA] kaputte/nicht parsebare created_at-Zeitstempel crashen nicht und gelten als aeltest", () => {
  const votes = [vote(false, "kaputtes-datum"), vote(true, "2026-07-11T10:00:00Z"), vote(false, "2026-07-12T10:00:00Z")];
  // kaputtes Datum sortiert vor der Gegenstimme -> Serie danach: negativ, dann reset durch true, dann negativ
  assert.doesNotThrow(() => entscheideCommunityVote(votes));
  assert.deepEqual(entscheideCommunityVote(votes), { typ: "keine_aenderung" });
});

test("[QA] zwei kaputte Zeitstempel ohne Gegenstimme werden trotzdem als Negativ-Serie erkannt", () => {
  const votes = [vote(false, "nicht-parsebar-1"), vote(false, "nicht-parsebar-2")];
  assert.deepEqual(entscheideCommunityVote(votes), {
    typ: "auf_pruefen",
    grund: "negativ_ohne_gegenstimme",
    negativStreak: 2,
  });
});

test("[QA] identische Zeitstempel (Tie): sortiert stabil nach Eingabereihenfolge", () => {
  const gleicherZeitpunkt = "2026-07-15T10:00:00Z";
  const negativZuerst = [vote(false, gleicherZeitpunkt), vote(true, gleicherZeitpunkt)];
  assert.deepEqual(entscheideCommunityVote(negativZuerst), { typ: "keine_aenderung" });

  const positivZuerst = [vote(true, gleicherZeitpunkt), vote(false, gleicherZeitpunkt)];
  assert.deepEqual(entscheideCommunityVote(positivZuerst), { typ: "keine_aenderung" });
});

test("[QA] negativStreakSeitGegenstimme mutiert das uebergebene Array nicht", () => {
  const votes = [vote(false, "2026-07-15T10:00:00Z"), vote(false, "2026-07-10T10:00:00Z")];
  const kopie = votes.map((v) => ({ ...v }));
  negativStreakSeitGegenstimme(votes);
  assert.deepEqual(votes, kopie);
});

test("[QA] Schwelle 0: bereits ohne jede Negativ-Meldung greift die Zurueckstufung (Grenzfall, bewusst zulaessig)", () => {
  assert.deepEqual(entscheideCommunityVote([], 0), {
    typ: "auf_pruefen",
    grund: "negativ_ohne_gegenstimme",
    negativStreak: 0,
  });
});
