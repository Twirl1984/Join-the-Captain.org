// Datenqualitäts-Tests für die eingecheckten Wassermasken (masks/) — TDD.
// Lauf: node --import tsx --test src/lib/navigation/__tests__/masks.test.ts
//
// Die Masken werden von scripts/navigation-fetch-watermask.ts aus OSM-
// Küstenlinien (1 km, @geo-maps) erzeugt und als base64-JSON eingecheckt.
// Diese Tests sichern: jede Maske passt zu ihrem Revier, hat plausible
// Wasseranteile, alle Häfen liegen an der Wasserkante — und der Router
// findet über der ECHTEN Maske eine reine Wasserroute zwischen Häfen.

import { test } from "node:test";
import assert from "node:assert/strict";
import { AVAILABLE_MASKS, getMaskForRevier } from "../masks";
import { getNavRevier } from "../reviere";
import { nearestWaterCell, isWaterAt } from "../watermask";
import { findSeaRoute, segmentInWater } from "../searoute";

test("Masken existieren für alle Küsten-Reviere (Binnenseen ausgenommen)", () => {
  // Binnenreviere (Brombachsee, IJsselmeer) sind in OSM-Küstenlinien kein
  // "Meer" — sie brauchen später OSM-Wasserflächen als Quelle.
  const expected = [
    "deutsche-bucht",
    "nordfriesland",
    "ruegen",
    "daenische-suedsee",
    "kieler-bucht",
    "kroatien-istrien",
    "kroatien-dalmatien",
    "balearen",
    "saronischer-golf",
  ];
  for (const id of expected) {
    assert.ok(AVAILABLE_MASKS.includes(id), `Maske für ${id} fehlt`);
  }
});

test("jede Maske dekodiert, deckt die Revier-bbox und hat plausiblen Wasseranteil", () => {
  for (const id of AVAILABLE_MASKS) {
    const revier = getNavRevier(id);
    assert.ok(revier, `Maske ${id} gehört zu keinem Revier`);
    const mask = getMaskForRevier(id);
    assert.ok(mask, `Maske ${id} nicht dekodierbar`);
    assert.deepEqual(mask!.bbox, revier!.bbox, `${id}: Masken-bbox != Revier-bbox`);

    let water = 0;
    const total = mask!.rows * mask!.cols;
    for (let i = 0; i < total; i++) {
      if ((mask!.bits[i >> 3] & (1 << (i & 7))) !== 0) water++;
    }
    const frac = water / total;
    assert.ok(frac > 0.05 && frac < 0.999, `${id}: Wasseranteil ${frac.toFixed(3)} unplausibel`);
  }
});

test("jeder Hafen eines maskierten Reviers liegt an der Wasserkante (<= 5 Zellen)", () => {
  for (const id of AVAILABLE_MASKS) {
    const revier = getNavRevier(id)!;
    const mask = getMaskForRevier(id)!;
    for (const h of revier.haefen) {
      const cell = nearestWaterCell(mask, h.lat, h.lon, 5);
      assert.ok(cell, `${id}: Hafen ${h.name} hat keine Wasserzelle im Umkreis`);
    }
  }
});

test("Routing-Smoke über echter Maske: Sassnitz -> Klintholm bleibt im Wasser", () => {
  const mask = getMaskForRevier("ruegen");
  assert.ok(mask, "ruegen-Maske fehlt");
  const r = findSeaRoute(mask!, { lat: 54.512, lon: 13.643 }, { lat: 54.952, lon: 12.464 });
  assert.equal(r.status, "ok");
  for (let i = 1; i < r.points.length - 1; i++) {
    assert.ok(
      isWaterAt(mask!, r.points[i].lat, r.points[i].lon),
      `Zwischenpunkt ${i} liegt an Land`,
    );
  }
  for (let i = 1; i < r.points.length - 2; i++) {
    assert.ok(
      segmentInWater(mask!, r.points[i], r.points[i + 1]),
      `Segment ${i} schneidet Land`,
    );
  }
});

test("Routing-Smoke Dalmatien: Split -> Hvar muss um Brač/Šolta herum", () => {
  const mask = getMaskForRevier("kroatien-dalmatien");
  assert.ok(mask, "dalmatien-Maske fehlt");
  const split = { lat: 43.503, lon: 16.43 };
  const hvar = { lat: 43.172, lon: 16.443 };
  const r = findSeaRoute(mask!, split, hvar);
  assert.equal(r.status, "ok");
  // Luftlinie wäre ~20 sm quer durch Brač — die Wasserroute ist zwingend länger.
  assert.ok(r.distance_nm! > 21, `Distanz ${r.distance_nm} sm: verdächtig nah an der Luftlinie`);
});

test("unbekanntes Revier -> null statt Fehler", () => {
  assert.equal(getMaskForRevier("gibt-es-nicht"), null);
  assert.equal(getMaskForRevier("brombachsee"), null, "Binnensee hat (noch) keine Maske");
});
