// Unit-Tests für das Buchten-Ranking nach Abendwind (REQ-EXP-005).
// Lauf: node --import tsx --test src/lib/erlebnis/__tests__/bucht-ranking.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  windSektorAusGrad,
  parseWindschutzSektoren,
  beurteileWindschutz,
  rankeBuchtenNachAbendwind,
} from "../bucht-ranking";
import type { SampleForecast } from "../../weather/route-forecast";
import type { RevierPoi } from "../../types";

function bucht(overrides: Partial<RevierPoi> = {}): RevierPoi {
  return {
    id: "1",
    revier_id: "ruegen",
    typ: "bucht",
    name: "Testbucht",
    lat: 54.5,
    lon: 13.5,
    beschreibung: "Testbucht",
    windschutz_sektoren: null,
    saison_von: null,
    saison_bis: null,
    gueltig_von: null,
    gueltig_bis: null,
    quellen_json: [],
    erlebnis_links_json: null,
    confidence: 0.9,
    score: null,
    score_basis_json: null,
    stand_datum: "2026-07-10",
    status: "live",
    reviewed_am: null,
    created_at: "2026-07-10T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
    ...overrides,
  };
}

function samplerMitWind(windFromDeg: number): SampleForecast {
  return () => ({ wind_speed_kn: 12, wind_from_deg: windFromDeg });
}

// ── windSektorAusGrad ────────────────────────────────────────────────────

test("[REQ-EXP-005] windSektorAusGrad ordnet Kardinalrichtungen korrekt zu", () => {
  assert.equal(windSektorAusGrad(0), "N");
  assert.equal(windSektorAusGrad(45), "NO");
  assert.equal(windSektorAusGrad(90), "O");
  assert.equal(windSektorAusGrad(135), "SO");
  assert.equal(windSektorAusGrad(180), "S");
  assert.equal(windSektorAusGrad(225), "SW");
  assert.equal(windSektorAusGrad(270), "W");
  assert.equal(windSektorAusGrad(315), "NW");
});

test("[REQ-EXP-005] windSektorAusGrad normalisiert ausserhalb 0-360", () => {
  assert.equal(windSektorAusGrad(-10), "N", "negativer Grad wrap-around");
  assert.equal(windSektorAusGrad(370), "N", "ueber 360 wrap-around");
  assert.equal(windSektorAusGrad(720), "N", "mehrfacher Wrap");
});

test("[REQ-EXP-005] windSektorAusGrad an der Sektorgrenze rundet zum naeheren Sektor", () => {
  assert.equal(windSektorAusGrad(22.4), "N");
  assert.equal(windSektorAusGrad(22.6), "NO");
  assert.equal(windSektorAusGrad(337.6), "N", "Wrap-around am 360/0-Uebergang");
});

// ── parseWindschutzSektoren ──────────────────────────────────────────────

test("[REQ-EXP-005] parseWindschutzSektoren liest kommagetrennte Sektoren", () => {
  assert.deepEqual(parseWindschutzSektoren("N,NO,O"), ["N", "NO", "O"]);
});

test("[REQ-EXP-005] parseWindschutzSektoren ist robust gegen Whitespace und Kleinschreibung", () => {
  assert.deepEqual(parseWindschutzSektoren(" n , no ,o "), ["N", "NO", "O"]);
});

test("[REQ-EXP-005] parseWindschutzSektoren ignoriert ungueltige Tokens statt zu crashen", () => {
  assert.deepEqual(parseWindschutzSektoren("N,XYZ,O"), ["N", "O"]);
});

test("[REQ-EXP-005] parseWindschutzSektoren: null/leer ergibt leeres Array", () => {
  assert.deepEqual(parseWindschutzSektoren(null), []);
  assert.deepEqual(parseWindschutzSektoren(""), []);
  assert.deepEqual(parseWindschutzSektoren("   "), []);
});

test("[REQ-EXP-005] parseWindschutzSektoren: nur ungueltige Tokens ergibt leeres Array", () => {
  assert.deepEqual(parseWindschutzSektoren("NORDWEST,MITTE"), []);
});

// ── beurteileWindschutz ──────────────────────────────────────────────────

test("[REQ-EXP-005] beurteileWindschutz: Wind aus geschuetztem Sektor -> geschuetzt", () => {
  assert.equal(beurteileWindschutz({ windschutz_sektoren: "N,NO,O" }, 0), "geschuetzt");
});

test("[REQ-EXP-005] beurteileWindschutz: Wind aus ungeschuetztem Sektor -> exponiert", () => {
  assert.equal(beurteileWindschutz({ windschutz_sektoren: "N,NO,O" }, 180), "exponiert");
});

test("[REQ-EXP-005] beurteileWindschutz: keine Windschutz-Info -> unbekannt", () => {
  assert.equal(beurteileWindschutz({ windschutz_sektoren: null }, 180), "unbekannt");
});

test("[REQ-EXP-005] beurteileWindschutz: nur ungueltige Sektor-Tokens -> unbekannt", () => {
  assert.equal(beurteileWindschutz({ windschutz_sektoren: "XYZ" }, 0), "unbekannt");
});

test("[QA] beurteileWindschutz: NaN/Infinity vom Sampler faellt sicher auf unbekannt zurueck statt faelschlich 'exponiert'", () => {
  // Sicherheits-Asymmetrie (qa-adversarial): ein fehlender/kaputter Wetterwert
  // darf NICHT als "exponiert" (= vermeintlich verlaessliches Negativ-Signal)
  // durchrutschen, sondern muss als 'unbekannt' erkennbar bleiben.
  assert.equal(beurteileWindschutz({ windschutz_sektoren: "N,NO,O" }, NaN), "unbekannt");
  assert.equal(beurteileWindschutz({ windschutz_sektoren: "N,NO,O" }, Infinity), "unbekannt");
  assert.equal(beurteileWindschutz({ windschutz_sektoren: "N,NO,O" }, -Infinity), "unbekannt");
});

test("[QA] windSektorAusGrad: exakte Sektorgrenze 202.5 rundet deterministisch auf SW", () => {
  assert.equal(windSektorAusGrad(202.5), "SW");
});

test("[QA] windSektorAusGrad: exakt 360 wrap-around auf N", () => {
  assert.equal(windSektorAusGrad(360), "N");
});

// ── rankeBuchtenNachAbendwind ─────────────────────────────────────────────

test("[REQ-EXP-005] rankeBuchtenNachAbendwind sortiert geschuetzt vor unbekannt vor exponiert", () => {
  const exponiert = bucht({ id: "exp", name: "Exponiert", windschutz_sektoren: "S" });
  const unbekannt = bucht({ id: "unb", name: "Unbekannt", windschutz_sektoren: null });
  const geschuetzt = bucht({ id: "gut", name: "Geschuetzt", windschutz_sektoren: "N" });

  const ranking = rankeBuchtenNachAbendwind({
    buchten: [exponiert, unbekannt, geschuetzt],
    sampleForecast: samplerMitWind(0), // Wind aus N
    abendZeitpunkt: new Date("2026-07-16T18:00:00Z"),
  });

  assert.deepEqual(
    ranking.map((r) => r.poi.id),
    ["gut", "unb", "exp"],
  );
  assert.equal(ranking[0].schutzKategorie, "geschuetzt");
  assert.equal(ranking[0].windSektor, "N");
  assert.equal(ranking[1].schutzKategorie, "unbekannt");
  assert.equal(ranking[2].schutzKategorie, "exponiert");
});

test("[REQ-EXP-005] rankeBuchtenNachAbendwind ist stabil innerhalb derselben Kategorie (Eingabereihenfolge)", () => {
  const a = bucht({ id: "a", windschutz_sektoren: "N" });
  const b = bucht({ id: "b", windschutz_sektoren: "N" });
  const c = bucht({ id: "c", windschutz_sektoren: "N" });

  const ranking = rankeBuchtenNachAbendwind({
    buchten: [a, b, c],
    sampleForecast: samplerMitWind(0),
    abendZeitpunkt: new Date("2026-07-16T18:00:00Z"),
  });

  assert.deepEqual(
    ranking.map((r) => r.poi.id),
    ["a", "b", "c"],
  );
});

test("[REQ-EXP-005] rankeBuchtenNachAbendwind: leere Liste ergibt leeres Ranking, kein Crash", () => {
  const ranking = rankeBuchtenNachAbendwind({
    buchten: [],
    sampleForecast: samplerMitWind(0),
    abendZeitpunkt: new Date("2026-07-16T18:00:00Z"),
  });
  assert.deepEqual(ranking, []);
});

test("[REQ-EXP-005] rankeBuchtenNachAbendwind filtert Nicht-Bucht-POIs (Hafen/Event) heraus", () => {
  const hafen = bucht({ id: "hafen", typ: "hafen-highlight", windschutz_sektoren: "N" });
  const echt = bucht({ id: "bucht", typ: "bucht", windschutz_sektoren: "N" });

  const ranking = rankeBuchtenNachAbendwind({
    buchten: [hafen, echt],
    sampleForecast: samplerMitWind(0),
    abendZeitpunkt: new Date("2026-07-16T18:00:00Z"),
  });

  assert.deepEqual(
    ranking.map((r) => r.poi.id),
    ["bucht"],
  );
});

test("[REQ-EXP-005] rankeBuchtenNachAbendwind fragt den Sampler zur uebergebenen Abendzeit je Bucht-Position ab", () => {
  const abendZeitpunkt = new Date("2026-07-16T19:00:00Z");
  const gesehen: Array<{ lat: number; lon: number; at: Date }> = [];
  const sampler: SampleForecast = (arg) => {
    gesehen.push(arg);
    return { wind_speed_kn: 10, wind_from_deg: 0 };
  };

  const b1 = bucht({ id: "b1", lat: 54.1, lon: 13.1, windschutz_sektoren: "N" });
  const b2 = bucht({ id: "b2", lat: 54.2, lon: 13.2, windschutz_sektoren: "N" });

  rankeBuchtenNachAbendwind({ buchten: [b1, b2], sampleForecast: sampler, abendZeitpunkt });

  assert.equal(gesehen.length, 2);
  assert.deepEqual(gesehen[0], { lat: 54.1, lon: 13.1, at: abendZeitpunkt });
  assert.deepEqual(gesehen[1], { lat: 54.2, lon: 13.2, at: abendZeitpunkt });
});
