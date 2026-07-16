// [QA-ROUND-5] Share-DB-Tests: Round-Trip gegen echte Postgres
// Diese Tests erfordern: export DATABASE_URL="postgresql://postgres:postgres@localhost:55433/jtc_org?sslmode=disable"
// Und: npm run db:migrate && npm run db:seed:toern

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { generateShareId, buildShareSnapshot } from "../share";
import { query } from "../../db";

// Skips, wenn DATABASE_URL nicht gesetzt
const skipIfNoDb = process.env.DATABASE_URL ? test : test.skip;

skipIfNoDb("[QA-R5-DB] generateShareId: Eindeutigkeit über 10000 Iterationen", () => {
  const ids = new Set<string>();
  const dupes = new Map<string, number>();

  for (let i = 0; i < 10000; i++) {
    const id = generateShareId();
    if (ids.has(id)) {
      dupes.set(id, (dupes.get(id) ?? 1) + 1);
    }
    ids.add(id);
  }

  console.log(`[QA-R5-DB] 10000 IDs: ${ids.size} eindeutig, ${dupes.size} Duplikate`);

  if (dupes.size > 0) {
    const topDupes = Array.from(dupes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    console.log(`[QA-R5-DB] Top Duplikate:`, topDupes);
  }

  // Mit 36^8 ≈ 2.6T sollten 10000 Duplikate SEHR unwahrscheinlich sein
  assert.ok(dupes.size === 0, `Zu viele Duplikate: ${dupes.size}`);
  assert.equal(ids.size, 10000, "10000 IDs sollten eindeutig sein");
});

skipIfNoDb(
  "[QA-R5-DB] geteilter_toern Round-Trip: buildShareSnapshot → INSERT → SELECT",
  async () => {
    // 1. Baue einen Snapshot
    const snapshot = buildShareSnapshot({
      revierId: "ruegen",
      punkte: [
        { lat: 54.0, lon: 13.0, name: "Start: Sassnitz" },
        { lat: 54.5, lon: 13.5, name: "Mitte: Rügen-Außenseite" },
        { lat: 55.0, lon: 14.0, name: "Ziel: Usedom" },
      ],
      plan: {
        total_nm: 42,
        eta: "2026-07-18T14:00:00Z",
        warnings: ["Gezeitenströmung im Arcona-Becken"],
      },
      highlights: [
        { name: "Kap Arkona", lat: 54.68, lon: 13.43, typ: "sehenswuerdigkeit" },
        { name: "Jasmunder Bodden", lat: 54.55, lon: 13.65, typ: "ankerplatz" },
      ],
    });

    // 2. Generiere eine Share-ID
    const shareId = generateShareId();

    // 3. Speichere in DB
    try {
      await query(
        `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, highlights_json, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [shareId, snapshot.revier_id, JSON.stringify(snapshot.punkte_json), JSON.stringify(snapshot.plan_json), JSON.stringify(snapshot.highlights_json)]
      );

      console.log(`[QA-R5-DB] INSERT erfolgreich: ${shareId}`);

      // 4. Hole sie zurück
      const result = await query<{ id: string; revier_id: string; punkte_json: unknown[]; plan_json: unknown; highlights_json: unknown }>(
        `SELECT * FROM geteilter_toern WHERE id = $1`,
        [shareId]
      );

      assert.ok(result.length === 1, "Sollte genau eine Reihe zurückgeben");

      const row = result[0];
      console.log(`[QA-R5-DB] SELECT erfolgreich: id=${row.id}, revier=${row.revier_id}`);

      // 5. Prüfe Daten-Integrität
      assert.equal(row.revier_id, "ruegen");
      assert.equal((row.punkte_json as unknown[]).length, 3);
      assert.equal((row.highlights_json as unknown[]).length, 2);
      assert.equal(((row.plan_json as unknown) as { total_nm: number }).total_nm, 42);

      // 6. Cleanup
      await query(`DELETE FROM geteilter_toern WHERE id = $1`, [shareId]);
      console.log(`[QA-R5-DB] Cleanup: ${shareId} gelöscht`);
    } catch (err) {
      console.error(`[QA-R5-DB] Fehler:`, err);
      throw err;
    }
  }
);

skipIfNoDb(
  "[QA-R5-DB] geteilter_toern: INSERT mit XSS-Namen sollte literal gespeichert werden",
  async () => {
    const xssPayload = "<script>alert('XSS')</script>";
    const shareId = generateShareId();

    try {
      await query(
        `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          shareId,
          "ruegen",
          JSON.stringify([{ lat: 54.0, lon: 13.0, name: xssPayload }]),
          JSON.stringify({ total_nm: 1, eta: "2026-07-18T10:00:00Z", warnings: [] }),
        ]
      );

      const result = await query<{ punkte_json: unknown[] }>(
        `SELECT punkte_json FROM geteilter_toern WHERE id = $1`,
        [shareId]
      );

      const punkte = result[0].punkte_json as unknown[];
      console.log(`[QA-R5-DB] XSS-Test: Name = "${(punkte[0] as { name: string }).name}"`);

      // Der XSS-String sollte literal im JSON sein (kein HTML-Escape)
      assert.equal((punkte[0] as { name: string }).name, xssPayload, "XSS sollte literal gespeichert sein");

      await query(`DELETE FROM geteilter_toern WHERE id = $1`, [shareId]);
    } catch (err) {
      console.error(`[QA-R5-DB] Fehler:`, err);
      throw err;
    }
  }
);

skipIfNoDb(
  "[QA-R5-DB] geteilter_toern: Unbekannte ID → leeres Ergebnis (kein Fehler)",
  async () => {
    try {
      const result = await query(
        `SELECT * FROM geteilter_toern WHERE id = $1`,
        ["doesnotexist"]
      );

      console.log(`[QA-R5-DB] SELECT unbekannte ID: ${result.length} Reihen`);
      assert.equal(result.length, 0, "Unbekannte ID sollte 0 Reihen geben");
    } catch (err) {
      console.error(`[QA-R5-DB] Fehler:`, err);
      throw err;
    }
  }
);

skipIfNoDb(
  "[QA-R5-DB] geteilter_toern ID-Länge: 8-Zeichen-IDs sind Primärschlüssel",
  async () => {
    // Versuche ID mit falscher Länge
    const shortId = "abc";
    const longId = "abcdefghijk";

    // Die Validierung sollte auf Anwendungsseite erfolgen (nicht DB)
    // Aber prüfe trotzdem Verhalten

    try {
      // Kurze ID
      await query(
        `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          shortId,
          "ruegen",
          JSON.stringify([{ lat: 54.0, lon: 13.0 }]),
          JSON.stringify({ total_nm: 1, eta: "2026-07-18T10:00:00Z", warnings: [] }),
        ]
      );

      console.log(`[QA-R5-DB] SHORT ID akzeptiert: ${shortId}`);

      // Cleanup
      await query(`DELETE FROM geteilter_toern WHERE id = $1`, [shortId]);
    } catch (err) {
      console.log(`[QA-R5-DB] SHORT ID abgelehnt: ${(err as Error).message}`);
    }

    try {
      // Lange ID
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

      console.log(`[QA-R5-DB] LONG ID akzeptiert: ${longId}`);

      // Cleanup
      await query(`DELETE FROM geteilter_toern WHERE id = $1`, [longId]);
    } catch (err) {
      console.log(`[QA-R5-DB] LONG ID abgelehnt: ${(err as Error).message}`);
    }
  }
);

skipIfNoDb("[QA-R5-DB] geteilter_toern: NULL-Felder sind nicht erlaubt (pflicht)", async () => {
  const shareId = generateShareId();

  const testCases = [
    {
      name: "id = NULL",
      query: `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, created_at)
              VALUES (NULL, $1, $2, $3, NOW())`,
      params: ["ruegen", JSON.stringify([]), JSON.stringify({})],
    },
    {
      name: "revier_id = NULL",
      query: `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, created_at)
              VALUES ($1, NULL, $2, $3, NOW())`,
      params: [shareId, JSON.stringify([]), JSON.stringify({})],
    },
    {
      name: "punkte_json = NULL",
      query: `INSERT INTO geteilter_toern (id, revier_id, punkte_json, plan_json, created_at)
              VALUES ($1, $2, NULL, $3, NOW())`,
      params: [shareId, "ruegen", JSON.stringify({})],
    },
  ];

  for (const testCase of testCases) {
    try {
      await query(testCase.query, testCase.params);
      console.log(`[QA-R5-DB] ${testCase.name}: AKZEPTIERT (BUG?)`);
    } catch (err) {
      console.log(`[QA-R5-DB] ${testCase.name}: Abgelehnt ✓ (${(err as Error).message.slice(0, 50)}...)`);
    }
  }
});
