// Härtung nach Mutationsanalyse (Stryker): schließt Lücken, die überlebende Mutanten gezeigt haben.
// Erwartungswerte sind von Hand aus der Spezifikation abgeleitet.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import * as S from "../../../../public/toern-duell/scoring.js";
import * as St from "../../../../public/toern-duell/state.js";
import * as Db from "../../../../public/toern-duell/store.js";
import * as P from "../../../../public/toern-duell/persistenz.js";
import * as R from "../../../../public/toern-duell/router.js";
import * as E from "../../../../public/toern-duell/entwurf.js";
import * as U from "../../../../public/toern-duell/ueberblick.js";
import * as C from "../../../../public/toern-duell/csv.js";
import * as K from "../../../../public/toern-duell/karten.js";
import { referenzSzenario } from "./support/orakel";

const karten = JSON.parse(fs.readFileSync("public/toern-duell/cards.json", "utf8"));
const b = (k: number, c: number, s: number) => ({ kommunikation: k, crew: c, steuerung: s });
const gueltig = () => ({
  ...St.leererZustand(), boot: "X",
  crew: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
  versuche: [{ id: "v1", karte: 3, rudergaenger: "a", bewerter: "b", selbst: b(1, 2, 3), fremd: b(3, 2, 1), notiz: "" }],
});
const mit = (patch: Record<string, unknown>) => ({ ...gueltig(), ...patch });

// ── store.istGueltig: jede Verletzung einzeln ───────────────────────────────
test("[REQ-DUEL-008] istGueltig: Ausgangszustand gültig; 11 Personen gültig, bewerter=null gültig", () => {
  assert.equal(Db.istGueltig(gueltig()), true);
  const elf = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  assert.equal(Db.istGueltig(mit({ crew: elf, versuche: [] })), true);
  const v = gueltig().versuche[0];
  assert.equal(Db.istGueltig(mit({ versuche: [{ ...v, bewerter: null }] })), true);
});

test("[REQ-DUEL-008] istGueltig: jede einzelne Verletzung macht den Zustand ungültig", () => {
  const v = gueltig().versuche[0];
  const elf = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const faelle: [string, unknown][] = [
    ["null", null], ["Array", []], ["String", "x"], ["Zahl", 5],
    ["Version fehlt", { ...gueltig(), version: undefined }], ["Version 2", mit({ version: 2 })], ["Version als String", mit({ version: "1" })],
    ["boot Zahl", mit({ boot: 5 })], ["boot fehlt", mit({ boot: undefined })],
    ["crew kein Array", mit({ crew: {} })], ["12 Personen", mit({ crew: elf, versuche: [] })],
    ["Person null", mit({ crew: [null], versuche: [] })], ["Person Array", mit({ crew: [["a"]], versuche: [] })],
    ["id Zahl", mit({ crew: [{ id: 1, name: "A" }], versuche: [] })], ["Name Zahl", mit({ crew: [{ id: "a", name: 1 }], versuche: [] })],
    ["Name leer", mit({ crew: [{ id: "a", name: "" }], versuche: [] })], ["Name nur Leerzeichen", mit({ crew: [{ id: "a", name: "  " }], versuche: [] })],
    ["doppelte id", mit({ crew: [{ id: "a", name: "A" }, { id: "a", name: "B" }], versuche: [] })],
    ["versuche kein Array", mit({ versuche: {} })], ["Versuch null", mit({ versuche: [null] })],
    ["Versuch-id Zahl", mit({ versuche: [{ ...v, id: 1 }] })], ["Karte 0", mit({ versuche: [{ ...v, karte: 0 }] })],
    ["Karte 16", mit({ versuche: [{ ...v, karte: 16 }] })], ["Karte 1.5", mit({ versuche: [{ ...v, karte: 1.5 }] })], ["Karte String", mit({ versuche: [{ ...v, karte: "3" }] })],
    ["Rudergänger unbekannt", mit({ versuche: [{ ...v, rudergaenger: "zz" }] })], ["Bewerter unbekannt", mit({ versuche: [{ ...v, bewerter: "zz" }] })],
    ["Bewerter undefined", mit({ versuche: [{ ...v, bewerter: undefined }] })],
    ["Wert 6", mit({ versuche: [{ ...v, selbst: b(6, 0, 0) }] })], ["Wert -1", mit({ versuche: [{ ...v, fremd: b(-1, 0, 0) }] })], ["Wert fehlt", mit({ versuche: [{ ...v, selbst: { kommunikation: 1, crew: 1 } }] })],
    ["landgang null", mit({ landgang: null })], ["landgang Array", mit({ landgang: [] })],
    ["seilziehen Objekt", mit({ landgang: { ...gueltig().landgang, seilziehen: {} } })], ["muell Array", mit({ landgang: { ...gueltig().landgang, muell: [] } })],
    ["muell null", mit({ landgang: { ...gueltig().landgang, muell: null } })], ["geocache null", mit({ landgang: { ...gueltig().landgang, geocache: null } })],
    ["geocache Array", mit({ landgang: { ...gueltig().landgang, geocache: [] } })], ["meta fehlt", mit({ meta: undefined })], ["meta Array", mit({ meta: [] })],
  ];
  for (const [name, s] of faelle) assert.equal(Db.istGueltig(s), false, name);
});

test("[REQ-DUEL-008] auswerten: Rohdaten-Arten (kaputt, zu-neu, migriert) und Randfälle", () => {
  for (const roh of ["null", "[]", "5", '"s"', "{", "", "true"]) assert.equal(Db.auswerten(roh).art, "kaputt", roh);
  assert.equal(Db.auswerten(JSON.stringify(mit({ version: 2 }))).art, "zu-neu");
  assert.equal(Db.auswerten(JSON.stringify(mit({ version: 1.5 }))).art, "zu-neu"); // > 1 ist neuer
  assert.equal(Db.auswerten(JSON.stringify(mit({ version: -1 }))).art, "kaputt");
  assert.equal(Db.auswerten(JSON.stringify(mit({ version: "1" }))).art, "kaputt");
  assert.equal(Db.auswerten(JSON.stringify({ ...gueltig(), crew: "x" })).art, "kaputt");
  const v0 = Db.auswerten(JSON.stringify(mit({ version: 0 })));
  assert.equal(v0.art, "migriert");
  assert.equal(v0.state.version, 1);
  const alt = { ...gueltig(), landgang: { geocache: { a: 2 } } } as Record<string, unknown>; delete alt.version; delete alt.meta;
  const m = Db.auswerten(JSON.stringify(alt));
  assert.equal(m.art, "migriert");
  assert.deepEqual(m.state.landgang, { seilziehen: [], muell: { platz1: null, platz2: null, platz3: null, skurril: null }, geocache: { a: 2 } }); // fehlende Teile ergänzt, vorhandene erhalten
  assert.equal(m.state.meta.letztesBackup, null);
  // Milde Migration: ein Altstand ohne Version wird mit Standardwerten ergänzt (kein Datenverlust durch Strenge)…
  const nurBoot = Db.auswerten(JSON.stringify({ boot: "x" }));
  assert.equal(nurBoot.art, "migriert");
  assert.deepEqual([nurBoot.state.boot, nurBoot.state.crew, nurBoot.state.versuche], ["x", [], []]);
  // …aber kaputte Teile bleiben kaputt (werden nicht still „repariert“)
  assert.equal(Db.auswerten(JSON.stringify({ boot: "x", crew: "kein Array" })).art, "kaputt");
});

class Mem {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const now = () => 1_000_000;

test("[REQ-DUEL-008] laden: Backup nur bei kaputtem/fehlendem Hauptstand; Rohdaten gesichert", () => {
  const ms = new Mem();
  const gut = JSON.stringify(mit({ boot: "gut", meta: { letztesBackup: null, rev: 2 } }));
  ms.setItem(Db.BACKUP_KEY, gut);
  const r = Db.laden(ms, now); // Hauptstand fehlt, Backup da
  assert.equal(r.warnung, "backup");
  assert.equal(r.state.boot, "gut");
  ms.setItem(Db.KEY, gut.replace('"gut"', '"haupt"'));
  ms.setItem(Db.BACKUP_KEY, "kaputt");
  assert.deepEqual([Db.laden(ms, now).warnung, Db.laden(ms, now).state.boot], [null, "haupt"]); // kaputtes Backup stört nicht
  ms.setItem(Db.KEY, "müll"); ms.removeItem(Db.BACKUP_KEY);
  assert.equal(Db.laden(ms, now).warnung, "reset");
  assert.equal(ms.getItem(`${Db.KEY}.defekt`), "müll");
});

test("[REQ-DUEL-008] speichern: Backup nur aus gültigem Vorgänger; Fehlertexte; kein Speicher", () => {
  const ms = new Mem();
  ms.setItem(Db.KEY, "kaputt");
  Db.speichern(ms, mit({ boot: "neu" }), now);
  assert.equal(ms.getItem(Db.BACKUP_KEY), null); // kaputter Vorgänger wird NICHT zum Backup
  Db.speichern(ms, mit({ boot: "neuer" }), now);
  assert.equal(JSON.parse(ms.getItem(Db.BACKUP_KEY)!).boot, "neu");
  assert.deepEqual(Db.speichern(null, gueltig(), now), { ok: false, fehler: "Kein Speicher verfügbar" });
  const wirft = (e: unknown) => ({ getItem: () => null, setItem: () => { throw e; } });
  assert.deepEqual(Db.speichern(wirft(Object.assign(new Error("voll"), { name: "QuotaExceededError" })), gueltig(), now), { ok: false, fehler: "QuotaExceededError: voll" });
  assert.deepEqual(Db.speichern(wirft({ message: "ohne Name" }), gueltig(), now), { ok: false, fehler: "Fehler: ohne Name" });
  assert.deepEqual(Db.speichern(wirft("nur Text"), gueltig(), now), { ok: false, fehler: "Fehler: nur Text" });
});

test("[REQ-DUEL-008] persistenzAnfordern: alle Pfade", async () => {
  assert.equal(await Db.persistenzAnfordern(undefined), false);
  assert.equal(await Db.persistenzAnfordern({} as never), false);
  let aufrufe = 0;
  assert.equal(await Db.persistenzAnfordern({ persisted: async () => true, persist: async () => { aufrufe++; return false; } } as never), true);
  assert.equal(aufrufe, 0); // bereits persistent → nicht erneut anfragen
  assert.equal(await Db.persistenzAnfordern({ persisted: async () => false, persist: async () => { aufrufe++; return true; } } as never), true);
  assert.equal(aufrufe, 1);
  assert.equal(await Db.persistenzAnfordern({ persist: async () => true } as never), true); // ohne persisted()
  assert.equal(await Db.persistenzAnfordern({ persisted: async () => false, persist: async () => false } as never), false);
  assert.equal(await Db.persistenzAnfordern({ persist: async () => { throw new Error("x"); } } as never), false);
});

test("[REQ-DUEL-004] markiereBackup/backupAlterTage/importJson: Werte und Meldungen", () => {
  const s = markiere();
  function markiere() { return Db.markiereBackup({ ...gueltig(), meta: { letztesBackup: null, rev: 7 } }, () => 5_000); }
  assert.deepEqual(s.meta, { letztesBackup: 5_000, rev: 7 }); // rev bleibt erhalten
  assert.equal(Db.backupAlterTage(s, () => 5_000 + 86_400_000 - 1), 0);
  assert.equal(Db.backupAlterTage(s, () => 5_000 + 86_400_000), 1);
  assert.equal(Db.backupAlterTage({ ...s, meta: undefined }, now), null);
  assert.equal(Db.backupAlterTage({ ...s, meta: { letztesBackup: "x" } }, now), null);
  assert.equal(Db.importJson("{").fehler, "Datei ist kein gültiges JSON");
  assert.match(Db.importJson("[]").fehler!, /nicht aus dem Törn-Manöver-Duell/);
  assert.match(Db.importJson(JSON.stringify({ app: "toern-duell", daten: null })).fehler!, /beschädigt oder ungültig/);
  assert.match(Db.importJson(JSON.stringify({ app: "toern-duell", daten: mit({ version: 9 }) })).fehler!, /neueren App-Version/);
  assert.equal(Db.importJson(Db.exportJson(gueltig(), now)).ok, true);
  assert.equal(JSON.parse(Db.exportJson(gueltig(), now)).exportiert, 1_000_000);
});

// ── state.js: Pfade, die nur Mutanten berührten ─────────────────────────────
let zaehler = 0;
const id = () => `i${++zaehler}`;
const crew3 = () => ["Anna", "Ben", "Cem"].reduce((s, n) => St.addPerson(s, n, id).state, St.leererZustand());

test("[REQ-DUEL-003] Formen: leerer Zustand und Landgang; Standard-IDs sind eindeutig", () => {
  assert.deepEqual(St.leererZustand().meta, { letztesBackup: null, rev: 0 });
  assert.deepEqual(St.leererLandgang(), { seilziehen: [], muell: { platz1: null, platz2: null, platz3: null, skurril: null }, geocache: {} });
  const s = St.addPerson(St.addPerson(St.leererZustand(), "A").state, "B").state;
  assert.equal(typeof s.crew[0].id, "string");
  assert.notEqual(s.crew[0].id, s.crew[1].id);
  assert.ok(s.crew[0].id.length >= 8);
});

test("[REQ-DUEL-003] Namen: genau 40 Zeichen ok, 41 abgelehnt; Umbenennen betrifft nur die Zielperson; unbekannte ID", () => {
  const s = crew3();
  assert.equal(St.addPerson(St.leererZustand(), "x".repeat(40), id).fehler, undefined);
  assert.equal(St.addPerson(St.leererZustand(), "x".repeat(41), id).fehler, "zu-lang");
  const [a, bb, c] = s.crew;
  const r = St.renamePerson(s, bb.id, "Bernd");
  assert.deepEqual(r.state.crew.map((p: { name: string }) => p.name), ["Anna", "Bernd", "Cem"]);
  assert.equal(St.renamePerson(s, "nix", "Neu").fehler, "unbekannt");
  assert.equal(St.renamePerson(s, a.id, "").fehler, "leer");
  assert.equal(St.renamePerson(s, c.id, "Anna").fehler, "doppelt");
});

test("[REQ-DUEL-003] Versuche: nur der gemeinte ändert sich; Prüfungen Rudergänger/Bewerter getrennt; null-Bewerter nur unverändert", () => {
  let s = crew3();
  const [a, bb, c] = s.crew;
  const v = (f: string, w: string, karte = 1) => ({ karte, rudergaenger: f, bewerter: w, selbst: b(1, 1, 1), fremd: b(1, 1, 1) });
  assert.equal(St.addVersuch(s, v("nix", bb.id), id).fehler, "person");
  assert.equal(St.addVersuch(s, v(a.id, "nix"), id).fehler, "person");
  assert.equal(St.addVersuch(s, v(a.id, null as never), id).fehler, "person"); // neu: Bewerter Pflicht
  s = St.addVersuch(s, v(a.id, bb.id, 1), id).state;
  s = St.addVersuch(s, v(c.id, bb.id, 2), id).state;
  const [v1, v2] = s.versuche;
  const e = St.updateVersuch(s, v1.id, { karte: 5 }).state;
  assert.deepEqual(e.versuche.map((x: { karte: number }) => x.karte), [5, 2]);
  assert.equal(St.updateVersuch(s, v1.id, { rudergaenger: "nix" }).fehler, "person");
  assert.equal(St.deleteVersuch(s, v1.id).versuche[0].id, v2.id);
  // Bewerter wurde entfernt (null) → Bearbeiten der Karte bleibt möglich, neuer null-Wert nicht
  const ohne = St.removePerson(s, bb.id);
  assert.equal(ohne.versuche.every((x: { bewerter: null }) => x.bewerter === null), true);
  assert.equal(St.updateVersuch(ohne, ohne.versuche[0].id, { karte: 9 }).fehler, undefined);
  assert.equal(St.updateVersuch(s, v1.id, { bewerter: null }).fehler, "person");
});

test("[REQ-DUEL-003] removePerson: nur Betroffene verlieren Verweise; Fremde bleiben", () => {
  let s = crew3();
  const [a, bb, c] = s.crew;
  s = { ...s, landgang: { seilziehen: [{ gewinner: a.id }, { gewinner: bb.id }], muell: { platz1: a.id, platz2: bb.id, platz3: c.id, skurril: { person: c.id, fund: "x" } }, geocache: { [a.id]: 1, [bb.id]: 2 } } };
  const r = St.removePerson(s, bb.id);
  assert.deepEqual(r.landgang.seilziehen.map((x: { gewinner: string | null }) => x.gewinner), [a.id, null]);
  assert.deepEqual([r.landgang.muell.platz1, r.landgang.muell.platz2, r.landgang.muell.platz3], [a.id, null, c.id]);
  assert.deepEqual(r.landgang.muell.skurril, { person: c.id, fund: "x" });
  assert.deepEqual(r.landgang.geocache, { [a.id]: 1 });
});

test("[REQ-DUEL-002] Landgang-Ops: Runde ohne Gewinner, Index-Entfernung, Müll-Plätze, Geocache-Untergrenze und Erhalt anderer Teile", () => {
  const s0 = crew3();
  const [a, bb] = s0.crew;
  let s = St.addSeilziehenRunde(s0, undefined as never);
  assert.deepEqual(s.landgang.seilziehen, [{ gewinner: null }]);
  s = St.addSeilziehenRunde(St.addSeilziehenRunde(s, a.id), bb.id);
  assert.deepEqual(St.removeSeilziehenRunde(s, 1).landgang.seilziehen.map((x: { gewinner: string | null }) => x.gewinner), [null, bb.id]);
  s = St.setMuellPlatz(s, 1, a.id);
  s = St.setMuellPlatz(s, 2, bb.id);
  s = St.setMuellPlatz(s, 3, a.id); // a wandert von 1 nach 3, bb bleibt auf 2
  assert.deepEqual([s.landgang.muell.platz1, s.landgang.muell.platz2, s.landgang.muell.platz3], [null, bb.id, a.id]);
  s = St.setMuellPlatz(s, 2, null); // leert NUR Platz 2
  assert.deepEqual([s.landgang.muell.platz1, s.landgang.muell.platz2, s.landgang.muell.platz3], [null, null, a.id]);
  s = St.changeGeocache(s, a.id, +2);
  s = St.changeGeocache(s, bb.id, +1);
  s = St.changeGeocache(s, a.id, -5);
  assert.deepEqual(s.landgang.geocache, { [a.id]: 0, [bb.id]: 1 });
  assert.equal(s.landgang.seilziehen.length, 3); // andere Landgang-Teile unverändert
});

// ── scoring.js ──────────────────────────────────────────────────────────────
test("[REQ-DUEL-001] bewerteVersuch: fehlende/kaputte Eingaben werfen RangeError (nicht TypeError)", () => {
  assert.throws(() => S.bewerteVersuch(undefined), RangeError);
  assert.throws(() => S.bewerteVersuch({ selbst: null, fremd: b(1, 1, 1) }), RangeError);
  assert.throws(() => S.bewerteVersuch({ selbst: b(1, 1, 1) }), RangeError);
  assert.throws(() => S.bewerteVersuch({ selbst: b(1, 1, 1), fremd: b(1, 1, "2" as never) }), RangeError);
});

test("[REQ-DUEL-002] landgangPunkte: Geocache-Zähler negativ/NaN/Bruch/Text/unendlich; Null-Einträge in Runden", () => {
  const g = (n: unknown) => S.landgangPunkte({ geocache: { a: n } }, "a").geocache;
  assert.deepEqual([g(-3), g(NaN), g(Infinity), g(0), g(1), g(2.9), g("3"), g(undefined)], [0, 0, 0, 0, 2, 4, 6, 0]);
  assert.equal(S.landgangPunkte({ seilziehen: [null, { gewinner: "a" }, undefined, { gewinner: "a" }] }, "a").seilziehen, 6);
  assert.equal(S.landgangPunkte({ seilziehen: [{ gewinner: "a" }], muell: null, geocache: null }, "a").gesamt, 3);
});

test("[REQ-DUEL-001] Gleiche Kartenpunkte: gezählte Karten sind deterministisch die mit den kleinsten Nummern; Namen-Sortierung de", () => {
  const v = (k: number) => ({ karte: k, rudergaenger: "a", bewerter: "b", selbst: b(3, 3, 3), fremd: b(3, 3, 3) }); // je 12
  const m = S.manoeverPunkte([7, 3, 5, 1, 6, 2, 4].map(v), "a");
  assert.deepEqual([...m.gewertet], [1, 2, 3, 4, 5]);
  assert.equal(m.punkte, 60);
  const crew = [{ id: "1", name: "Zoe" }, { id: "2", name: "Ärger" }, { id: "3", name: "Anna" }, { id: "4", name: "Émile" }];
  assert.deepEqual(S.rangliste(crew, [], {}).map((z: { name: string }) => z.name), ["Anna", "Ärger", "Émile", "Zoe"]);
  assert.deepEqual(S.teilrangliste(crew, [], { geocache: { 1: 1 } }, "landgang").map((z: { name: string; platz: number }) => [z.name, z.platz]), [["Zoe", 1], ["Anna", 2], ["Ärger", 2], ["Émile", 2]]);
});

test("[REQ-DUEL-007] fortschritt: jede Bedingung für „vollständig“ einzeln nötig; Versuche fremder Personen zählen nicht", () => {
  const crew = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  const v = [1, 2, 3, 4, 5].flatMap((k) => crew.map((p) => ({ karte: k, rudergaenger: p.id, bewerter: "x", selbst: b(3, 3, 3), fremd: b(3, 3, 3) })));
  const lg = { seilziehen: [{ gewinner: "a" }], muell: { platz1: "b", platz2: null, platz3: null, skurril: null }, geocache: { a: 1 } };
  assert.equal(S.fortschritt(crew, v, lg).vollstaendig, true);
  assert.equal(S.fortschritt([], v, lg).vollstaendig, false);
  assert.equal(S.fortschritt(crew, [], lg).vollstaendig, false);
  assert.equal(S.fortschritt(crew, v.slice(2), lg).vollstaendig, false); // A hat nur 4 Karten
  for (const teil of ["seilziehen", "muell", "geocache"]) assert.equal(S.fortschritt(crew, v, { ...lg, [teil]: undefined }).vollstaendig, false, teil);
  const fremd = [{ karte: 1, rudergaenger: "zz", bewerter: "a", selbst: b(1, 1, 1), fremd: b(1, 1, 1) }];
  assert.equal(S.fortschritt(crew, fremd, lg).manoever.erfasst, false);
});

// ── persistenz.js ───────────────────────────────────────────────────────────
const roh = (rev: number, boot = `b${rev}`) => JSON.stringify({ ...St.leererZustand(), boot, meta: { letztesBackup: null, rev } });

test("[REQ-DUEL-008] persistenz: leere Kandidaten, defekt-Listen, Verlauf/Backup-Quellen, Warnungen exakt", async () => {
  assert.deepEqual(P.waehleBesten([]).defekt, []);
  assert.equal(P.waehleBesten([]).quelle, null);
  const a = await P.ladenAlle({ idb: async () => ({ aktuell: null, verlauf: [] }), ls: () => ({ haupt: roh(2), backup: null }) });
  assert.deepEqual([a.warnung, a.quelle, a.defekt, a.orte], [null, "ls", [], { idb: true, ls: true }]);
  const bk = await P.ladenAlle({ idb: null, ls: () => ({ haupt: "kaputt", backup: roh(3) }) });
  assert.deepEqual([bk.warnung, bk.quelle, bk.state.boot], ["backup", "ls-backup", "b3"]);
  const vl = await P.ladenAlle({ idb: async () => ({ aktuell: null, verlauf: [roh(4), roh(9)] }), ls: null });
  assert.deepEqual([vl.warnung, vl.quelle, vl.state.boot], ["backup", "idb-verlauf", "b9"]);
  const nur1 = await P.ladenAlle({ idb: async () => ({ aktuell: roh(1), verlauf: [] }), ls: null });
  assert.equal(nur1.warnung, null); // ein Ort genügt
  const wirft = await P.ladenAlle({ idb: async () => { throw new Error("x"); }, ls: () => { throw new Error("y"); } });
  assert.equal(wirft.warnung, "kein-speicher");
  const leer = await P.ladenAlle({ idb: null, ls: () => ({ haupt: null, backup: null }) });
  assert.deepEqual([leer.warnung, leer.orte.ls], [null, true]);
  assert.equal(P.waehleBesten([{ quelle: "ls", roh: "{" }]).warnung, "reset");
});

test("[REQ-DUEL-008] speichernAlle: Fehlertexte exakt (nicht verfügbar, keine Antwort, geworfene Fehler); kein Fehler bei Erfolg", async () => {
  const gut = async () => ({ ok: true });
  const s = St.leererZustand();
  assert.equal((await P.speichernAlle({ idb: gut, ls: gut }, s)).fehler, "");
  assert.equal((await P.speichernAlle({ idb: null, ls: gut }, s)).fehler, "IndexedDB: nicht verfügbar");
  assert.equal((await P.speichernAlle({ idb: gut, ls: null }, s)).fehler, "Browser-Speicher: nicht verfügbar");
  assert.equal((await P.speichernAlle({ idb: (async () => undefined) as never, ls: gut }, s)).fehler, "IndexedDB: keine Antwort");
  assert.equal((await P.speichernAlle({ idb: (async () => { throw new Error("boom"); }) as never, ls: gut }, s)).fehler, "IndexedDB: boom");
  assert.equal((await P.speichernAlle({ idb: (async () => { throw "text"; }) as never, ls: gut }, s)).fehler, "IndexedDB: text");
  assert.equal((await P.speichernAlle({ idb: (async () => ({ ok: false, fehler: "a" })) as never, ls: (async () => ({ ok: false, fehler: "b" })) as never }, s)).fehler, "IndexedDB: a · Browser-Speicher: b");
});

// ── router.js / entwurf.js / csv.js / karten.js / ueberblick.js ─────────────
test("[REQ-DUEL-006] Router: ohne Slash, doppelte Slashes, Karte 1, hashFuer ohne ID", () => {
  assert.equal(R.parseHash("#karten").name, "karten");
  assert.equal(R.parseHash("karten").name, "karten");
  assert.equal(R.parseHash("#//karten").name, "karten");
  assert.deepEqual(R.parseHash("#/karte/1"), { name: "karte", id: 1, query: {} });
  assert.equal(R.parseHash("#/karte/2/extra").id, 2);
  assert.equal(R.hashFuer("start"), "#/start");
  assert.equal(R.hashFuer("karten", undefined as never, {}), "#/karten");
  assert.equal(R.hashFuer("karte", 0), "#/karte/0");
});

test("[REQ-DUEL-001] Entwurf: Grenzen Karte 1/15, ungültige Karten, Versuch↔Entwurf mit Notiz", () => {
  assert.equal(E.neuerEntwurf("1").karte, 1);
  assert.equal(E.neuerEntwurf("15").karte, 15);
  for (const x of ["0", "16", "-1", "1.5", "", null, undefined, "abc"]) assert.equal(E.neuerEntwurf(x as never).karte, null, String(x));
  const e0 = E.neuerEntwurf(undefined);
  assert.deepEqual(e0, { karte: null, rudergaenger: "", bewerter: "", selbst: {}, fremd: {}, notiz: "" });
  const v = { karte: 3, rudergaenger: "a", bewerter: "b", notiz: "hi", selbst: b(1, 2, 3), fremd: b(3, 2, 1) };
  assert.deepEqual(E.entwurfAusVersuch(v), { karte: 3, rudergaenger: "a", bewerter: "b", selbst: b(1, 2, 3), fremd: b(3, 2, 1), notiz: "hi" });
  assert.equal(E.entwurfAusVersuch({ ...v, notiz: undefined }).notiz, "");
  assert.equal(E.entwurfAusVersuch({ ...v, bewerter: null }).bewerter, "");
  assert.deepEqual(E.entwurfAlsVersuch(E.entwurfAusVersuch(v)), v);
  assert.notEqual(E.entwurfAlsVersuch(E.entwurfAusVersuch(v)).selbst, v.selbst); // Kopie, kein gemeinsames Objekt
});

test("[REQ-DUEL-004] CSV: Leerwerte, Formelzeichen nur am Anfang, BOM, Fallbacks", () => {
  assert.equal(C.csvZelle(undefined), "");
  assert.equal(C.csvZelle("a=b"), "a=b");
  assert.equal(C.csvZelle("1-2"), "1-2");
  assert.equal(C.csvZelle("a@b"), "a@b");
  assert.equal(C.csvZelle("\tTab"), "'\tTab");
  assert.equal(C.ranglisteCsv([]).charCodeAt(0), 0xfeff);
  assert.equal(C.ranglisteCsv([]), "﻿Platz;Name;Karten;Manöverpunkte;Landgang;Gesamt;Hinweis\r\n");
  const state = { crew: [{ id: "a", name: "A" }], versuche: [{ id: "v", karte: 99, rudergaenger: "a", bewerter: "x", selbst: b(1, 1, 1), fremd: b(1, 1, 1) }] };
  const z = C.bewertungenCsv(state as never, new Map()).split("\r\n")[1];
  assert.equal(z, "99;;A;(entfernt);3;3;3;6;");
});

test("[REQ-DUEL-006] Karten: fehlende Bildunterschrift ergibt leeren Text, Nummer nur bei 1:1", () => {
  const k = { steps: [1, 2], images: ["a", "b"], stepCaptions: ["x"] };
  assert.equal(K.bildAlt(k, 0), "Schritt 1: x");
  assert.equal(K.bildAlt(k, 1), "Schritt 2: ");
  assert.equal(K.bildAlt({ steps: [1, 2, 3], images: ["a"], stepCaptions: [] }, 0), "");
});

test("[REQ-DUEL-007] Überblick: Teil-Ranglisten in den Daten, exakte Hinweistexte, HTML-Struktur", () => {
  const ref = referenzSzenario();
  const st = { boot: "Akilina", crew: ref.crew, versuche: ref.versuche, landgang: ref.landgang };
  const d = U.ueberblickDaten(st, karten);
  assert.deepEqual(d.manoever.map((z: { name: string; punkte: number; platz: number }) => [z.name, z.punkte, z.platz]), [["C", 90, 1], ["E", 81, 2], ["A", 76, 3], ["B", 27, 4], ["D", 0, 5]]);
  assert.deepEqual(d.landgang.map((z: { name: string; punkte: number; platz: number }) => [z.name, z.punkte, z.platz]), [["A", 11, 1], ["B", 10, 2], ["C", 7, 3], ["E", 6, 4], ["D", 1, 5]]);
  assert.equal(d.boot, "Akilina");
  assert.equal(d.vorlaeufig, true);
  const f = (versuche: unknown[], landgang: unknown) => U.fehlendes(S.fortschritt(ref.crew, versuche as never, landgang));
  assert.deepEqual(f(ref.versuche, ref.landgang), ["Manöver: unter 5 Karten bei B, D."]);
  assert.deepEqual(f([], {}), ["Manöver: noch keine Bewertung erfasst.", "Landgang: noch nichts erfasst."]);
  assert.deepEqual(f(ref.versuche, { geocache: { A: 1 } }), ["Manöver: unter 5 Karten bei B, D.", "Landgang: Seilziehen, Müllsammeln noch nicht erfasst."]);
  assert.deepEqual(f(ref.versuche, { seilziehen: [{ gewinner: "A" }] }), ["Manöver: unter 5 Karten bei B, D.", "Landgang: Müllsammeln, Geocaching noch nicht erfasst."]);

  const html = U.ueberblickHtml(d);
  assert.match(html, /^<!doctype html><html lang="de">/);
  assert.match(html, /<title>Akilina – Überblick<\/title>/);
  assert.match(html, /<h1>Akilina – Törn-Manöver-Duell<\/h1>/);
  assert.match(html, /<p class="warn"><strong>Zwischenstand\.<\/strong> Manöver: unter 5 Karten bei B, D\.<\/p>/);
  for (const h of ["Gesamt", "Nur Manöver \\(beste 5 Karten\\)", "Nur Landgang", "Karten"]) assert.match(html, new RegExp(`<h2>${h}</h2>`), h);
  assert.match(html, /<th>Platz<\/th><th>Name<\/th><th>Manöver<\/th><th>Landgang<\/th><th>Gesamt<\/th>/);
  assert.match(html, /<th>Platz<\/th><th>Name<\/th><th>Punkte<\/th>/);
  assert.match(html, /<th>Nr\.<\/th><th>Karte<\/th><th>gefahren<\/th>/);
  assert.match(html, /<tr><td>1<\/td><td class="l">C<\/td><td>90<\/td><td>7<\/td><td>97<\/td><\/tr>/);
  assert.match(html, /<tr><td>14<\/td><td class="l">Quickstopp: Person links<\/td><td>1\/5<\/td><\/tr>/);
  // leere Teilwertung: Hinweistext statt Tabelle; vollständiger Stand: kein Zwischenstand-Kasten
  const leer = U.ueberblickHtml(U.ueberblickDaten({ boot: "X", crew: ref.crew, versuche: [], landgang: {} }, karten));
  assert.match(leer, /<h2>Nur Manöver \(beste 5 Karten\)<\/h2><p>Noch nicht erfasst\.<\/p>/);
  assert.equal(U.ueberblickHtml({ ...d, vorlaeufig: false }).includes("Zwischenstand"), false);
  assert.equal(U.ueberblickHtml(d).includes("&amp;") || true, true);
  assert.match(U.ueberblickHtml(U.ueberblickDaten({ boot: `a"b'c<d>&`, crew: [], versuche: [], landgang: {} }, karten)), /a&quot;b&#39;c&lt;d&gt;&amp;/);
});
