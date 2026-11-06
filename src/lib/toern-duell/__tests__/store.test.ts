// Unit-Tests der Persistenz (injizierter Storage, injizierte Uhr).
import { test } from "node:test";
import { strict as assert } from "node:assert";
import * as St from "../../../../public/toern-duell/state.js";
import * as Db from "../../../../public/toern-duell/store.js";

class MemStorage {
  m = new Map<string, string>();
  failWrites = false;
  silentDrop = false; // schreibt „erfolgreich“, speichert aber nichts
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException("voll", "QuotaExceededError");
    if (!this.silentDrop) this.m.set(k, v);
  }
  removeItem(k: string) { this.m.delete(k); }
}
const now = () => 1_700_000_000_000;
const zustand = (boot = "Akilina") => ({ ...St.leererZustand(), boot });

test("[REQ-DUEL-003] Erststart ohne Daten: leerer Zustand, keine Warnung", () => {
  const r = Db.laden(new MemStorage(), now);
  assert.equal(r.warnung, null);
  assert.deepEqual(r.state.crew, []);
});

test("[REQ-DUEL-003] Speichern + Laden Roundtrip", () => {
  const ms = new MemStorage();
  const s = St.addPerson(zustand("Testboot"), "Anna", () => "a1").state;
  assert.equal(Db.speichern(ms, s, now).ok, true);
  const r = Db.laden(ms, now);
  assert.equal(r.warnung, null);
  assert.equal(r.state.boot, "Testboot");
  assert.equal(r.state.crew[0].name, "Anna");
});

test("[REQ-DUEL-003] Rolling-Backup: zweites Speichern sichert den vorherigen Stand", () => {
  const ms = new MemStorage();
  Db.speichern(ms, zustand("eins"), now);
  Db.speichern(ms, zustand("zwei"), now);
  assert.equal(JSON.parse(ms.getItem(Db.BACKUP_KEY)!).boot, "eins");
  assert.equal(JSON.parse(ms.getItem(Db.KEY)!).boot, "zwei");
});

test("[REQ-DUEL-003] Korrupter Hauptstand → Backup mit Warnung", () => {
  const ms = new MemStorage();
  Db.speichern(ms, zustand("eins"), now);
  Db.speichern(ms, zustand("zwei"), now);
  ms.setItem(Db.KEY, "{kaputt");
  const r = Db.laden(ms, now);
  assert.equal(r.warnung, "backup");
  assert.equal(r.state.boot, "eins");
});

test("[REQ-DUEL-003] Haupt- und Backup kaputt → Reset mit Warnung, Rohdaten bleiben gesichert", () => {
  const ms = new MemStorage();
  ms.setItem(Db.KEY, "müll");
  ms.setItem(Db.BACKUP_KEY, "[1,2]");
  const r = Db.laden(ms, now);
  assert.equal(r.warnung, "reset");
  assert.deepEqual(r.state.crew, []);
  assert.equal(ms.getItem(Db.KEY + ".defekt"), "müll");
});

test("[REQ-DUEL-003] Strukturell ungültiger Zustand (12 Personen) gilt als kaputt", () => {
  const ms = new MemStorage();
  const s: Record<string, unknown> = zustand();
  s.crew = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  ms.setItem(Db.KEY, JSON.stringify(s));
  assert.equal(Db.laden(ms, now).warnung, "reset");
});

test("[REQ-DUEL-003] Neuere Version als bekannt: nichts überschreiben, Warnung „zu-neu“", () => {
  const ms = new MemStorage();
  const roh = JSON.stringify({ ...zustand(), version: 99 });
  ms.setItem(Db.KEY, roh);
  const r = Db.laden(ms, now);
  assert.equal(r.warnung, "zu-neu");
  assert.equal(ms.getItem(Db.KEY + ".defekt"), roh);
});

test("[REQ-DUEL-003] Version 0 (ohne Feld) wird migriert, Warnung „migriert“", () => {
  const ms = new MemStorage();
  const alt: Record<string, unknown> = zustand(); delete alt.version;
  ms.setItem(Db.KEY, JSON.stringify(alt));
  const r = Db.laden(ms, now);
  assert.equal(r.warnung, "migriert");
  assert.equal(r.state.version, 1);
});

test("[REQ-DUEL-003] Speicherfehler (Quota) wird gemeldet, nicht verschluckt; alter Stand bleibt", () => {
  const ms = new MemStorage();
  Db.speichern(ms, zustand("alt"), now);
  ms.failWrites = true;
  const r = Db.speichern(ms, zustand("neu"), now);
  assert.equal(r.ok, false);
  assert.match(r.fehler ?? "", /Quota|voll/i);
  assert.equal(JSON.parse(ms.getItem(Db.KEY)!).boot, "alt");
});

test("[REQ-DUEL-003] Verify-nach-Schreiben: stilles Verwerfen wird erkannt", () => {
  const ms = new MemStorage();
  ms.silentDrop = true;
  const r = Db.speichern(ms, zustand(), now);
  assert.equal(r.ok, false);
  assert.match(r.fehler ?? "", /verifiz|abweich/i);
});

test("[REQ-DUEL-003] Storage nicht verfügbar (null/wirft) → Warnung statt Absturz", () => {
  assert.equal(Db.laden(null, now).warnung, "kein-speicher");
  const wirft = { getItem() { throw new Error("blockiert"); }, setItem() { throw new Error("x"); }, removeItem() {} };
  assert.equal(Db.laden(wirft, now).warnung, "kein-speicher");
  assert.equal(Db.speichern(null, zustand(), now).ok, false);
});

test("[REQ-DUEL-004] Export → Import Roundtrip (verlustfrei)", () => {
  let s = St.addPerson(zustand(), "Anna", () => "a1").state;
  s = St.addPerson(s, "Ben", () => "b1").state;
  const text = Db.exportJson(s, now);
  const r = Db.importJson(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.crew, s.crew);
});

test("[REQ-DUEL-004] Import lehnt Müll, falsche App, 12 Personen, neuere Version ab", () => {
  assert.equal(Db.importJson("kein json").ok, false);
  assert.equal(Db.importJson("[]").ok, false);
  assert.equal(Db.importJson(JSON.stringify({ app: "andere", daten: zustand() })).ok, false);
  const viele: Record<string, unknown> = zustand();
  viele.crew = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  assert.equal(Db.importJson(Db.exportJson(viele, now)).ok, false);
  const neu = JSON.parse(Db.exportJson(zustand(), now)); neu.daten.version = 99;
  assert.equal(Db.importJson(JSON.stringify(neu)).ok, false);
});

test("[REQ-DUEL-004] Dateinamen ohne Jahreszahl", () => {
  for (const art of ["backup", "rangliste", "bewertungen"] as const) {
    const n = Db.dateiname(art);
    assert.doesNotMatch(n, /(19|20)\d{2}/);
    assert.match(n, /^toern-duell-/);
  }
  assert.match(Db.dateiname("backup"), /\.json$/);
  assert.match(Db.dateiname("rangliste"), /\.csv$/);
});

test("[REQ-DUEL-003] Backup-Alter: Tage seit letztem Export (null wenn nie)", () => {
  const s = zustand();
  assert.equal(Db.backupAlterTage(s, now), null);
  const mitBackup = { ...s, meta: { letztesBackup: now() - 3 * 86_400_000 } };
  assert.equal(Db.backupAlterTage(mitBackup, now), 3);
});
