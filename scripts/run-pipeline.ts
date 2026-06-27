// Pipeline manuell triggern (Test/CLI).
//
//   npm run pipeline:run -- <feature_id>
//   npm run pipeline:run -- --all-neu     # alle 'neu'/'in_pruefung'
//
// Nutzt dieselbe Logik wie der API-Endpoint, nur ohne HTTP.

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(join(__dirname, "..", ".env"));

const { runPipeline } = await import("../src/lib/pipeline.ts");
const { query } = await import("../src/lib/db.ts");

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run pipeline:run -- <feature_id|--all-neu>");
    process.exit(1);
  }

  let ids: string[];
  if (arg === "--all-neu") {
    const rows = await query<{ id: string }>(
      "SELECT id FROM feature_request WHERE status IN ('neu','in_pruefung') ORDER BY created_at",
    );
    ids = rows.map((r) => r.id);
    console.log(`${ids.length} offene Feature(s) gefunden.`);
  } else {
    ids = [arg];
  }

  for (const id of ids) {
    console.log(`→ Pipeline für ${id}`);
    try {
      const result = await runPipeline(id);
      console.log(`  ✓ status=${result.status}` +
        (result.size ? ` size=${result.size}` : ""));
    } catch (err) {
      console.error(`  ✗ Fehler:`, err);
    }
  }
  process.exit(0);
}

main();
