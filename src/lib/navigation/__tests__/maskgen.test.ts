// Unit-Tests für den Maskengenerator (maskgen.ts).
// Lauf: node --import tsx --test src/lib/navigation/__tests__/maskgen.test.ts
//
// Enthält den Regressionsfall zum Kachelgrenzen-Artefakt: OSM-Kacheln stoßen
// auf runden Breitengraden aneinander; fällt eine Scanline exakt auf so eine
// Kante, entstand früher ein Land-Streifen quer durchs offene Meer (Fließkomma-
// kipp in der Zeilenbereichs-Optimierung). Aufgedeckt vom masks-Datenqualitäts-
// Test, hier dauerhaft festgenagelt.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMaskFromLand, gridSize, type Ring } from "../maskgen";
import { isWaterAt } from "../watermask";
import type { Bbox } from "../reviere";

const rect = (s: number, w: number, n: number, e: number): Ring => [
  [w, s],
  [e, s],
  [e, n],
  [w, n],
  [w, s],
];

test("ohne Land ist alles Wasser, ein Landrechteck wird Land", () => {
  const bbox: Bbox = [54, 10, 55, 11];
  const leer = buildMaskFromLand(bbox, [], { rows: 50, cols: 50 });
  assert.ok(isWaterAt(leer, 54.5, 10.5));

  const mitInsel = buildMaskFromLand(bbox, [rect(54.4, 10.4, 54.6, 10.6)], { rows: 50, cols: 50 });
  assert.ok(!isWaterAt(mitInsel, 54.5, 10.5), "Inselmitte muss Land sein");
  assert.ok(isWaterAt(mitInsel, 54.9, 10.9), "abseits der Insel bleibt Wasser");
});

test("Loch im Landpolygon (See) wird per even-odd wieder Wasser", () => {
  const bbox: Bbox = [54, 10, 55, 11];
  const land = rect(54.2, 10.2, 54.8, 10.8);
  const see = rect(54.4, 10.4, 54.6, 10.6);
  const mask = buildMaskFromLand(bbox, [land, see], { rows: 50, cols: 50 });
  assert.ok(!isWaterAt(mask, 54.3, 10.5), "Landring");
  assert.ok(isWaterAt(mask, 54.5, 10.5), "Loch (See) im Land");
});

test("Regressions-Fall Kachelgrenze: Scanline exakt auf horizontaler Kante", () => {
  // bbox so gewählt, dass eine Zellmitten-Breite EXAKT auf 43.2 fällt
  // (wie kroatien-dalmatien: s=42.6, n=43.8, rows=191 -> Zeile 95 = 43.2).
  const bbox: Bbox = [42.6, 15.4, 43.8, 17.3];
  const { rows, cols } = gridSize(bbox);
  // Zwei Land-"Kacheln", die sich bei lat 43.2 berühren — weit im Osten,
  // der Westen (offene See) bleibt polygonfrei.
  const unten = rect(42.8, 16.8, 43.2, 17.2);
  const oben = rect(43.2, 16.8, 43.6, 17.2);
  const mask = buildMaskFromLand(bbox, [unten, oben], { rows, cols });

  // Offene See westlich der Kacheln: KEINE Zeile darf ein Land-Streifen sein.
  for (let lat = 42.7; lat < 43.75; lat += 0.01) {
    assert.ok(isWaterAt(mask, lat, 15.5), `falsches Land bei lat ${lat.toFixed(2)} im offenen Meer`);
  }
  // Die Kacheln selbst sind Land — auch direkt an der Nahtstelle.
  assert.ok(!isWaterAt(mask, 43.1, 17.0), "untere Kachel");
  assert.ok(!isWaterAt(mask, 43.3, 17.0), "obere Kachel");
  assert.ok(!isWaterAt(mask, 43.2001, 17.0), "Naht der Kacheln bleibt Land");
});

test("gridSize: quadratische Zellen (~0.7 km) und Deckel gegen Riesenmasken", () => {
  const { rows, cols } = gridSize([42.6, 15.4, 43.8, 17.3]);
  assert.ok(rows >= 150 && rows <= 250, `rows ${rows}`);
  assert.ok(cols >= 150 && cols <= 300, `cols ${cols}`);
  const huge = gridSize([-60, -180, 60, 180]);
  assert.ok(huge.rows * huge.cols <= 1_200_000, "Deckel greift nicht");
});
