// Unit-Tests für die Windrichtungs-Anzeige (format.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compassPoint,
  windArrowRotationDeg,
  SEND_ICON_BASE_DEG,
  skyCondition,
  windBarb,
  barbSvgPaths,
  windBarbRotationDeg,
  formatTemp,
  precipInfo,
} from "../format";

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

test("[REQ-WET-015] windBarb: Zerlegung in Wimpel(50)/Vollstrich(10)/Halbstrich(5), auf 5 kn gerundet", () => {
  // Windstille < 3 kn → Kreis (calm), keine Federn.
  assert.deepEqual(windBarb(0), { pennants: 0, fullBarbs: 0, halfBarbs: 0, calm: true });
  assert.deepEqual(windBarb(2), { pennants: 0, fullBarbs: 0, halfBarbs: 0, calm: true });
  // 5 kn = 1 Halbstrich, 10 kn = 1 Vollstrich.
  assert.deepEqual(windBarb(5), { pennants: 0, fullBarbs: 0, halfBarbs: 1, calm: false });
  assert.deepEqual(windBarb(10), { pennants: 0, fullBarbs: 1, halfBarbs: 0, calm: false });
  // 15 kn = 1 Voll + 1 Halb.
  assert.deepEqual(windBarb(15), { pennants: 0, fullBarbs: 1, halfBarbs: 1, calm: false });
  // 50 kn = 1 Wimpel; 65 kn = 1 Wimpel + 1 Voll + 1 Halb.
  assert.deepEqual(windBarb(50), { pennants: 1, fullBarbs: 0, halfBarbs: 0, calm: false });
  assert.deepEqual(windBarb(65), { pennants: 1, fullBarbs: 1, halfBarbs: 1, calm: false });
  // Rundung auf 5: 12 → 10 (1 Voll), 13 → 15 (1 Voll + 1 Halb).
  assert.deepEqual(windBarb(12), { pennants: 0, fullBarbs: 1, halfBarbs: 0, calm: false });
  assert.deepEqual(windBarb(13), { pennants: 0, fullBarbs: 1, halfBarbs: 1, calm: false });
  // Nicht-endliche Eingabe → calm (kein Crash).
  assert.equal(windBarb(NaN).calm, true);
});

test("[REQ-WET-015] barbSvgPaths: Federzahl entspricht der Zerlegung; calm ohne Federn", () => {
  assert.equal(barbSvgPaths(windBarb(0)).length, 0); // calm
  assert.equal(barbSvgPaths(windBarb(5)).length, 1); // 1 Halb
  assert.equal(barbSvgPaths(windBarb(15)).length, 2); // 1 Voll + 1 Halb
  assert.equal(barbSvgPaths(windBarb(65)).length, 3); // Wimpel + Voll + Halb
  // Jeder Pfad ist ein nicht-leerer SVG-`d`-String.
  for (const d of barbSvgPaths(windBarb(65))) assert.match(d, /^M/);
});

test("[REQ-WET-015] windBarbRotationDeg: Schaft zeigt zur Herkunft (Nordwind → oben), normalisiert", () => {
  assert.equal(windBarbRotationDeg(0), 0); // Nordwind → Schaft oben
  assert.equal(windBarbRotationDeg(90), 90); // Ostwind → Schaft nach Osten
  assert.equal(windBarbRotationDeg(180), 180);
  assert.equal(windBarbRotationDeg(450), 90); // > 360 normalisiert
  assert.equal(windBarbRotationDeg(-90), 270); // negativ normalisiert
  // Barb zeigt zur Herkunft, der alte Pfeil zur Flow-Richtung (180° Unterschied).
  for (const from of [0, 45, 90, 200, 315]) {
    const barbDir = windBarbRotationDeg(from); // Endrichtung des Schafts = from
    const arrowDir = (SEND_ICON_BASE_DEG + windArrowRotationDeg(from)) % 360; // = from+180
    assert.equal((arrowDir - barbDir + 360) % 360, 180, `from=${from}`);
  }
});

test("[REQ-WET-016] formatTemp: Rundung auf ganze Grad; null/NaN → null", () => {
  assert.equal(formatTemp(17), "17°");
  assert.equal(formatTemp(17.4), "17°");
  assert.equal(formatTemp(17.6), "18°");
  assert.equal(formatTemp(-1.2), "-1°");
  assert.equal(formatTemp(null), null);
  assert.equal(formatTemp(undefined), null);
  assert.equal(formatTemp(NaN), null);
});

test("[REQ-WET-016] precipInfo: Bänder leicht/mäßig/stark; trocken → null", () => {
  // Trocken (kein Symbol, entlastet die Karte).
  assert.equal(precipInfo(0), null);
  assert.equal(precipInfo(0.09), null);
  assert.equal(precipInfo(null), null);
  assert.equal(precipInfo(undefined), null);
  assert.equal(precipInfo(NaN), null);
  // Bandgrenzen: <0.5 leicht, <4 mäßig, sonst stark.
  assert.equal(precipInfo(0.1)?.key, "leicht");
  assert.equal(precipInfo(0.49)?.key, "leicht");
  assert.equal(precipInfo(0.5)?.key, "mäßig");
  assert.equal(precipInfo(3.9)?.key, "mäßig");
  assert.equal(precipInfo(4)?.key, "stark");
  assert.equal(precipInfo(20)?.key, "stark");
});
