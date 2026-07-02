// Unit-Tests für die Windrichtungs-Anzeige (format.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compassPoint, windArrowRotationDeg, SEND_ICON_BASE_DEG } from "../format";

test("compassPoint: Herkunfts-Kürzel (aus N/O/S/W + Zwischenrichtungen)", () => {
  assert.equal(compassPoint(0), "N");
  assert.equal(compassPoint(45), "NO");
  assert.equal(compassPoint(90), "O");
  assert.equal(compassPoint(180), "S");
  assert.equal(compassPoint(270), "W");
  assert.equal(compassPoint(315), "NW");
  assert.equal(compassPoint(359), "N"); // rundet zur nächsten Richtung
  assert.equal(compassPoint(-90), "W"); // negative Grade normalisiert
});

test("windArrowRotationDeg: Icon zeigt die Flow-Richtung (wohin der Wind weht)", () => {
  // Endrichtung des Icons = Basis (45°) + Rotation; muss windFrom + 180 sein.
  for (const from of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const rot = windArrowRotationDeg(from);
    const final = (SEND_ICON_BASE_DEG + rot) % 360;
    assert.equal(final, (from + 180) % 360, `windFrom=${from}`);
  }
});

test("windArrowRotationDeg: Nordwind → Pfeil zeigt nach Süden (Flow)", () => {
  assert.equal((SEND_ICON_BASE_DEG + windArrowRotationDeg(0)) % 360, 180);
});
