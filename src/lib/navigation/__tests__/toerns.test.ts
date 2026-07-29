// toerns.test.ts — Unit-Tests für Törn-Presets [REQ-NAV-028]
//
// Tests laufen mit: npm run test -- src/lib/navigation/__tests__/toerns.test.ts

import assert from "node:assert";
import { test } from "node:test";
import { TOERNS, toernsFuerRevier, validateToern } from "../toerns";
import { getNavRevier } from "../reviere";

test("[REQ-NAV-028] TOERNS existieren und sind nicht leer", () => {
  assert(Array.isArray(TOERNS), "TOERNS muss ein Array sein");
  assert(TOERNS.length > 0, "TOERNS muss mindestens einen Törn enthalten");
});

test("[REQ-NAV-028] jeder Törn hat alle erforderlichen Felder", () => {
  for (const toern of TOERNS) {
    assert(typeof toern.id === "string" && toern.id.length > 0, `Törn muss id haben`);
    assert(typeof toern.label === "string" && toern.label.length > 0, `Törn muss label haben`);
    assert(
      typeof toern.revierId === "string" && toern.revierId.length > 0,
      `Törn muss revierId haben`,
    );
    assert(
      typeof toern.beschreibung === "string" && toern.beschreibung.length > 0,
      `Törn muss beschreibung haben`,
    );
    assert(Array.isArray(toern.wegpunkte), `Törn muss wegpunkte-Array haben`);
  }
});

test("[REQ-NAV-015] Reviere der Törns existieren", () => {
  for (const toern of TOERNS) {
    const revier = getNavRevier(toern.revierId);
    assert(revier !== undefined, `Revier '${toern.revierId}' von Törn '${toern.id}' existiert nicht`);
  }
});

test("[REQ-NAV-015] jeder Törn hat 3..8 Wegpunkte", () => {
  for (const toern of TOERNS) {
    const count = toern.wegpunkte.length;
    assert(count >= 3 && count <= 8, `Törn '${toern.id}' hat ${count} Wegpunkte (sollte 3..8 sein)`);
  }
});

test("[REQ-NAV-015] alle Wegpunkte liegen in der Revier-bbox", () => {
  for (const toern of TOERNS) {
    const revier = getNavRevier(toern.revierId);
    assert(revier !== undefined, `Revier '${toern.revierId}' sollte existieren`);

    const [south, west, north, east] = revier.bbox;
    for (const wp of toern.wegpunkte) {
      const inBbox =
        wp.lat >= south && wp.lat <= north && wp.lon >= west && wp.lon <= east;
      assert(
        inBbox,
        `Wegpunkt '${wp.name}' [${wp.lat}, ${wp.lon}] liegt NICHT in bbox ` +
          `[${south}, ${west}, ${north}, ${east}] von Revier '${toern.revierId}'`,
      );
    }
  }
});

test("[REQ-NAV-015] reiseblogUrl ist https oder undefined", () => {
  for (const toern of TOERNS) {
    if (toern.reiseblogUrl !== undefined) {
      assert(
        toern.reiseblogUrl.startsWith("https://"),
        `Törn '${toern.id}': reiseblogUrl muss https sein (got: ${toern.reiseblogUrl})`,
      );
    }
  }
});

test("[REQ-NAV-015] toernsFuerRevier filtert korrekt", () => {
  // Es sollte mindestens einen Törn mit revierId "daenische-suedsee" geben
  const ds = toernsFuerRevier("daenische-suedsee");
  assert(ds.length > 0, "Es sollte mindestens einen Börn in daenische-suedsee geben");
  assert(
    ds.every((t) => t.revierId === "daenische-suedsee"),
    "toernsFuerRevier sollte nur Törns des Reviers zurückgeben",
  );

  // Für ein nicht-vorhandenes Revier sollte leeres Array kommen
  const none = toernsFuerRevier("nicht-vorhanden");
  assert.deepStrictEqual(none, [], "Nicht vorhandenes Revier -> leeres Array");
});

test("[REQ-NAV-015] validateToern erkennt fehlerhafte Törns", () => {
  // Ein Törn mit nicht-existierendem Revier
  const invalid1 = {
    id: "test-invalid",
    label: "Test",
    revierId: "nicht-vorhanden",
    beschreibung: "Test",
    wegpunkte: [
      { name: "P1", lat: 50.0, lon: 10.0 },
      { name: "P2", lat: 50.1, lon: 10.1 },
      { name: "P3", lat: 50.2, lon: 10.2 },
    ],
  };
  const errs1 = validateToern(invalid1);
  assert(errs1.length > 0, "validateToern sollte Fehler für nicht-existierendes Revier melden");

  // Ein Törn mit zu wenigen Wegpunkten
  const invalid2 = {
    id: "test-too-few",
    label: "Test",
    revierId: "daenische-suedsee",
    beschreibung: "Test",
    wegpunkte: [
      { name: "P1", lat: 55.0, lon: 10.0 },
      { name: "P2", lat: 55.1, lon: 10.1 },
    ],
  };
  const errs2 = validateToern(invalid2);
  assert(errs2.length > 0, "validateToern sollte Fehler für zu wenige Wegpunkte melden");

  // Ein gültiger Törn sollte keine Fehler haben
  const valid = TOERNS[0];
  const errsValid = validateToern(valid);
  assert.deepStrictEqual(
    errsValid,
    [],
    `Gültiger Törn '${valid.id}' sollte keine Fehler haben`,
  );
});
