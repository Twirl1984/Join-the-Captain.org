// Unit-Tests für die Reviere-Hierarchie (reviere.ts) — TDD: zuerst geschrieben.
// Lauf: node --import tsx --test src/lib/navigation/__tests__/reviere.test.ts
//
// Die Navigation ersetzt das flache Dropdown durch GRUPPEN (Nordsee, Ostsee,
// Mittelmeer, Binnen) mit je mehreren Revieren. Jedes Revier hat eine bbox
// (für Wassermaske + Kartenausschnitt), Center/Zoom und Häfen.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REVIER_GRUPPEN,
  alleReviere,
  getNavRevier,
  gruppeVon,
  sucheReviere,
  inBbox,
  type NavRevier,
} from "../reviere";

test("es gibt mindestens die Gruppen Nordsee, Ostsee, Mittelmeer und Binnen", () => {
  const ids = REVIER_GRUPPEN.map((g) => g.id);
  for (const wanted of ["nordsee", "ostsee", "mittelmeer", "binnen"]) {
    assert.ok(ids.includes(wanted), `Gruppe ${wanted} fehlt (vorhanden: ${ids.join(", ")})`);
  }
});

test("jede Gruppe hat Label und mindestens ein Revier", () => {
  for (const g of REVIER_GRUPPEN) {
    assert.ok(g.label.length > 2, `Gruppe ${g.id} ohne Label`);
    assert.ok(g.reviere.length >= 1, `Gruppe ${g.id} ist leer`);
  }
});

test("alle Revier- und Gruppen-IDs sind global eindeutig", () => {
  const seen = new Set<string>();
  for (const g of REVIER_GRUPPEN) {
    assert.ok(!seen.has(g.id), `doppelte ID ${g.id}`);
    seen.add(g.id);
    for (const r of g.reviere) {
      assert.ok(!seen.has(r.id), `doppelte ID ${r.id}`);
      seen.add(r.id);
    }
  }
});

function checkRevier(r: NavRevier) {
  const [s, w, n, e] = r.bbox;
  assert.ok(s < n, `${r.id}: bbox Süd ${s} >= Nord ${n}`);
  assert.ok(w < e, `${r.id}: bbox West ${w} >= Ost ${e}`);
  assert.ok(s >= -90 && n <= 90 && w >= -180 && e <= 180, `${r.id}: bbox außerhalb der Welt`);
  assert.ok(r.zoom >= 6 && r.zoom <= 15, `${r.id}: unplausibler Zoom ${r.zoom}`);
  assert.ok(
    inBbox(r.center[0], r.center[1], r.bbox),
    `${r.id}: center liegt nicht in der eigenen bbox`,
  );
}

test("jedes Revier hat konsistente bbox, Center im Kasten und plausiblen Zoom", () => {
  for (const r of alleReviere()) checkRevier(r);
});

test("jedes Revier hat >= 3 Häfen, alle innerhalb der bbox", () => {
  for (const r of alleReviere()) {
    assert.ok(r.haefen.length >= 3, `${r.id}: nur ${r.haefen.length} Häfen`);
    for (const h of r.haefen) {
      assert.ok(Number.isFinite(h.lat) && Number.isFinite(h.lon), `${r.id}/${h.name}: NaN`);
      assert.ok(inBbox(h.lat, h.lon, r.bbox), `${r.id}: Hafen ${h.name} außerhalb der bbox`);
    }
  }
});

test("getNavRevier findet per ID, unbekannte ID -> undefined", () => {
  const alle = alleReviere();
  assert.ok(alle.length >= 8, `zu wenige Reviere: ${alle.length}`);
  const first = alle[0];
  assert.equal(getNavRevier(first.id)?.id, first.id);
  assert.equal(getNavRevier("gibt-es-nicht"), undefined);
});

test("gruppeVon liefert die Gruppe eines Reviers", () => {
  for (const g of REVIER_GRUPPEN) {
    for (const r of g.reviere) {
      assert.equal(gruppeVon(r.id)?.id, g.id, `${r.id} nicht in ${g.id} gefunden`);
    }
  }
  assert.equal(gruppeVon("gibt-es-nicht"), undefined);
});

test("die bewährten /wetter-Reviere leben als Navigation-Reviere weiter", () => {
  // Rügen/Ostsee, Istrien, Dalmatien und Brombachsee waren die Start-Reviere
  // des Wetter-Tools — die Navigation deckt sie weiter ab (Suche über Häfen).
  for (const hafen of ["Stralsund", "Pula", "Split", "Ramsberg"]) {
    assert.ok(sucheReviere(hafen).length >= 1, `Suchtreffer für ${hafen} fehlt`);
  }
});

test("sucheReviere matcht Label, Gruppenname und Hafenname, case-insensitiv", () => {
  const byLabel = sucheReviere("dalmatien");
  assert.ok(byLabel.some((r) => r.id.includes("dalmatien")), "Label-Match fehlt");

  const byGruppe = sucheReviere("MITTELMEER");
  assert.ok(byGruppe.length >= 2, "Gruppen-Match sollte alle Mittelmeer-Reviere liefern");

  const byHafen = sucheReviere("palma");
  assert.ok(byHafen.length >= 1, "Hafen-Match (Palma) fehlt");

  assert.deepEqual(sucheReviere("zzz-nirgendwo"), []);
  assert.deepEqual(sucheReviere("  "), []);
});

test("Tidenreviere (Nordsee/Wattenmeer) tragen einen Gezeiten-Warnhinweis", () => {
  // Die Wassermasken kennen kein Trockenfallen — im Watt ist Navigation ohne
  // Tidenkenntnis fahrlässig. Challenge-Review-Auflage: Warnhinweis pro Revier.
  const nordsee = REVIER_GRUPPEN.find((g) => g.id === "nordsee")!;
  for (const r of nordsee.reviere) {
    assert.ok(r.warnhinweis, `${r.id}: Warnhinweis fehlt`);
    assert.match(r.warnhinweis!, /Tide|Gezeit|Watt/i, `${r.id}: Hinweis nennt die Tide nicht`);
  }
  // Tidenarme Reviere (Ostsee/Mittelmeer/Binnen) brauchen keinen.
  const ruegen = getNavRevier("ruegen")!;
  assert.equal(ruegen.warnhinweis, undefined);
});

test("inBbox: Ränder zählen als innen, außerhalb nicht", () => {
  const bbox: [number, number, number, number] = [50, 5, 55, 10];
  assert.ok(inBbox(50, 5, bbox));
  assert.ok(inBbox(55, 10, bbox));
  assert.ok(inBbox(52.5, 7.5, bbox));
  assert.ok(!inBbox(49.999, 7.5, bbox));
  assert.ok(!inBbox(52.5, 10.001, bbox));
});
