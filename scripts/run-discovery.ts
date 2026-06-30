// Nachtschicht-Trigger für den YouTube-Discovery-Agent.
// Nutzt runDiscoveryAgent() mit Budget-Gate und Logging.
//
// Einsatz: z.B. täglich 2 Uhr via n8n Cron:
//   npm run discovery:run

import { runDiscoveryAgent } from "../src/lib/discovery";

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
