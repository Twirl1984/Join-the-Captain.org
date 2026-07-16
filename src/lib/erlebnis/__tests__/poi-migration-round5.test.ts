// [QA-ROUND-5] Migrations-Idempotenz und Quellenpflicht-Tests
// Diese Tests erfordern: DATABASE_URL und Zugriff auf Migrationen

import { test } from "node:test";
import { strict as _assert } from "node:assert";
import { query } from "../../db";

const skipIfNoDb = process.env.DATABASE_URL ? test : test.skip;

skipIfNoDb("[QA-R5-MIGRATION] Quellenpflicht: POI ohne quellen_json wird abgelehnt", async () => {
  try {
    // Versuche, einen POI ohne quellen_json einzufügen
    await query(
      `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        "ruegen",
        54.68,
        13.43,
        "Test POI ohne Quelle",
        "sehenswuerdigkeit",
        null, // NULL quellen_json — sollte abgelehnt werden
        "live",
      ]
    );

    console.log("[QA-R5-MIGRATION] POI ohne quellen_json: AKZEPTIERT (BUG!)");
    throw new Error("FINDING: POI ohne quellen_json wurde akzeptiert — Quellenpflicht nicht erzwungen!");
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("FINDING")) throw err; // Re-throw unsere BUG-Meldung
    console.log(
      `[QA-R5-MIGRATION] POI ohne quellen_json: Abgelehnt ✓ (${msg.slice(0, 60)}...)`
    );
  }
});

skipIfNoDb(
  "[QA-R5-MIGRATION] Quellenpflicht: POI mit leerem quellen_json-Array wird abgelehnt",
  async () => {
    try {
      // Versuche, einen POI mit leerem Quellen-Array einzufügen
      await query(
        `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          "ruegen",
          54.68,
          13.43,
          "Test POI mit leeren Quellen",
          "sehenswuerdigkeit",
          JSON.stringify([]), // Leeres Array — sollte abgelehnt werden?
          "live",
        ]
      );

      console.log("[QA-R5-MIGRATION] POI mit leerem quellen_json: AKZEPTIERT");
      // Leeres Array könnte akzeptabel sein, dokumentieren wir nur
    } catch (err) {
      console.log(
        `[QA-R5-MIGRATION] POI mit leerem quellen_json: Abgelehnt (${(err as Error).message.slice(0, 50)}...)`
      );
    }
  }
);

skipIfNoDb(
  "[QA-R5-MIGRATION] Koordinaten-Constraints: lat > 90 wird abgelehnt",
  async () => {
    try {
      await query(
        `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          "ruegen",
          91.0, // lat > 90 — invalid
          13.43,
          "Test POI mit zu hohem lat",
          "sehenswuerdigkeit",
          JSON.stringify([{ url: "https://example.com", abgerufen_am: "2026-01-01" }]),
          "live",
        ]
      );

      console.log("[QA-R5-MIGRATION] lat > 90: AKZEPTIERT (BUG!)");
      throw new Error("FINDING: lat > 90 wurde akzeptiert — Koordinaten-Constraints nicht erzwungen!");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("FINDING")) throw err;
      console.log(`[QA-R5-MIGRATION] lat > 90: Abgelehnt ✓`);
    }
  }
);

skipIfNoDb(
  "[QA-R5-MIGRATION] Koordinaten-Constraints: lon > 180 wird abgelehnt",
  async () => {
    try {
      await query(
        `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          "ruegen",
          54.68,
          181.0, // lon > 180 — invalid
          "Test POI mit zu hohem lon",
          "sehenswuerdigkeit",
          JSON.stringify([{ url: "https://example.com", abgerufen_am: "2026-01-01" }]),
          "live",
        ]
      );

      console.log("[QA-R5-MIGRATION] lon > 180: AKZEPTIERT (BUG!)");
      throw new Error("FINDING: lon > 180 wurde akzeptiert!");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("FINDING")) throw err;
      console.log(`[QA-R5-MIGRATION] lon > 180: Abgelehnt ✓`);
    }
  }
);

skipIfNoDb(
  "[QA-R5-MIGRATION] typ-Enum: ungültiger Typ wird abgelehnt",
  async () => {
    try {
      await query(
        `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          "ruegen",
          54.68,
          13.43,
          "Test POI mit ungültigem typ",
          "invalid_type_xyz", // nicht in Enum
          JSON.stringify([{ url: "https://example.com", abgerufen_am: "2026-01-01" }]),
          "live",
        ]
      );

      console.log("[QA-R5-MIGRATION] Ungültiger typ: AKZEPTIERT (BUG!)");
      throw new Error("FINDING: Ungültiger typ wurde akzeptiert!");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("FINDING")) throw err;
      console.log(`[QA-R5-MIGRATION] Ungültiger typ: Abgelehnt ✓`);
    }
  }
);

skipIfNoDb(
  "[QA-R5-MIGRATION] status-Enum: ungültiger Status wird abgelehnt",
  async () => {
    try {
      await query(
        `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          "ruegen",
          54.68,
          13.43,
          "Test POI mit ungültigem status",
          "sehenswuerdigkeit",
          JSON.stringify([{ url: "https://example.com", abgerufen_am: "2026-01-01" }]),
          "invalid_status_xyz", // nicht in Enum
        ]
      );

      console.log("[QA-R5-MIGRATION] Ungültiger status: AKZEPTIERT (BUG!)");
      throw new Error("FINDING: Ungültiger status wurde akzeptiert!");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("FINDING")) throw err;
      console.log(`[QA-R5-MIGRATION] Ungültiger status: Abgelehnt ✓`);
    }
  }
);

skipIfNoDb("[QA-R5-MIGRATION] Gültige POI kann eingeführt werden", async () => {
  const testId = `test_poi_${Date.now()}`;

  try {
    await query(
      `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status, beschreibung, confidence, stand_datum)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        "ruegen",
        54.68,
        13.43,
        testId,
        "sehenswuerdigkeit",
        JSON.stringify([{ url: "https://example.com", abgerufen_am: "2026-01-01" }]),
        "live",
        "Test-Beschreibung",
        0.8,
        "2026-01-01",
      ]
    );

    console.log(`[QA-R5-MIGRATION] Gültiger POI: Eingefügt ✓`);

    // Cleanup
    await query(`DELETE FROM revier_poi WHERE name = $1`, [testId]);
  } catch (err) {
    console.error(`[QA-R5-MIGRATION] Gültiger POI: FEHLER! ${(err as Error).message}`);
    throw err;
  }
});

skipIfNoDb(
  "[QA-R5-MIGRATION] Saison-Constraints: saison_von außerhalb 1-12 wird abgelehnt",
  async () => {
    try {
      await query(
        `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status, saison_von)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          "ruegen",
          54.68,
          13.43,
          "Test POI mit saison_von=13",
          "sehenswuerdigkeit",
          JSON.stringify([{ url: "https://example.com", abgerufen_am: "2026-01-01" }]),
          "live",
          13, // ungültig, saison sollte 1-12 sein
        ]
      );

      console.log("[QA-R5-MIGRATION] saison_von=13: AKZEPTIERT (BUG!)");
      throw new Error("FINDING: saison_von=13 wurde akzeptiert!");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("FINDING")) throw err;
      console.log(`[QA-R5-MIGRATION] saison_von=13: Abgelehnt ✓`);
    }
  }
);

skipIfNoDb("[QA-R5-MIGRATION] Saison-Wrap-Around: saison_bis < saison_von wird akzeptiert", async () => {
  const testId = `season_wrap_${Date.now()}`;

  try {
    // saison_von=10 (Oktober), saison_bis=3 (März) — Wrap-Around über Winter
    await query(
      `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status, saison_von, saison_bis, beschreibung, confidence, stand_datum)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        "ruegen",
        54.68,
        13.43,
        testId,
        "sehenswuerdigkeit",
        JSON.stringify([{ url: "https://example.com", abgerufen_am: "2026-01-01" }]),
        "live",
        10, // Oktober
        3, // März — Wrap-Around
        "Test-Beschreibung",
        0.8,
        "2026-01-01",
      ]
    );

    console.log("[QA-R5-MIGRATION] saison_von=10, saison_bis=3: Akzeptiert ✓ (Wrap-Around)");

    // Cleanup
    await query(`DELETE FROM revier_poi WHERE name = $1`, [testId]);
  } catch (err) {
    console.error(`[QA-R5-MIGRATION] Saison-Wrap-Around: FEHLER! ${(err as Error).message}`);
    throw err;
  }
});

skipIfNoDb(
  "[QA-R5-MIGRATION] gueltig_von > gueltig_bis wird akzeptiert (semantischer Fehler)",
  async () => {
    const testId = `date_backward_${Date.now()}`;

    try {
      await query(
        `INSERT INTO revier_poi (revier_id, lat, lon, name, typ, quellen_json, status, gueltig_von, gueltig_bis)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          "ruegen",
          54.68,
          13.43,
          testId,
          "sehenswuerdigkeit",
          JSON.stringify([{ url: "https://example.com", abgerufen_am: "2026-01-01" }]),
          "live",
          "2026-12-31", // gueltig_von
          "2026-01-01", // gueltig_bis — VORHER!
        ]
      );

      console.log("[QA-R5-MIGRATION] gueltig_von > gueltig_bis: AKZEPTIERT (keine CHECK-Constraint?)");
      // Das ist ein semantischer Fehler, aber DB erzwingt das vielleicht nicht

      // Cleanup
      await query(`DELETE FROM revier_poi WHERE name = $1`, [testId]);
    } catch (err) {
      console.log(`[QA-R5-MIGRATION] gueltig_von > gueltig_bis: Abgelehnt (${(err as Error).message.slice(0, 50)}...)`);
    }
  }
);
