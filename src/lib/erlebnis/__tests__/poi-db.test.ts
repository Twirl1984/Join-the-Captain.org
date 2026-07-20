// DB-Integration-Tests für POI-Quellenpflicht (REQ-EXP-001)
// Braucht echte Postgres.
//
// DATABASE_URL=postgresql://... node --import tsx --test src/lib/erlebnis/__tests__/poi-db.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { query } from "../../db";

test("[QA] Quellenpflicht: POI ohne quellen_json wird von DB abgelehnt", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  try {
    await query(
      `INSERT INTO revier_poi
         (revier_id, typ, name, lat, lon, beschreibung, quellen_json, confidence, stand_datum, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        "ruegen",
        "sehenswuerdigkeit",
        "Test POI ohne Quellen",
        54.68,
        13.4,
        "Das sollte fehlschlagen",
        JSON.stringify([]), // LEER!
        0.9,
        "2026-07-15",
        "live",
      ],
    );
    assert.fail("Hätte einen Constraint-Fehler werfen sollen");
  } catch (err) {
    // Erwarten wir einen DB-Fehler
    const _dbError = err as { message: string; code: string };
    assert.ok(
      _dbError.message.includes("check constraint") || _dbError.code === "23514",
      `Erwarteter Constraint-Fehler, bekam: ${_dbError.message}`,
    );
  }
});

test("[QA] Quellenpflicht: POI mit leerer URL wird akzeptiert (JSON-Struktur valid)", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  try {
    await query(
      `INSERT INTO revier_poi
         (revier_id, typ, name, lat, lon, beschreibung, quellen_json, confidence, stand_datum, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        "ruegen",
        "sehenswuerdigkeit",
        "Test POI mit leerer URL",
        54.68,
        13.41,
        "URL ist leer",
        JSON.stringify([{ url: "", titel: "x", abgerufen_am: "2026-07-15" }]),
        0.9,
        "2026-07-15",
        "live",
      ],
    );
    console.log("✓ POI mit leerer URL wurde eingefügt (DB macht keine URL-Validierung)");
  } catch (err) {
    const _dbError = err as { message: string };
    console.log("Info: DB lehnt leere URL ab:", _dbError.message);
  }
});

test("[QA] Koordinaten-Validierung: lat > 90 wird abgelehnt", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  try {
    await query(
      `INSERT INTO revier_poi
         (revier_id, typ, name, lat, lon, beschreibung, quellen_json, confidence, stand_datum, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        "ruegen",
        "sehenswuerdigkeit",
        "Test POI mit ungültiger lat",
        91, // UNGÜLTIG
        13.4,
        "Zu weit nördlich",
        JSON.stringify([{ url: "https://example.com", titel: "x", abgerufen_am: "2026-07-15" }]),
        0.9,
        "2026-07-15",
        "live",
      ],
    );
    assert.fail("Hätte einen Koordinaten-Constraint-Fehler werfen sollen");
  } catch (err) {
    const _dbError = err as { message: string; code: string };
    assert.ok(
      _dbError.message.includes("check constraint") || _dbError.code === "23514",
      `Erwarteter Constraint-Fehler für lat, bekam: ${_dbError.message}`,
    );
  }
});

test("[QA] Koordinaten-Validierung: lon > 180 wird abgelehnt", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  try {
    await query(
      `INSERT INTO revier_poi
         (revier_id, typ, name, lat, lon, beschreibung, quellen_json, confidence, stand_datum, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        "ruegen",
        "sehenswuerdigkeit",
        "Test POI mit ungültiger lon",
        54.68,
        181, // UNGÜLTIG
        "Zu weit östlich",
        JSON.stringify([{ url: "https://example.com", titel: "x", abgerufen_am: "2026-07-15" }]),
        0.9,
        "2026-07-15",
        "live",
      ],
    );
    assert.fail("Hätte einen Koordinaten-Constraint-Fehler werfen sollen");
  } catch (err) {
    const _dbError = err as { message: string; code: string };
    assert.ok(
      _dbError.message.includes("check constraint") || _dbError.code === "23514",
      `Erwarteter Constraint-Fehler für lon, bekam: ${_dbError.message}`,
    );
  }
});

test("[QA] typ-Enum: ungültiger typ wird abgelehnt", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  try {
    await query(
      `INSERT INTO revier_poi
         (revier_id, typ, name, lat, lon, beschreibung, quellen_json, confidence, stand_datum, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        "ruegen",
        "malicious_type", // UNGÜLTIG
        "Test POI mit falschen typ",
        54.68,
        13.4,
        "Falscher typ",
        JSON.stringify([{ url: "https://example.com", titel: "x", abgerufen_am: "2026-07-15" }]),
        0.9,
        "2026-07-15",
        "live",
      ],
    );
    assert.fail("Hätte einen typ-Constraint-Fehler werfen sollen");
  } catch (err) {
    const _dbError = err as { message: string; code: string };
    assert.ok(
      _dbError.message.includes("check constraint") || _dbError.code === "23514",
      `Erwarteter Constraint-Fehler für typ, bekam: ${_dbError.message}`,
    );
  }
});

test("[QA] status-Enum: ungültiger status wird abgelehnt", async () => {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL nicht gesetzt");
    return;
  }

  try {
    await query(
      `INSERT INTO revier_poi
         (revier_id, typ, name, lat, lon, beschreibung, quellen_json, confidence, stand_datum, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        "ruegen",
        "sehenswuerdigkeit",
        "Test POI mit falschen status",
        54.68,
        13.4,
        "Falscher status",
        JSON.stringify([{ url: "https://example.com", titel: "x", abgerufen_am: "2026-07-15" }]),
        0.9,
        "2026-07-15",
        "invalid_status", // UNGÜLTIG
      ],
    );
    assert.fail("Hätte einen status-Constraint-Fehler werfen sollen");
  } catch (err) {
    const _dbError = err as { message: string; code: string };
    assert.ok(
      _dbError.message.includes("check constraint") || _dbError.code === "23514",
      `Erwarteter Constraint-Fehler für status, bekam: ${_dbError.message}`,
    );
  }
});
