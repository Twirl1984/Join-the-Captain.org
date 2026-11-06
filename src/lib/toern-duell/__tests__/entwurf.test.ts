// Unit-Tests der Bewertungs-Formularlogik.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import * as E from "../../../../public/toern-duell/entwurf.js";

const voll = (e: ReturnType<typeof E.neuerEntwurf>, s = [3, 3, 3], f = [3, 3, 3]) => ({
  ...e, rudergaenger: "a", bewerter: "b",
  selbst: { kommunikation: s[0], crew: s[1], steuerung: s[2] }, fremd: { kommunikation: f[0], crew: f[1], steuerung: f[2] },
});

test("[REQ-DUEL-001] Entwurf: Karte aus URL, ungültige Karte → leer", () => {
  assert.equal(E.neuerEntwurf("14").karte, 14);
  assert.equal(E.neuerEntwurf(undefined).karte, null);
  assert.equal(E.neuerEntwurf("16").karte, null);
  assert.equal(E.neuerEntwurf("x").karte, null);
});

test("[REQ-DUEL-001] Vorschau erst bei allen sechs Werten; 0 zählt als gesetzt", () => {
  const e = E.neuerEntwurf("1");
  assert.equal(E.vorschau(e), null);
  assert.equal(E.vorschau({ ...e, selbst: { kommunikation: 1, crew: 1 }, fremd: { kommunikation: 1, crew: 1, steuerung: 1 } }), null);
  const v = E.vorschau(voll(e, [0, 0, 0], [0, 0, 0]));
  assert.deepEqual([v?.selbstSumme, v?.fremdSumme, v?.bonus, v?.punkte], [0, 0, 3, 3]);
});

test("[REQ-DUEL-001] Vorschau stimmt mit Wertungslogik überein (Beispiel 12 vs 9 → Bonus 1, 10 Punkte)", () => {
  const v = E.vorschau(voll(E.neuerEntwurf("14"), [4, 4, 4], [3, 3, 3]));
  assert.deepEqual([v?.bonus, v?.punkte], [1, 10]);
});

test("[REQ-DUEL-001] entwurfFehler: Reihenfolge der Pflichtangaben und Selbstbewertung", () => {
  const e = E.neuerEntwurf(undefined);
  assert.equal(E.entwurfFehler(e), "karte");
  assert.equal(E.entwurfFehler({ ...e, karte: 1 }), "rudergaenger");
  assert.equal(E.entwurfFehler({ ...e, karte: 1, rudergaenger: "a" }), "bewerter");
  assert.equal(E.entwurfFehler({ ...e, karte: 1, rudergaenger: "a", bewerter: "a" }), "selbst-bewertung");
  assert.equal(E.entwurfFehler({ ...e, karte: 1, rudergaenger: "a", bewerter: "b" }), "unvollstaendig");
  assert.equal(E.entwurfFehler(voll({ ...e, karte: 1 })), null);
});

test("[REQ-DUEL-001] Bewerter-Optionen schließen den Rudergänger aus; Versuch ↔ Entwurf verlustfrei", () => {
  const crew = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  assert.deepEqual(E.bewerterOptionen(crew, "a").map((p: { id: string }) => p.id), ["b"]);
  const v = { karte: 5, rudergaenger: "a", bewerter: null, notiz: "ok", selbst: { kommunikation: 1, crew: 2, steuerung: 3 }, fremd: { kommunikation: 3, crew: 2, steuerung: 1 } };
  const e = E.entwurfAusVersuch(v);
  assert.equal(e.bewerter, "");
  assert.deepEqual(E.entwurfAlsVersuch({ ...e, bewerter: "b", notiz: "  ok " }).fremd, v.fremd);
  assert.equal(E.entwurfAlsVersuch({ ...e, notiz: "  ok " }).notiz, "ok");
});
