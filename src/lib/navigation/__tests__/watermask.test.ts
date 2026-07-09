// Unit-Tests für die Wasser/Land-Bitmaske (watermask.ts) — TDD: zuerst geschrieben.
// Lauf: node --import tsx --test src/lib/navigation/__tests__/watermask.test.ts
//
// Die Maske ist ein Gitter über einer bbox: Bit=1 heißt Wasser. Sie wird vom
// Maskengenerator (GEBCO) erzeugt, als base64-JSON gespeichert und vom
// A*-Router (searoute.ts) befahren. Sicherheitsprinzip: alles außerhalb der
// bbox und alles Unbekannte gilt als LAND (nie "im Zweifel Wasser").

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMask,
  isWaterAt,
  cellOf,
  cellCenter,
  encodeMask,
  decodeMask,
  nearestWaterCell,
  type Bbox,
} from "../watermask";

const BBOX: Bbox = [50, 5, 51, 7]; // Süd 50, West 5, Nord 51, Ost 7

test("createMask ruft das Prädikat für Zellmitten auf und speichert Bits", () => {
  // Westhälfte Wasser, Osthälfte Land.
  const mask = createMask(BBOX, 10, 20, (_lat, lon) => lon < 6);
  assert.equal(mask.rows, 10);
  assert.equal(mask.cols, 20);
  assert.ok(isWaterAt(mask, 50.5, 5.5), "Westhälfte muss Wasser sein");
  assert.ok(!isWaterAt(mask, 50.5, 6.5), "Osthälfte muss Land sein");
});

test("außerhalb der bbox gilt immer als Land (Sicherheitsprinzip)", () => {
  const mask = createMask(BBOX, 4, 4, () => true); // alles Wasser
  assert.ok(!isWaterAt(mask, 49.99, 6), "südlich außerhalb");
  assert.ok(!isWaterAt(mask, 51.01, 6), "nördlich außerhalb");
  assert.ok(!isWaterAt(mask, 50.5, 4.99), "westlich außerhalb");
  assert.ok(!isWaterAt(mask, 50.5, 7.01), "östlich außerhalb");
});

test("cellOf und cellCenter sind konsistent (Runden aufs eigene Zentrum)", () => {
  const mask = createMask(BBOX, 8, 16, () => true);
  for (const [r, c] of [
    [0, 0],
    [7, 15],
    [3, 9],
  ] as const) {
    const ctr = cellCenter(mask, r, c);
    const back = cellOf(mask, ctr.lat, ctr.lon);
    assert.deepEqual(back, { row: r, col: c }, `Zelle (${r},${c}) roundtrip`);
  }
  assert.equal(cellOf(mask, 49, 6), null, "außerhalb -> null");
});

test("encode/decode: Roundtrip erhält bbox, Maße und jedes Bit", () => {
  // Pseudo-zufälliges, aber deterministisches Muster.
  const mask = createMask(BBOX, 13, 31, (lat, lon) => Math.sin(lat * 37 + lon * 91) > 0);
  const enc = encodeMask(mask);
  assert.equal(typeof enc.data_b64, "string");
  const dec = decodeMask(enc);
  assert.deepEqual(dec.bbox, mask.bbox);
  assert.equal(dec.rows, mask.rows);
  assert.equal(dec.cols, mask.cols);
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const ctr = cellCenter(mask, r, c);
      assert.equal(
        isWaterAt(dec, ctr.lat, ctr.lon),
        isWaterAt(mask, ctr.lat, ctr.lon),
        `Bit (${r},${c}) nach Roundtrip verändert`,
      );
    }
  }
});

test("decodeMask lehnt kaputte Daten sauber ab", () => {
  assert.throws(() => decodeMask({ bbox: [1, 2, 0, 3], rows: 4, cols: 4, data_b64: "" }));
  assert.throws(() => decodeMask({ bbox: BBOX, rows: 0, cols: 4, data_b64: "" }));
  assert.throws(() =>
    // zu kurze Bitdaten für rows*cols
    decodeMask({ bbox: BBOX, rows: 100, cols: 100, data_b64: "AAAA" }),
  );
});

test("nearestWaterCell: findet nächste Wasserzelle, null wenn keine im Radius", () => {
  // Nur eine Wasserspalte ganz im Westen.
  const mask = createMask(BBOX, 10, 20, (_lat, lon) => lon < 5.1);
  const onLand = cellOf(mask, 50.5, 6.9)!;
  assert.ok(onLand, "Testpunkt muss in der Maske liegen");
  const near = nearestWaterCell(mask, 50.5, 5.15, 3);
  assert.ok(near, "Wasserzelle direkt daneben muss gefunden werden");
  const ctr = cellCenter(mask, near!.row, near!.col);
  assert.ok(isWaterAt(mask, ctr.lat, ctr.lon));
  assert.equal(nearestWaterCell(mask, 50.5, 6.9, 2), null, "weit weg -> null im kleinen Radius");
});
