// Unit-Tests für die Bucht-Windschutz-Ranking-Logik (REQ-EXP-005).
// Lauf: node --import tsx --test src/lib/erlebnis/__tests__/bucht-schutz.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { windschutzScore, rankBuchten, WINDSCHUTZ_HINWEIS, type BuchtSektor } from "../bucht-schutz";

test("[REQ-EXP-005] Abnahmefall 1: Bucht 270° offen, Wind AUS 270° → score ≈ 0 (exponiert)", () => {
  const bucht: BuchtSektor = { id: "test-1", name: "Testbucht", oeffnungsrichtung_deg: 270, oeffnungsbreite_deg: 90 };
  const score = windschutzScore(bucht, 270);
  assert.ok(score < 0.1, `Score sollte nahe 0 sein, ist aber ${score}`);
});

test("[REQ-EXP-005] Abnahmefall 2: Bucht 270° offen, Wind AUS 90° → score ≈ 1 (geschützt)", () => {
  const bucht: BuchtSektor = { id: "test-2", name: "Testbucht", oeffnungsrichtung_deg: 270, oeffnungsbreite_deg: 90 };
  const score = windschutzScore(bucht, 90);
  assert.ok(score > 0.9, `Score sollte nahe 1 sein, ist aber ${score}`);
});

test("[REQ-EXP-005] Abnahmefall 3: Ranking — Bucht B 180° geschützt vor Nordwind, Bucht A 0° exponiert", () => {
  const buchtA: BuchtSektor = { id: "a", name: "Nord-Bucht", oeffnungsrichtung_deg: 0, oeffnungsbreite_deg: 90 };
  const buchtB: BuchtSektor = { id: "b", name: "Sued-Bucht", oeffnungsrichtung_deg: 180, oeffnungsbreite_deg: 90 };

  const ranking = rankBuchten([buchtA, buchtB], 0); // Nordwind

  assert.equal(ranking.length, 2, "Ranking sollte 2 Buchten enthalten");
  assert.equal(ranking[0].id, "b", "Bucht B (180°) sollte vorne sein");
  assert.equal(ranking[1].id, "a", "Bucht A (0°) sollte hinten sein");
  assert.ok(ranking[0].score > ranking[1].score, "B sollte höheren Score als A haben");
});

test("[REQ-EXP-005] Abnahmefall 4: Score fällt monoton mit wachsender Winkeldistanz", () => {
  const bucht: BuchtSektor = { id: "test", name: "Test", oeffnungsrichtung_deg: 0, oeffnungsbreite_deg: 90 };

  const score0 = windschutzScore(bucht, 0);    // wind aus der Öffnung
  const score45 = windschutzScore(bucht, 45);  // 45° weg
  const score90 = windschutzScore(bucht, 90);  // 90° weg
  const score135 = windschutzScore(bucht, 135); // 135° weg
  const score180 = windschutzScore(bucht, 180); // 180° weg (gegenrichtung)

  assert.ok(score0 < score45, `score(0) sollte < score(45): ${score0} < ${score45}`);
  assert.ok(score45 < score90, `score(45) sollte < score(90): ${score45} < ${score90}`);
  assert.ok(score90 < score135, `score(90) sollte < score(135): ${score90} < ${score135}`);
  assert.ok(score135 < score180, `score(135) sollte < score(180): ${score135} < ${score180}`);
});

test("[REQ-EXP-005] Winkel-Wraparound: 350° Öffnung + Wind 10° → nur 20° Distanz", () => {
  const bucht: BuchtSektor = { id: "test", name: "Test", oeffnungsrichtung_deg: 350, oeffnungsbreite_deg: 60 };
  const score = windschutzScore(bucht, 10);
  // Zirkuläre Distanz: |350 - 10| = 340, aber 360 - 340 = 20, also distance = 20
  // score = 20/180 ≈ 0.111
  assert.ok(score > 0.1 && score < 0.15, `Score für 20° Distanz sollte ~0.11, ist aber ${score}`);
});

test("[REQ-EXP-005] rankBuchten: leere Liste ergibt leeres Ranking", () => {
  const ranking = rankBuchten([], 0);
  assert.deepEqual(ranking, []);
});

test("[REQ-EXP-005] rankBuchten: stabile Sortierung bei gleichem Score", () => {
  // Zwei Buchten mit identischem Score: Sortierung sollte stabil bleiben
  const bucht1: BuchtSektor = { id: "1", name: "Erste", oeffnungsrichtung_deg: 0, oeffnungsbreite_deg: 90 };
  const bucht2: BuchtSektor = { id: "2", name: "Zweite", oeffnungsrichtung_deg: 0, oeffnungsbreite_deg: 90 };

  const ranking = rankBuchten([bucht1, bucht2], 0);
  assert.equal(ranking[0].id, "1", "Bei gleichem Score sollte die Eingabe-Reihenfolge erhalten bleiben");
  assert.equal(ranking[1].id, "2");
});

test("[REQ-EXP-005] rankBuchten: absteigend nach Score sortiert", () => {
  const bucht1: BuchtSektor = { id: "1", name: "OSO", oeffnungsrichtung_deg: 112, oeffnungsbreite_deg: 60 };
  const bucht2: BuchtSektor = { id: "2", name: "Norden", oeffnungsrichtung_deg: 0, oeffnungsbreite_deg: 60 };
  const bucht3: BuchtSektor = { id: "3", name: "Suedwest", oeffnungsrichtung_deg: 225, oeffnungsbreite_deg: 60 };

  const ranking = rankBuchten([bucht1, bucht2, bucht3], 0); // Nordwind (0°)

  // Wertung bei Nordwind (AUS 0°):
  // - Bucht 2 (0°): distance = 0, score = 0 (exponiert)
  // - Bucht 1 (112°): distance = 112, score = 112/180 ≈ 0.622
  // - Bucht 3 (225°): distance = min(225, 135) = 135, score = 135/180 = 0.75 (geschützt)
  // Ranking sollte sein: 3 > 1 > 2

  assert.equal(ranking[0].id, "3", "Bucht 3 sollte Score ~0.75 haben");
  assert.equal(ranking[1].id, "1", "Bucht 1 sollte Score ~0.62 haben");
  assert.equal(ranking[2].id, "2", "Bucht 2 sollte Score ~0 haben");
  assert.ok(ranking[0].score > ranking[1].score, "ranking[0] > ranking[1]");
  assert.ok(ranking[1].score > ranking[2].score, "ranking[1] > ranking[2]");
});

test("[REQ-EXP-005] WINDSCHUTZ_HINWEIS enthält die Sicherheits-Aussage", () => {
  assert.ok(WINDSCHUTZ_HINWEIS.includes("keine"), "Hinweis sollte 'keine' enthalten");
  assert.ok(WINDSCHUTZ_HINWEIS.includes("Freigabe"), "Hinweis sollte 'Freigabe' enthalten");
});

test("[REQ-EXP-005] Randfälle: NaN/ungültige Eingaben sollten robust behandelt werden", () => {
  const bucht: BuchtSektor = { id: "test", name: "Test", oeffnungsrichtung_deg: 0, oeffnungsbreite_deg: 90 };

  // NaN-Eingaben: sollten nicht crashen (robust = kein throw, evtl. default-Verhalten)
  const score1 = windschutzScore(bucht, NaN);
  assert.ok(Number.isFinite(score1), "Score mit NaN-Wind sollte finit sein");
});

test("[REQ-EXP-005] Winkel > 360 oder < 0 sollten normalisiert werden", () => {
  const bucht: BuchtSektor = { id: "test", name: "Test", oeffnungsrichtung_deg: 0, oeffnungsbreite_deg: 90 };

  // 360° ist äquivalent zu 0°
  const score360 = windschutzScore(bucht, 360);
  const score0 = windschutzScore(bucht, 0);

  assert.ok(Math.abs(score360 - score0) < 0.01, `360° und 0° sollten gleiche Scores haben: ${score360} vs ${score0}`);
});
