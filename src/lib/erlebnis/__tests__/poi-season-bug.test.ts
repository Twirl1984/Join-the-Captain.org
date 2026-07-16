// Bug-Test für asymmetrische Saison-Filter in poiIstGueltig
// QA Runde 2 Finding: saison_von null, aber saison_bis gesetzt

import { test } from "node:test";
import assert from "node:assert/strict";
import { poiIstGueltig } from "../poi";

test("[QA-R2-BUG] poiIstGueltig: saison_von=null, saison_bis=9 sollte nicht akzeptieren", () => {
  const poi = { saison_von: null, saison_bis: 9, gueltig_von: null, gueltig_bis: null };
  const monat = 5;

  // Aktuell: poiIstGueltig gibt true zurück, weil:
  // if (saison_von != null && saison_bis != null) → false (weil saison_von ist null)
  // Dann return true
  //
  // Das ist BUG: Asymmetrische Saison-Angabe sollte nicht akzeptiert werden
  const result = poiIstGueltig(poi, { monat });

  console.log(`saison_von=null, saison_bis=9, monat=5: ${result}`);
  assert.equal(result, false, "Nur saison_bis ohne saison_von sollte nicht akzeptiert werden");
});

test("[QA-R2-BUG] poiIstGueltig: saison_bis=null, saison_von=5 sollte nicht akzeptieren", () => {
  const poi = { saison_von: 5, saison_bis: null, gueltig_von: null, gueltig_bis: null };
  const monat = 7;

  // Aktuell: poiIstGueltig gibt true zurück, weil:
  // if (saison_von != null && saison_bis != null) → false (weil saison_bis ist null)
  // Dann return true
  //
  // Das ist BUG: Asymmetrische Saison-Angabe sollte nicht akzeptiert werden
  const result = poiIstGueltig(poi, { monat });

  console.log(`saison_von=5, saison_bis=null, monat=7: ${result}`);
  assert.equal(result, false, "Nur saison_von ohne saison_bis sollte nicht akzeptiert werden");
});

test("[QA-R2] poiIstGueltig: monat=0 ist semantisch ungültig", () => {
  const poi = { saison_von: 5, saison_bis: 9, gueltig_von: null, gueltig_bis: null };

  // monat=0 ist semantisch falsch (1-12 ist valid)
  const result = poiIstGueltig(poi, { monat: 0 });

  // Aktuell: gibt true zurück, weil monat=0 nicht im Bereich 5-9 liegt,
  // aber kein monat angefragt → nicht ausschließen... NEIN!
  // Tatsächlich: monat=0 < 5 || monat=0 > 9 → true || false → true → return false
  console.log(`monat=0 (ungültig): ${result}`);
});

test("[QA-R2] poiIstGueltig: monat=13 ist semantisch ungültig", () => {
  const poi = { saison_von: 5, saison_bis: 9, gueltig_von: null, gueltig_bis: null };

  // monat=13 ist semantisch falsch
  const result = poiIstGueltig(poi, { monat: 13 });

  // monat=13 > 9 → true → return false
  console.log(`monat=13 (ungültig): ${result}`);
  assert.equal(result, false, "monat=13 sollte false sein");
});

test("[QA-R2-BUG] poiIstGueltig: gueltig_from > gueltig_until sollte IMMER false sein", () => {
  const poi = { saison_von: null, saison_bis: null, gueltig_von: "2026-08-20", gueltig_bis: "2026-08-10" };

  // Die Fenster sind rückwärts: von ist NACH bis
  // Jedes Datum sollte außerhalb fallen
  const result1 = poiIstGueltig(poi, { datum: "2026-08-15" });
  const result2 = poiIstGueltig(poi, { datum: "2026-08-20" });
  const result3 = poiIstGueltig(poi, { datum: "2026-08-10" });

  console.log(`gueltig_von=20, gueltig_bis=10, datum=15: ${result1}`);
  console.log(`gueltig_von=20, gueltig_bis=10, datum=20: ${result2}`);
  console.log(`gueltig_von=20, gueltig_bis=10, datum=10: ${result3}`);

  // Aktuell:
  // d < gueltig_von (15 < 20) → false (nicht ausgeschlossen)
  // d > gueltig_bis (15 > 10) → true → return false
  // Also: result1 = false (korrekt)
  // result2: 20 < 20 → false, 20 > 10 → true → false (korrekt)
  // result3: 10 < 20 → false, 10 > 10 → false → true (FALSCH!)

  assert.equal(result1, false, "15 sollte außerhalb sein");
  assert.equal(result2, false, "20 sollte außerhalb sein");
  assert.equal(result3, false, "10 sollte auch außerhalb sein (invalid window)");
});
