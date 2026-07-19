// Unit-Tests für die reine Community-Votum-Logik (REQ-EXP-003).
// Lauf: node --import tsx --test src/lib/erlebnis/__tests__/community-votum.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { bewerteVotum, ohneZurueckgestufte, type PoiVotum } from "../community-votum";

test("[REQ-EXP-003] bewerteVotum: 2 Negativ, keine Gegenstimme → zurueckstufen=true", () => {
  const votes: PoiVotum[] = [{ stimmt: false }, { stimmt: false }];
  const result = bewerteVotum(votes);
  assert.equal(result.positiv, 0);
  assert.equal(result.negativ, 2);
  assert.equal(result.zurueckstufen, true);
});

test("[REQ-EXP-003] bewerteVotum: 2 Negativ + 1 Gegenstimme → zurueckstufen=false", () => {
  const votes: PoiVotum[] = [{ stimmt: false }, { stimmt: false }, { stimmt: true }];
  const result = bewerteVotum(votes);
  assert.equal(result.positiv, 1);
  assert.equal(result.negativ, 2);
  assert.equal(result.zurueckstufen, false);
});

test("[REQ-EXP-003] bewerteVotum: 1 Negativ (< 2) → zurueckstufen=false", () => {
  const votes: PoiVotum[] = [{ stimmt: false }];
  const result = bewerteVotum(votes);
  assert.equal(result.positiv, 0);
  assert.equal(result.negativ, 1);
  assert.equal(result.zurueckstufen, false);
});

test("[REQ-EXP-003] bewerteVotum: leere Vota-Liste → positiv=0, negativ=0, zurueckstufen=false", () => {
  const votes: PoiVotum[] = [];
  const result = bewerteVotum(votes);
  assert.equal(result.positiv, 0);
  assert.equal(result.negativ, 0);
  assert.equal(result.zurueckstufen, false);
});

test("[REQ-EXP-003] bewerteVotum: nur positive Vota → zurueckstufen=false", () => {
  const votes: PoiVotum[] = [{ stimmt: true }, { stimmt: true }, { stimmt: true }];
  const result = bewerteVotum(votes);
  assert.equal(result.positiv, 3);
  assert.equal(result.negativ, 0);
  assert.equal(result.zurueckstufen, false);
});

test("[REQ-EXP-003] ohneZurueckgestufte: entfernt nur POIs mit zurueckstufen=true", () => {
  const pois = [{ id: "A" }, { id: "B" }, { id: "C" }];
  const votesByPoiId = new Map<string, PoiVotum[]>([
    ["A", [{ stimmt: false }, { stimmt: false }]], // zurueckstufen=true
    ["B", [{ stimmt: false }]], // zurueckstufen=false (< 2)
    ["C", []], // leere Vota → bleibt
  ]);

  const result = ohneZurueckgestufte(pois, votesByPoiId);

  assert.equal(result.length, 2);
  assert.ok(result.find((p) => p.id === "B"));
  assert.ok(result.find((p) => p.id === "C"));
  assert.equal(result.find((p) => p.id === "A"), undefined);
});

test("[REQ-EXP-003] ohneZurueckgestufte: POI ohne Vota bleibt in der Liste", () => {
  const pois = [{ id: "X" }, { id: "Y" }];
  const votesByPoiId = new Map<string, PoiVotum[]>();

  const result = ohneZurueckgestufte(pois, votesByPoiId);

  assert.equal(result.length, 2);
  assert.deepEqual(result, pois);
});

test("[REQ-EXP-003] ohneZurueckgestufte: leere POI-Liste → leeres Ergebnis", () => {
  const pois: Array<{ id: string }> = [];
  const votesByPoiId = new Map<string, PoiVotum[]>();

  const result = ohneZurueckgestufte(pois, votesByPoiId);

  assert.equal(result.length, 0);
});

test("[REQ-EXP-003] bewerteVotum: Edge-Case 2 Negativ + 2 Positiv → zurueckstufen=false", () => {
  const votes: PoiVotum[] = [
    { stimmt: false },
    { stimmt: false },
    { stimmt: true },
    { stimmt: true },
  ];
  const result = bewerteVotum(votes);
  assert.equal(result.positiv, 2);
  assert.equal(result.negativ, 2);
  assert.equal(result.zurueckstufen, false); // positiv > 0 → keine Zurückstufung
});

test("[REQ-EXP-003] bewerteVotum: Edge-Case 3 Negativ, keine Gegenstimme → zurueckstufen=true", () => {
  const votes: PoiVotum[] = [{ stimmt: false }, { stimmt: false }, { stimmt: false }];
  const result = bewerteVotum(votes);
  assert.equal(result.positiv, 0);
  assert.equal(result.negativ, 3);
  assert.equal(result.zurueckstufen, true);
});

test("[REQ-EXP-003] ohneZurueckgestufte: komplex — Mix aus zurück, gerettet, keine Vota", () => {
  const pois = [
    { id: "poi1", name: "Trotz Votes erhalten" },
    { id: "poi2", name: "Zurückgestuft" },
    { id: "poi3", name: "Keine Votes" },
    { id: "poi4", name: "Positiv bewertet" },
  ];
  const votesByPoiId = new Map<string, PoiVotum[]>([
    ["poi1", [{ stimmt: false }, { stimmt: false }, { stimmt: true }]], // gerettet
    ["poi2", [{ stimmt: false }, { stimmt: false }]], // zurückgestuft
    // poi3 nicht in der Map → bleibt
    ["poi4", [{ stimmt: true }, { stimmt: true }]], // positiv
  ]);

  const result = ohneZurueckgestufte(pois, votesByPoiId);

  assert.equal(result.length, 3);
  assert.ok(result.find((p) => p.id === "poi1"));
  assert.ok(result.find((p) => p.id === "poi3"));
  assert.ok(result.find((p) => p.id === "poi4"));
  assert.equal(result.find((p) => p.id === "poi2"), undefined);
});
