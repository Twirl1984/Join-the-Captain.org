// Teilwertungen: Ergebnisse auch zeigen, wenn Manöver ODER Landgang fehlt (Golden, von Hand gerechnet).
import { test } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import * as S from "../../../../public/toern-duell/scoring.js";
import * as U from "../../../../public/toern-duell/ueberblick.js";
import { referenzSzenario, zufallsSzenario } from "./support/orakel";

const karten = JSON.parse(fs.readFileSync("public/toern-duell/cards.json", "utf8"));
const ref = referenzSzenario();
const zustand = (versuche = ref.versuche, landgang: unknown = ref.landgang, crew = ref.crew) => ({ boot: "Akilina", crew, versuche, landgang });
const plaetze = (l: { name: string; platz: number; punkte: number }[]) => l.map((z) => [z.name, z.punkte, z.platz]);

test("[REQ-DUEL-007] Referenz vollständig: Teilranglisten Manöver C90 E81 A76 B27 D0 · Landgang A11 B10 C7 E6 D1", () => {
  assert.deepEqual(plaetze(S.teilrangliste(ref.crew, ref.versuche, ref.landgang, "manoever")), [["C", 90, 1], ["E", 81, 2], ["A", 76, 3], ["B", 27, 4], ["D", 0, 5]]);
  assert.deepEqual(plaetze(S.teilrangliste(ref.crew, ref.versuche, ref.landgang, "landgang")), [["A", 11, 1], ["B", 10, 2], ["C", 7, 3], ["E", 6, 4], ["D", 1, 5]]);
  const f = S.fortschritt(ref.crew, ref.versuche, ref.landgang);
  assert.deepEqual(f.manoever.personenUnterMin, ["B", "D"]);
  assert.equal(f.vollstaendig, false); // B und D unter 5 Karten
  assert.deepEqual(U.fehlendes(f), ["Manöver: unter 5 Karten bei B, D."]);
});

test("[REQ-DUEL-007] Nur Landgang erfasst (kein Manöver): Gesamt = Landgang, Teil-Manöver leer, Hinweis", () => {
  const rl = S.rangliste(ref.crew, [], ref.landgang);
  assert.deepEqual(rl.map((z: { id: string; gesamt: number; platz: number }) => [z.id, z.gesamt, z.platz]), [["A", 11, 1], ["B", 10, 2], ["C", 7, 3], ["E", 6, 4], ["D", 1, 5]]);
  assert.deepEqual(S.teilrangliste(ref.crew, [], ref.landgang, "manoever"), []);
  assert.equal(S.teilrangliste(ref.crew, [], ref.landgang, "landgang").length, 5);
  const f = S.fortschritt(ref.crew, [], ref.landgang);
  assert.equal(f.manoever.erfasst, false);
  assert.deepEqual(U.fehlendes(f), ["Manöver: noch keine Bewertung erfasst."]);
});

test("[REQ-DUEL-007] Nur Manöver erfasst (kein Landgang): Gesamt = Manöver, Teil-Landgang leer, Hinweis", () => {
  const rl = S.rangliste(ref.crew, ref.versuche, {});
  assert.deepEqual(rl.map((z: { id: string; gesamt: number; platz: number }) => [z.id, z.gesamt, z.platz]), [["C", 90, 1], ["E", 81, 2], ["A", 76, 3], ["B", 27, 4], ["D", 0, 5]]);
  assert.deepEqual(S.teilrangliste(ref.crew, ref.versuche, {}, "landgang"), []);
  assert.deepEqual(U.fehlendes(S.fortschritt(ref.crew, ref.versuche, {})), ["Manöver: unter 5 Karten bei B, D.", "Landgang: noch nichts erfasst."]);
});

test("[REQ-DUEL-002] Landgang-Teilstatus: nur Geocaching → A2, alle anderen 0 teilen Platz 2; Hinweis nennt fehlende Disziplinen", () => {
  const lg = { geocache: { A: 1 } };
  assert.deepEqual(S.landgangStatus(lg), { seilziehen: false, muell: false, geocache: true, erfasst: true });
  assert.deepEqual(plaetze(S.teilrangliste(ref.crew, [], lg, "landgang")), [["A", 2, 1], ["B", 0, 2], ["C", 0, 2], ["D", 0, 2], ["E", 0, 2]]);
  assert.deepEqual(U.fehlendes(S.fortschritt(ref.crew, [], lg)), ["Manöver: noch keine Bewertung erfasst.", "Landgang: Seilziehen, Müllsammeln noch nicht erfasst."]);
});

test("[REQ-DUEL-002] Randfälle Landgang-Erfassung: 0 Caches ≠ erfasst; Runde ohne Gewinner = erfasst; nur skurril = Müll erfasst", () => {
  assert.equal(S.landgangStatus({ geocache: { A: 0 } }).erfasst, false);
  assert.equal(S.landgangStatus({ seilziehen: [{ gewinner: null }] }).seilziehen, true);
  assert.equal(S.landgangStatus({ muell: { platz1: null, platz2: null, platz3: null, skurril: { person: "A", fund: "x" } } }).muell, true);
  assert.deepEqual(S.landgangStatus(undefined), { seilziehen: false, muell: false, geocache: false, erfasst: false });
});

test("[REQ-DUEL-007] Vollständig: alle Personen ≥5 Karten + alle drei Landgang-Disziplinen → vollstaendig, kein Hinweis", () => {
  const crew = [{ id: "A", name: "A" }, { id: "B", name: "B" }];
  const v = [1, 2, 3, 4, 5].flatMap((k) => ["A", "B"].map((p) => ({ karte: k, rudergaenger: p, bewerter: p === "A" ? "B" : "A", selbst: { kommunikation: 3, crew: 3, steuerung: 3 }, fremd: { kommunikation: 3, crew: 3, steuerung: 3 } })));
  const lg = { seilziehen: [{ gewinner: "A" }], muell: { platz1: "B", platz2: null, platz3: null, skurril: null }, geocache: { A: 1 } };
  const f = S.fortschritt(crew, v, lg);
  assert.equal(f.vollstaendig, true);
  assert.deepEqual(U.fehlendes(f), []);
  assert.equal(U.ueberblickDaten({ boot: "X", crew, versuche: v, landgang: lg }, karten).vorlaeufig, false);
});

test("[REQ-DUEL-007] Leere Crew / ganz leerer Stand: keine Abstürze, leere Listen, nicht vollständig", () => {
  const leer = zustand([], {}, []);
  const d = U.ueberblickDaten(leer, karten);
  assert.deepEqual([d.gesamt, d.manoever, d.landgang], [[], [], []]);
  assert.equal(d.fortschritt.vollstaendig, false);
  assert.equal(d.karten.length, 15);
  assert.ok(d.karten.every((k: { gefahren: number; von: number }) => k.gefahren === 0 && k.von === 0));
  assert.doesNotThrow(() => U.ueberblickHtml(d));
});

test("[REQ-DUEL-007] Überblick-Daten Referenz: Karten-Fortschritt (K1: A,C,E=3/5 · K2: A,C,E=3/5 · K14: B=1/5 · K15: 0/5)", () => {
  const d = U.ueberblickDaten(zustand(), karten);
  const g = Object.fromEntries(d.karten.map((k: { id: number; gefahren: number }) => [k.id, k.gefahren]));
  assert.deepEqual([g[1], g[2], g[5], g[6], g[7], g[10], g[11], g[14], g[15]], [3, 3, 3, 2, 1, 1, 1, 1, 0]);
  // K5: A,C,E · K6: A,E · K7: nur A
  assert.equal(d.vorlaeufig, true);
});

test("[REQ-DUEL-004] Überblick-HTML: eigenständig, skriptfrei, Namen escaped, Zwischenstand markiert", () => {
  const crew = [{ id: "x", name: "<script>alert(1)</script>" }, { id: "y", name: 'Tom & "Jerry"' }];
  const html = U.ueberblickHtml(U.ueberblickDaten({ boot: "<b>Boot</b>", crew, versuche: [], landgang: {} }, karten));
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<b>Boot/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Tom &amp; &quot;Jerry&quot;/);
  assert.match(html, /Zwischenstand/);
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test("[REQ-DUEL-007] Teilranglisten über 300 Zufalls-Szenarien: Gesamt = Manöver-Teil + Landgang-Teil, wo beide erfasst sind", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const sz = zufallsSzenario(seed);
    const rl = S.rangliste(sz.crew, sz.versuche, sz.landgang);
    const m = new Map(S.teilrangliste(sz.crew, sz.versuche, sz.landgang, "manoever").map((z: { id: string; punkte: number }) => [z.id, z.punkte]));
    const l = new Map(S.teilrangliste(sz.crew, sz.versuche, sz.landgang, "landgang").map((z: { id: string; punkte: number }) => [z.id, z.punkte]));
    for (const z of rl) assert.equal(z.gesamt, Number(m.get(z.id) ?? 0) + Number(l.get(z.id) ?? 0), `Seed ${seed} ${z.id}`);
  }
});
