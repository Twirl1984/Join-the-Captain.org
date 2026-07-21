// Tests zur Konversions-Messung (REQ-BIZ-001).
// Lauf: node --import tsx --test src/lib/analytics/__tests__/ereignisse.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { EREIGNIS, mitUtm } from "../ereignisse";

test("[REQ-BIZ-001] Ereignis-Namen sind eindeutig (kein doppelter Zielname)", () => {
  const namen = Object.values(EREIGNIS);
  assert.equal(new Set(namen).size, namen.length, `Doppelte Ereignis-Namen: ${namen.join(", ")}`);
});

test("[REQ-BIZ-001] mitUtm haengt die Herkunftsparameter an", () => {
  const url = mitUtm("https://join-the-captain.org/toern/abc", {
    source: "toern-share",
    medium: "social",
  });
  assert.match(url, /utm_source=toern-share/);
  assert.match(url, /utm_medium=social/);
});

test("[REQ-BIZ-001] bestehende Query-Parameter bleiben erhalten", () => {
  const url = mitUtm("/toern/abc?ref=crew", { source: "instagram", medium: "reel" });
  assert.match(url, /ref=crew/);
  assert.match(url, /utm_source=instagram/);
});

test("[REQ-BIZ-001] ein bereits gesetztes utm gewinnt (Kampagnen-Herkunft bleibt)", () => {
  // Ein geteilter Link, der selbst schon aus einer Kampagne stammt, darf seine
  // Herkunft nicht durch das Teilen verlieren.
  const url = mitUtm("/toern/abc?utm_source=youtube", { source: "toern-share", medium: "social" });
  assert.match(url, /utm_source=youtube/);
  assert.doesNotMatch(url, /utm_source=toern-share/);
});

test("[REQ-BIZ-001] optionale Parameter werden nur gesetzt, wenn vorhanden", () => {
  const ohne = mitUtm("/x", { source: "a", medium: "b" });
  assert.doesNotMatch(ohne, /utm_campaign/);
  const mit = mitUtm("/x", { source: "a", medium: "b", campaign: "sommer" });
  assert.match(mit, /utm_campaign=sommer/);
});

test("[REQ-BIZ-001] relative Pfade werden gegen die Basis aufgeloest", () => {
  const url = mitUtm("/preise", { source: "instagram", medium: "story" });
  assert.match(url, /^https:\/\/join-the-captain\.org\/preise\?/);
});

test("[REQ-BIZ-001] kaputte Eingabe verhindert das Teilen nicht (Rueckfall)", () => {
  // Fällt auf die Eingabe zurück statt zu werfen.
  const kaputt = mitUtm("::: kein url :::", { source: "a", medium: "b" }, "not-a-base");
  assert.equal(kaputt, "::: kein url :::");
});
