// Nachtschicht-Trigger für den YouTube-Discovery-Agent.
// Nutzt runDiscoveryAgent() mit Budget-Gate und Logging.
//
//   npm run discovery:run
//
// WICHTIG: .env MUSS vor dem Import von discovery.ts geladen werden — dort
// werden YOUTUBE_DISCOVERY_ENABLED/YOUTUBE_API_KEY & Budgets beim Modul-Import
// gelesen. Daher loadEnv zuerst, dann dynamischer Import (wie run-research.ts).

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(join(__dirname, "..", ".env"));

const { runDiscoveryAgent } = await import("../src/lib/discovery.ts");

async function main() {
  console.log("[discovery] Starte Discovery-Agent…");

  const result = await runDiscoveryAgent();

  console.log("[discovery] Abschluss:");
  console.log(`  - Themen verarbeitet: ${result.topics_processed}`);
  console.log(`  - Submissions erstellt: ${result.submissions_created}`);
  console.log(`  - Outreach-Drafts: ${result.outreach_drafts}`);
  console.log(`  - Ausgegeben: €${result.total_spent_eur.toFixed(4)}`);
  console.log(`  - Grund: ${result.stopped_reason}`);

  if (result.error) {
    console.error(`[discovery] Fehler: ${result.error}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[discovery] Unerwarteter Fehler:", err);
  process.exit(1);
});
