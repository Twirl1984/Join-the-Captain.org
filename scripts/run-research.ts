// Nächtlicher Research-Scout (Affiliate-Programme + Open-Source).
//
//   npm run research:run            # einmaliger Scan über offene Themen
//
// Idempotent: bereits recherchierte Themen werden übersprungen. Der Scout ist
// also „still", wenn nichts Neues anliegt, und „wacht auf", sobald neue
// Wünsche/Tools im Board liegen oder die Community gemeldet hat.
//
// Gedacht für den nächtlichen Cron auf dem VPS (siehe docs/research-scout.md).
// Schreibt einen kurzen Markdown-Report nach RESEARCH_REPORT_DIR (default ./reports).

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "./load-env.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
loadEnv(join(root, ".env"));

const { runResearchScan } = await import("../src/lib/research.ts");

function stempel(): string {
  // Lokale ISO-Zeit ohne Millisekunden, dateiname-tauglich.
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

async function main() {
  const start = stempel();
  console.log(`[research] Scan-Start ${start}`);

  const r = await runResearchScan();

  if (r.uebersprungen) {
    console.log("[research] Übersprungen (kein ANTHROPIC_API_KEY).");
    process.exit(0);
  }

  const zeilen = [
    `# Research-Scout — Lauf ${start}`,
    "",
    `- Affiliate-Programme geprüft: **${r.affiliate_geprueft}** (Fehler: ${r.affiliate_fehler})`,
    `- OSS-Recherchen geprüft: **${r.oss_geprueft}** (Fehler: ${r.oss_fehler})`,
    `- Web-Suchen ausgeführt: **${r.suchen}**`,
    r.abgebrochen ? "- ⏱️ **Budget erreicht** — Rest folgt in der nächsten Nacht." : "",
    "",
    r.affiliate_geprueft + r.oss_geprueft === 0
      ? "_Keine offenen Themen — der Scout bleibt still._"
      : "_Funde sind auto-publiziert; Details im Board/Tool-Verzeichnis._",
    "",
  ].filter((z) => z !== "");
  const report = zeilen.join("\n");
  console.log("\n" + report);

  const dir = process.env.RESEARCH_REPORT_DIR || join(root, "reports");
  try {
    mkdirSync(dir, { recursive: true });
    const datei = join(dir, `research-${start.replace(/[:]/g, "-")}.md`);
    writeFileSync(datei, report, "utf8");
    console.log(`[research] Report: ${datei}`);
  } catch (err) {
    console.warn("[research] Report konnte nicht geschrieben werden:", err);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[research] Fataler Fehler:", err);
  process.exit(1);
});
