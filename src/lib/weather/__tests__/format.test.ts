// Unit-Tests für die Windrichtungs-Anzeige (format.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compassPoint, windArrowRotationDeg, SEND_ICON_BASE_DEG, skyCondition } from "../format";

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

test("[REQ-WET-014] skyCondition: Bänder klar/heiter/wolkig/bedeckt aus dem Bedeckungsgrad", () => {
  // Bandgrenzen (okta-nah): <13 klar, <38 heiter, <75 wolkig, sonst bedeckt.
  assert.equal(skyCondition(0)?.key, "klar");
  assert.equal(skyCondition(12)?.key, "klar");
  assert.equal(skyCondition(13)?.key, "heiter");
  assert.equal(skyCondition(37)?.key, "heiter");
  assert.equal(skyCondition(38)?.key, "wolkig");
  assert.equal(skyCondition(74)?.key, "wolkig");
  assert.equal(skyCondition(75)?.key, "bedeckt");
  assert.equal(skyCondition(100)?.key, "bedeckt");
});

test("[REQ-WET-014] skyCondition: klar/heiter sind nachtabhängig (Sonne am Tag, Mond nachts)", () => {
  // Kern des Feedbacks: eine wolkenlose NACHT zeigt einen Mond (klare Sicht),
  // statt leer zu wirken; am Tag die Sonne.
  assert.equal(skyCondition(5, true)?.glyph, "☀️");
  assert.equal(skyCondition(5, false)?.glyph, "🌙");
  assert.equal(skyCondition(20, true)?.glyph, "🌤️");
  assert.equal(skyCondition(20, false)?.glyph, "🌙");
  // Wolkig/bedeckt sind tag/nacht gleich (Wolken decken die Sonne/den Mond).
  assert.equal(skyCondition(60, true)?.glyph, skyCondition(60, false)?.glyph);
  assert.equal(skyCondition(90, true)?.glyph, "☁️");
});

test("[REQ-WET-014] skyCondition: ohne Bedeckungsdaten kein Icon; is_day-Default = Tag", () => {
  assert.equal(skyCondition(null), null);
  assert.equal(skyCondition(undefined), null);
  assert.equal(skyCondition(NaN), null);
  // Default (kein is_day) = Tag → Sonne bei klarem Himmel.
  assert.equal(skyCondition(0)?.glyph, "☀️");
  // Fehlt die Tag/Nacht-Info explizit (null), ebenfalls Tag-Annahme.
  assert.equal(skyCondition(0, null)?.glyph, "☀️");
});
