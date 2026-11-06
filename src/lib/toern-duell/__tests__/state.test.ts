// Unit-Tests der Zustandsoperationen (reine Funktionen, unveränderlich).
import { test } from "node:test";
import { strict as assert } from "node:assert";
import * as St from "../../../../public/toern-duell/state.js";

let n = 0;
const id = () => `id${++n}`;
const mit = (...namen: string[]) => namen.reduce((s, name) => St.addPerson(s, name, id).state, St.leererZustand());
const bew = (k: number, c: number, s: number) => ({ kommunikation: k, crew: c, steuerung: s });

test("[REQ-DUEL-003] Leerer Zustand: Version 1, Boot „Akilina“", () => {
  const s = St.leererZustand();
  assert.equal(s.version, 1);
  assert.equal(s.boot, "Akilina");
  assert.deepEqual(s.crew, []);
  assert.deepEqual(s.versuche, []);
});

test("[REQ-DUEL-003] Crew: bis zu 11 Personen, 12. wird abgelehnt", () => {
  let s = St.leererZustand();
  for (let i = 1; i <= 11; i++) s = St.addPerson(s, `P${i}`, id).state;
  assert.equal(s.crew.length, 11);
  const r = St.addPerson(s, "Zu viel", id);
  assert.equal(r.fehler, "voll");
  assert.equal(r.state.crew.length, 11);
});

test("[REQ-DUEL-003] Crew: Name wird getrimmt; leer und Dublette (ohne Groß/Klein) abgelehnt", () => {
  const s = mit("  Anna  ");
  assert.equal(s.crew[0].name, "Anna");
  assert.equal(St.addPerson(s, "   ", id).fehler, "leer");
  assert.equal(St.addPerson(s, "anna", id).fehler, "doppelt");
  assert.equal(St.addPerson(s, "x".repeat(41), id).fehler, "zu-lang");
});

test("[REQ-DUEL-003] Umbenennen: gleiche Prüfregeln, eigener Name bleibt erlaubt", () => {
  const s = mit("Anna", "Ben");
  const [a, b] = s.crew;
  assert.equal(St.renamePerson(s, a.id, "Anna").fehler, undefined);
  assert.equal(St.renamePerson(s, a.id, "ben").fehler, "doppelt");
  assert.equal(St.renamePerson(s, b.id, "Bernd").state.crew[1].name, "Bernd");
});

test("[REQ-DUEL-003] Versuch: Bewerter ≠ Rudergänger, beide in der Crew, Karte 1–15", () => {
  const s = mit("Anna", "Ben");
  const [a, b] = s.crew;
  const v = { karte: 14, rudergaenger: a.id, bewerter: b.id, selbst: bew(3, 3, 3), fremd: bew(3, 3, 3) };
  assert.equal(St.addVersuch(s, v, id).state.versuche.length, 1);
  assert.equal(St.addVersuch(s, { ...v, bewerter: a.id }, id).fehler, "selbst-bewertung");
  assert.equal(St.addVersuch(s, { ...v, bewerter: "unbekannt" }, id).fehler, "person");
  assert.equal(St.addVersuch(s, { ...v, karte: 16 }, id).fehler, "karte");
  assert.equal(St.addVersuch(s, { ...v, karte: 0 }, id).fehler, "karte");
  assert.equal(St.addVersuch(s, { ...v, fremd: bew(6, 0, 0) }, id).fehler, "bewertung");
  assert.equal(St.addVersuch(s, v, id).state.versuche[0].id.startsWith("id"), true);
});

test("[REQ-DUEL-003] Versuch bearbeiten und löschen; mehrere Versuche je Person/Karte erlaubt", () => {
  const s0 = mit("Anna", "Ben");
  const [a, b] = s0.crew;
  const v = { karte: 1, rudergaenger: a.id, bewerter: b.id, selbst: bew(1, 1, 1), fremd: bew(1, 1, 1) };
  let s = St.addVersuch(s0, v, id).state;
  s = St.addVersuch(s, v, id).state;
  assert.equal(s.versuche.length, 2);
  const vid = s.versuche[0].id;
  const e = St.updateVersuch(s, vid, { fremd: bew(5, 5, 5) });
  assert.equal(e.state.versuche[0].fremd.crew, 5);
  assert.equal(St.updateVersuch(s, vid, { bewerter: a.id }).fehler, "selbst-bewertung");
  assert.equal(St.updateVersuch(s, "nix", {}).fehler, "unbekannt");
  assert.equal(St.deleteVersuch(s, vid).versuche.length, 1);
});

test("[REQ-DUEL-003] Person entfernen räumt Versuche und Landgang-Verweise auf", () => {
  let s = mit("Anna", "Ben", "Cem");
  const [a, b, c] = s.crew;
  s = St.addVersuch(s, { karte: 1, rudergaenger: a.id, bewerter: b.id, selbst: bew(1, 1, 1), fremd: bew(1, 1, 1) }, id).state;
  s = St.addVersuch(s, { karte: 1, rudergaenger: c.id, bewerter: b.id, selbst: bew(1, 1, 1), fremd: bew(1, 1, 1) }, id).state;
  s = { ...s, landgang: { seilziehen: [{ gewinner: b.id }], muell: { platz1: b.id, platz2: c.id, skurril: { person: b.id, fund: "Schuh" } }, geocache: { [b.id]: 2, [c.id]: 1 } } };
  const r = St.removePerson(s, b.id);
  assert.equal(r.crew.length, 2);
  assert.equal(r.versuche.length, 2); // Bewertungen anderer bleiben …
  assert.ok(r.versuche.every((v: { bewerter: string | null }) => v.bewerter === null)); // … Bewerter wird „entfernt“
  assert.equal(St.removePerson(s, a.id).versuche.length, 1); // Annas eigener Versuch fällt weg
  assert.equal(r.landgang.seilziehen[0].gewinner, null);
  assert.equal(r.landgang.muell.platz1, null);
  assert.equal(r.landgang.muell.platz2, c.id);
  assert.equal(r.landgang.muell.skurril, null);
  assert.equal(r.landgang.geocache[b.id], undefined);
  assert.equal(r.landgang.geocache[c.id], 1);
});

test("[REQ-DUEL-002] Landgang-Operationen: Runde, Platz, Fund, Geocache-Zähler (nie negativ)", () => {
  let s = mit("Anna", "Ben");
  const [a, b] = s.crew;
  s = St.addSeilziehenRunde(s, a.id);
  s = St.addSeilziehenRunde(s, b.id);
  assert.equal(s.landgang.seilziehen.length, 2);
  s = St.setMuellPlatz(s, 1, a.id);
  s = St.setMuellPlatz(s, 2, a.id); // gleiche Person nicht doppelt platziert
  assert.equal(s.landgang.muell.platz1, null);
  assert.equal(s.landgang.muell.platz2, a.id);
  s = St.setSkurril(s, b.id, "  Flip-Flop ");
  assert.deepEqual(s.landgang.muell.skurril, { person: b.id, fund: "Flip-Flop" });
  s = St.changeGeocache(s, a.id, +1);
  s = St.changeGeocache(s, a.id, -1);
  s = St.changeGeocache(s, a.id, -1);
  assert.equal(s.landgang.geocache[a.id] ?? 0, 0);
  s = St.removeSeilziehenRunde(s, 0);
  assert.equal(s.landgang.seilziehen.length, 1);
});

test("[REQ-DUEL-003] Operationen verändern den Eingabezustand nicht", () => {
  const s = mit("Anna");
  const snap = JSON.stringify(s);
  St.addPerson(s, "Ben", id);
  St.removePerson(s, s.crew[0].id);
  St.addSeilziehenRunde(s, s.crew[0].id);
  assert.equal(JSON.stringify(s), snap);
});

test("[REQ-DUEL-002] setSkurril behält Teilangaben (Fund ohne Person und Person ohne Fund), leert bei beidem leer", () => {
  const s = mit("Anna");
  const a = St.setSkurril(s, null, " Schuh ");
  assert.deepEqual(a.landgang.muell.skurril, { person: null, fund: "Schuh" });
  const b = St.setSkurril(a, s.crew[0].id, a.landgang.muell.skurril.fund);
  assert.deepEqual(b.landgang.muell.skurril, { person: s.crew[0].id, fund: "Schuh" });
  const c = St.setSkurril(s, s.crew[0].id, "");
  assert.deepEqual(c.landgang.muell.skurril, { person: s.crew[0].id, fund: "" });
  assert.equal(St.setSkurril(s, null, "  ").landgang.muell.skurril, null);
});
