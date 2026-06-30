// Versionierte Migrationen ausführen.
// Liest /migrations/*.sql in alphabetischer Reihenfolge und wendet
// noch nicht eingespielte Dateien an. Idempotent.
//
//   npm run db:migrate
//
// Lädt .env (falls vorhanden) ohne externe Abhängigkeit.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadEnv } from "./load-env.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

loadEnv(join(root, ".env"));

const migrationsDir = join(root, "migrations");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL fehlt.");

  const pool = new Pool({
    connectionString,
    ssl:
      /sslmode=disable/.test(connectionString) ||
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (await pool.query<{ version: string }>("SELECT version FROM schema_migrations"))
      .rows.map((r) => r.version),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`· übersprungen ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`→ wende an ${file}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      count++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✗ Fehler in ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log(`Fertig. ${count} neue Migration(en) angewendet.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
