// Unit-Tests der Speicher-Orchestrierung (IndexedDB + localStorage), deterministisch mit Fake-Orten.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import * as St from "../../../../public/toern-duell/state.js";
import * as P from "../../../../public/toern-duell/persistenz.js";

const roh = (rev: number, boot = `b${rev}`) => JSON.stringify({ ...St.leererZustand(), boot, meta: { letztesBackup: null, rev } });
const k = (quelle: string, r: string) => ({ quelle, roh: r });

test("[REQ-DUEL-008] waehleBesten: keine Kandidaten → leerer Zustand ohne Warnung", () => {
  const r = P.waehleBesten([]);
  assert.equal(r.warnung, null);
  assert.deepEqual(r.state.crew, []);
});

test("[REQ-DUEL-008] waehleBesten: höchste Revision gewinnt (localStorage 7 schlägt IndexedDB 5), keine Warnung", () => {
  const r = P.waehleBesten([k("idb", roh(5)), k("ls", roh(7))]);
  assert.equal(r.state.boot, "b7");
  assert.equal(r.quelle, "ls");
  assert.equal(r.warnung, null);
});

test("[REQ-DUEL-008] waehleBesten: Gleichstand → IndexedDB vor localStorage vor Backups (Priorität, deterministisch)", () => {
  assert.equal(P.waehleBesten([k("ls", roh(4, "ls")), k("idb", roh(4, "idb"))]).state.boot, "idb");
  assert.equal(P.waehleBesten([k("ls-backup", roh(4, "bk")), k("ls", roh(4, "ls"))]).state.boot, "ls");
  assert.equal(P.waehleBesten([k("idb-verlauf", roh(4, "vl")), k("ls-backup", roh(4, "bk"))]).state.boot, "bk");
});

test("[REQ-DUEL-008] waehleBesten: ein Ort kaputt, der andere heil → stille Selbstheilung (keine Warnung)", () => {
  const r = P.waehleBesten([k("idb", "{kaputt"), k("ls", roh(3))]);
  assert.equal(r.state.boot, "b3");
  assert.equal(r.warnung, null);
  assert.deepEqual(r.defekt, ["{kaputt"]);
});

test("[REQ-DUEL-008] waehleBesten: beide Hauptorte kaputt, IndexedDB-Verlauf heil → Warnung „backup“", () => {
  const r = P.waehleBesten([k("idb", "x"), k("ls", "[]"), k("idb-verlauf", roh(9)), k("idb-verlauf", roh(8))]);
  assert.equal(r.warnung, "backup");
  assert.equal(r.state.boot, "b9");
});

test("[REQ-DUEL-008] waehleBesten: alles kaputt → „reset“ mit allen Rohdaten in defekt", () => {
  const r = P.waehleBesten([k("idb", "a"), k("ls", "b")]);
  assert.equal(r.warnung, "reset");
  assert.deepEqual(r.defekt, ["a", "b"]);
  assert.deepEqual(r.state.crew, []);
});

test("[REQ-DUEL-008] waehleBesten: neuere Datenversion irgendwo → „zu-neu“, ältere Kandidaten werden NICHT stattdessen genutzt", () => {
  const neu = JSON.stringify({ ...JSON.parse(roh(1)), version: 99 });
  const r = P.waehleBesten([k("idb", neu), k("ls", roh(5))]);
  assert.equal(r.warnung, "zu-neu");
  assert.deepEqual(r.defekt, [neu]);
});

test("[REQ-DUEL-008] waehleBesten: Altstand ohne Version → „migriert“", () => {
  const alt = JSON.parse(roh(2)); delete alt.version;
  const r = P.waehleBesten([k("ls", JSON.stringify(alt))]);
  assert.equal(r.warnung, "migriert");
  assert.equal(r.state.version, 1);
});

test("[REQ-DUEL-008] waehleBesten: Reihenfolge der Kandidaten ändert das Ergebnis nicht", () => {
  const alle = [k("idb", roh(5, "i")), k("ls", roh(5, "l")), k("ls-backup", roh(4, "b")), k("idb-verlauf", roh(3, "v")), k("idb-verlauf", "kaputt")];
  const ref = P.waehleBesten(alle).state.boot;
  for (let i = 0; i < alle.length; i++) {
    const gedreht = [...alle.slice(i), ...alle.slice(0, i)];
    assert.equal(P.waehleBesten(gedreht).state.boot, ref);
    assert.equal(P.waehleBesten([...gedreht].reverse()).state.boot, ref);
  }
  assert.equal(ref, "i");
});

test("[REQ-DUEL-008] ladenAlle: IndexedDB wirft → localStorage liefert; beide Leser fehlen → „kein-speicher“", async () => {
  const a = await P.ladenAlle({ idb: async () => { throw new Error("weg"); }, ls: () => ({ haupt: roh(2), backup: null }) });
  assert.equal(a.state.boot, "b2");
  assert.deepEqual(a.orte, { idb: false, ls: true });
  const b = await P.ladenAlle({ idb: null, ls: null });
  assert.equal(b.warnung, "kein-speicher");
  const c = await P.ladenAlle({ idb: async () => ({ aktuell: roh(6), verlauf: [roh(5)] }), ls: () => { throw new Error("blockiert"); } });
  assert.equal(c.state.boot, "b6");
  assert.deepEqual(c.orte, { idb: true, ls: false });
});

test("[REQ-DUEL-008] speichernAlle: beide ok / ein Ort fällt aus (ok bleibt) / beide fallen aus (ok=false, Fehlertext)", async () => {
  const gut = async () => ({ ok: true });
  const schlecht = async () => ({ ok: false, fehler: "voll" });
  const s = St.leererZustand();
  assert.deepEqual((await P.speichernAlle({ idb: gut, ls: gut }, s)).orte, { idb: true, ls: true });
  const eins = await P.speichernAlle({ idb: schlecht, ls: gut }, s);
  assert.equal(eins.ok, true);
  assert.deepEqual(eins.orte, { idb: false, ls: true });
  assert.match(eins.fehler, /IndexedDB: voll/);
  const keins = await P.speichernAlle({ idb: schlecht, ls: async () => { throw new Error("Quota"); } }, s);
  assert.equal(keins.ok, false);
  assert.match(keins.fehler, /IndexedDB: voll.*Browser-Speicher: Quota/);
  assert.equal((await P.speichernAlle({ idb: null, ls: null }, s)).ok, false);
});

test("[REQ-DUEL-008] speichernAlle: reicht denselben Zustand an beide Orte durch (kein Zustandsverlust)", async () => {
  const gesehen: unknown[] = [];
  const s = { ...St.leererZustand(), boot: "Gleich" };
  await P.speichernAlle({ idb: async (x: unknown) => { gesehen.push(x); return { ok: true }; }, ls: async (x: unknown) => { gesehen.push(x); return { ok: true }; } }, s);
  assert.deepEqual(gesehen, [s, s]);
});
