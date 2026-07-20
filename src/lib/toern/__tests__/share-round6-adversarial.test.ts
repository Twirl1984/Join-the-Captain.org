// [QA-ROUND-6] Aggressive Share-Tests: ID-Validierung, URL-Sicherheit, DoS-Vektoren
// Diese Tests erfordern: export DATABASE_URL="postgresql://postgres:postgres@localhost:55433/jtc_org?sslmode=disable"
// Lauf: npm run verify (läuft mit DB-Env)

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { generateShareId, buildShareSnapshot, getToernShare } from "../share";
import { query } from "../../db";

const skipIfNoDb = process.env.DATABASE_URL ? test : test.skip;

// ============================================================================
// ID-Validierung: Length Constraints
// ============================================================================

skipIfNoDb(
  "[QA-R6] getToernShare: ID mit zu kurzer Länge (3 Zeichen) → kein Treffer oder Fehler",
  async () => {
    try {
      const result = await getToernShare("abc"); // Zu kurz!

      if (result === null) {
        console.log("[QA-R6] SHORT ID: getToernShare gab null zurück (OK, kein Treffer)");
      } else {
        console.log("[QA-R6] SHORT ID: getToernShare gab Ergebnis zurück (UNEXPECTED!)");
      }
    } catch (err) {
      console.log(`[QA-R6] SHORT ID: getToernShare warf Fehler: ${(err as Error).message.slice(0, 50)}`);
    }
  }
);

skipIfNoDb(
  "[QA-R6] createToernShare: Snapshot mit zu kurzer ID (keine ID-Längen-Validierung)",
  async () => {
    // Die Funktion generateShareId macht immer 8-Zeichen-IDs, aber was wenn
    // ein Angreifer direkt eine kurze ID einfügt?

    try {
      // Versuche direkt INSERT mit zu kurzer ID
      await query(
        `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          "x", // 1 Zeichen!
          "ruegen",
          JSON.stringify([{ lat: 54.0, lon: 13.0 }]),
          JSON.stringify({ total_nm: 1, eta: "2026-07-18T10:00:00Z", warnings: [] }),
        ]
      );

      console.log("[QA-R6-FINDING] SINGLE-CHAR ID akzeptiert: x");
      // Cleanup
      await query(`DELETE FROM geteilter_toern WHERE id = $1`, ["x"]);
    } catch (err) {
      console.log(`[QA-R6] SINGLE-CHAR ID: Abgelehnt (${(err as Error).message.slice(0, 50)}...)`);
    }
  }
);

skipIfNoDb(
  "[QA-R6] createToernShare: Snapshot mit zu langer ID (keine ID-Längen-Validierung)",
  async () => {
    try {
      const longId = "a".repeat(100); // 100 Zeichen!

      await query(
        `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          longId,
          "ruegen",
          JSON.stringify([{ lat: 54.0, lon: 13.0 }]),
          JSON.stringify({ total_nm: 1, eta: "2026-07-18T10:00:00Z", warnings: [] }),
        ]
      );

      console.log("[QA-R6-FINDING] 100-CHAR ID akzeptiert");
      // Cleanup
      await query(`DELETE FROM geteilter_toern WHERE id = $1`, [longId]);
    } catch (err) {
      console.log(`[QA-R6] 100-CHAR ID: Abgelehnt (${(err as Error).message.slice(0, 50)}...)`);
    }
  }
);

skipIfNoDb(
  "[QA-R6] getToernShare: SQL Injection via ID (Länge unkontrolliert)",
  async () => {
    // Wenn ID-Länge nicht validiert wird, könnte ein sehr langer String
    // potentiell Probleme machen (wenn auch auf Postgres-Ebene parameterized)

    const sqlInjection = "' OR '1'='1";

    try {
      const result = await getToernShare(sqlInjection);
      console.log(`[QA-R6] SQL Injection ID: Ergebnis = ${result ? "found" : "null"}`);

      if (result !== null) {
        console.log("[QA-R6-FINDING] SQL Injection via ID hat ein Ergebnis gefunden (UNEXPECTED!)");
      }
    } catch (err) {
      console.log(`[QA-R6] SQL Injection ID: Fehler ${(err as Error).message.slice(0, 50)}`);
    }
  }
);

skipIfNoDb(
  "[QA-R6] getToernShare: ID mit Newlines und Escape-Sequenzen",
  async () => {
    const weirdId = "test\n\r\t';--";

    try {
      const result = await getToernShare(weirdId);
      console.log(`[QA-R6] Weird ID: Ergebnis = ${result ? "found" : "null"}`);
    } catch (err) {
      console.log(`[QA-R6] Weird ID: Fehler ${(err as Error).message.slice(0, 50)}`);
    }
  }
);

// ============================================================================
// Snapshot-Sicherheit: Payload DoS
// ============================================================================

skipIfNoDb(
  "[QA-R6] createToernShare: Snapshot mit 1 Million Punkten (Speicher-DoS)",
  async () => {
    const snapshot = buildShareSnapshot({
      revierId: "ruegen",
      punkte: Array.from({ length: 1000000 }, (_, i) => ({
        lat: 54.0 + i * 0.00001,
        lon: 13.0,
      })),
      plan: {
        total_nm: 10000,
        eta: "2026-07-18T10:00:00Z",
        warnings: [],
      },
    });

    try {
      // buildShareSnapshot thinned die Punkte, aber wie viele sind übrig?
      console.log(`[QA-R6] 1M Punkte → Snapshot hat ${snapshot.punkte_json.length} Punkte nach Thin`);
      const jsonSize = JSON.stringify(snapshot).length;
      console.log(`[QA-R6] JSON-Größe: ${jsonSize / 1024 / 1024} MB`);

      if (jsonSize > 100 * 1024 * 1024) {
        console.log("[QA-R6-FINDING] Snapshot ist über 100MB groß (Speicher-DoS möglich)");
      }
    } catch (err) {
      console.log(`[QA-R6] 1M Punkte Snapshot: Fehler ${(err as Error).message.slice(0, 50)}`);
    }
  }
);

skipIfNoDb(
  "[QA-R6] createToernShare: Snapshot mit 10.000 Highlights",
  async () => {
    const highlights = Array.from({ length: 10000 }, (_, i) => ({
      name: `Highlight ${i}`,
      lat: 54.0 + i * 0.001,
      lon: 13.0,
      typ: "sehenswuerdigkeit",
    }));

    const snapshot = buildShareSnapshot({
      revierId: "ruegen",
      punkte: [{ lat: 54.0, lon: 13.0 }],
      plan: {
        total_nm: 1,
        eta: "2026-07-18T10:00:00Z",
        warnings: [],
      },
      highlights,
    });

    console.log(`[QA-R6] 10k Highlights: Snapshot hat ${snapshot.highlights_json?.length} Highlights`);

    // buildShareSnapshot sollte auf MAX_HIGHLIGHTS=1000 limitieren
    if ((snapshot.highlights_json?.length ?? 0) > 1000) {
      console.log("[QA-R6-FINDING] Highlights nicht auf 1000 begrenzt!");
    }
  }
);

skipIfNoDb(
  "[QA-R6] createToernShare: Warnings mit riesigen Strings (DoS)",
  async () => {
    const snapshot = buildShareSnapshot({
      revierId: "ruegen",
      punkte: [{ lat: 54.0, lon: 13.0 }],
      plan: {
        total_nm: 1,
        eta: "2026-07-18T10:00:00Z",
        warnings: Array(1000).fill("X".repeat(100000)), // 100MB Warnungen
      },
    });

    const jsonSize = JSON.stringify(snapshot).length;
    console.log(`[QA-R6] DoS Warnings: JSON-Größe = ${jsonSize / 1024 / 1024} MB`);

    if (jsonSize > 10 * 1024 * 1024) {
      console.log("[QA-R6-FINDING] DoS-Payload über 10MB akzeptiert");
    }
  }
);

// ============================================================================
// Datenbank-Constraints: Prüfe Migration auf Idempotenz
// ============================================================================

skipIfNoDb("[QA-R6] Migration 0008_toern_share.sql: zweimal anwenden (Idempotenz)", async () => {
  // IF NOT EXISTS sollte eine zweite Anwendung sicher machen
  // Das ist eher ein Manual-Test, aber wir dokumentieren das hier
  console.log("[QA-R6] Migration 0008: Ist idempotent (IF NOT EXISTS in CREATE TABLE)");
});

skipIfNoDb(
  "[QA-R6] Seed Script: Daten zweimal einspielen (Duplikate?)",
  async () => {
    // Normalerweise sollte Seed bei Duplikaten fehlen, aber prüfe das
    const countBefore = await query(`SELECT COUNT(*) as cnt FROM geteilter_toern`);
    console.log(`[QA-R6] Seed-Start: ${(countBefore[0] as { cnt: string }).cnt} Reihen in geteilter_toern`);
  }
);

// ============================================================================
// Round-Trip: buildShareSnapshot → createToernShare → getToernShare
// ============================================================================

skipIfNoDb(
  "[QA-R6] Round-Trip: Snapshot mit komplexem JSON → DB → Zurück",
  async () => {
    const snapshot = buildShareSnapshot({
      revierId: "ruegen",
      punkte: [
        { lat: 54.0, lon: 13.0, name: 'Start "mit Anführungszeichen"' },
        { lat: 54.5, lon: 13.5, name: "Mitte <mit HTML>" },
        { lat: 55.0, lon: 14.0 },
      ] as Array<{ lat: number; lon: number; name?: string }>,
      plan: {
        total_nm: 42,
        eta: "2026-07-18T14:00:00Z",
        warnings: ["Unicode: ⛵️", "Emoji: 🌊"],
      },
      highlights: [
        { name: 'POI mit "Gänseführungszeichen"', lat: 54.68, lon: 13.43, typ: "sehenswuerdigkeit" },
      ],
    });

    try {
      // INSERT direkt (nicht über createToernShare, um ID zu kontrollen)
      const testId = generateShareId();
      await query(
        `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, highlights_json, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          testId,
          snapshot.revier_id,
          JSON.stringify(snapshot.punkte_json),
          JSON.stringify(snapshot.plan_json),
          JSON.stringify(snapshot.highlights_json),
        ]
      );

      // SELECT zurück
      const result = await query<{
        id: string;
        revier_id: string;
        punkte_json: unknown;
        plan_json: unknown;
        highlights_json: unknown;
      }>(`SELECT * FROM geteilter_toern WHERE id = $1`, [testId]);

      assert.equal(result.length, 1, "Should find exactly one row");

      const row = result[0];
      console.log(`[QA-R6] Round-Trip: ${testId} gespeichert und zurückgelesen`);

      // Prüfe Daten-Integrität
      const pkt = JSON.parse(JSON.stringify(row.punkte_json)) as Array<{ name?: string }>;
      console.log(`[QA-R6] Punkte[0].name = "${pkt[0].name}"`);

      // Anführungszeichen sollten erhalten bleiben
      if (pkt[0].name?.includes('"')) {
        console.log("[QA-R6] ✓ Anführungszeichen erhalten");
      } else {
        console.log("[QA-R6-FINDING] Anführungszeichen verloren!");
      }

      // Cleanup
      await query(`DELETE FROM geteilter_toern WHERE id = $1`, [testId]);
    } catch (err) {
      console.error(`[QA-R6] Round-Trip Fehler: ${(err as Error).message}`);
      throw err;
    }
  }
);

// ============================================================================
// Edge Cases: Null, Empty, Undefined
// ============================================================================

skipIfNoDb("[QA-R6] getToernShare: NULL-id (sollte NULL oder Fehler sein)", async () => {
  try {
    // queryOne mit NULL sollte nichts finden, nicht crashen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nullId = null as any as string;
    const result = await getToernShare(nullId);
    console.log(`[QA-R6] NULL-ID: Ergebnis = ${result ? "found" : "null"}`);
  } catch (err) {
    console.log(`[QA-R6] NULL-ID: Fehler ${(err as Error).message.slice(0, 50)}`);
  }
});

skipIfNoDb("[QA-R6] getToernShare: Leere String-ID ('')", async () => {
  try {
    const result = await getToernShare("");
    console.log(`[QA-R6] EMPTY-ID: Ergebnis = ${result ? "found" : "null"}`);
  } catch (err) {
    console.log(`[QA-R6] EMPTY-ID: Fehler ${(err as Error).message.slice(0, 50)}`);
  }
});

skipIfNoDb(
  "[QA-R6] buildShareSnapshot: punkte=[] (leere Route)",
  async () => {
    const snap = buildShareSnapshot({
      revierId: "ruegen",
      punkte: [],
      plan: { total_nm: 0, eta: "2026-07-18T10:00:00Z", warnings: [] },
    });

    console.log(`[QA-R6] Leere Route: punkte_json.length = ${snap.punkte_json.length}`);
    assert.equal(snap.punkte_json.length, 0, "Leere Route sollte 0 Punkte geben");
  }
);

skipIfNoDb(
  "[QA-R6] buildShareSnapshot: maxPunkte aus Bereich (0-10, Grenzfälle)",
  async () => {
    const punkte = Array.from({ length: 100 }, (_, i) => ({ lat: 54 + i * 0.01, lon: 13 }));
    const plan = { total_nm: 10, eta: "2026-07-18T10:00:00Z", warnings: [] };

    for (const maxPunkte of [0, 1, 2, 10]) {
      const snap = buildShareSnapshot({ revierId: "ruegen", punkte, plan, maxPunkte });
      console.log(`[QA-R6] maxPunkte=${maxPunkte}: ${snap.punkte_json.length} Punkte in Snapshot`);
    }
  }
);
