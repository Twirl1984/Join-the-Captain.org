// trace-check.ts — Traceability-Gate (REQ-PROC-001).
//
// Prüft die Verknüpfung Anforderungen ↔ Tests und generiert die Matrix:
//   1. Liest docs/REQUIREMENTS.md: Zeilen `- **REQ-XXX-NNN** … (Status: …)`.
//   2. Sammelt Tags `[REQ-XXX-NNN]` aus allen test()-Titeln
//      (src/**/__tests__/*.test.ts und e2e/*.spec.ts).
//   3. FEHLER wenn (a) ein Requirement mit Status "umgesetzt" keinen getaggten
//      Test hat, (b) ein Tag auf ein unbekanntes Requirement zeigt.
//   4. Schreibt docs/TRACEABILITY.md (generiert — nicht von Hand editieren).
//
// Lauf: npm run trace   (Teil von npm run verify)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQ_FILE = path.join(REPO, "docs", "REQUIREMENTS.md");
const OUT_FILE = path.join(REPO, "docs", "TRACEABILITY.md");
const REQ_RE = /^- \*\*(REQ-[A-Z]+-\d{3})\*\*\s+(.+?)\s+\(Status:\s*(umgesetzt|in-arbeit|geplant)\)/;
const TAG_RE = /\[(REQ-[A-Z]+-\d{3})\]/g;

interface Req { id: string; titel: string; status: string }
interface Hit { file: string; titel: string }

function collectTestFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(test|spec)\.ts$/.test(e.name)) out.push(p);
    }
  };
  walk(path.join(REPO, "src"));
  walk(path.join(REPO, "e2e"));
  return out;
}

function main() {
  // 1) Requirements einlesen
  const reqs = new Map<string, Req>();
  for (const line of fs.readFileSync(REQ_FILE, "utf8").split("\n")) {
    const m = line.match(REQ_RE);
    if (m) reqs.set(m[1], { id: m[1], titel: m[2], status: m[3] });
  }
  if (!reqs.size) {
    console.error("trace: keine Requirements in docs/REQUIREMENTS.md gefunden.");
    process.exit(1);
  }

  // 2) Tags aus Test-Titeln sammeln (Zeilen mit test(/it(/describe( und Tag)
  const hits = new Map<string, Hit[]>();
  const unknown: Array<{ file: string; tag: string }> = [];
  for (const file of collectTestFiles()) {
    const rel = path.relative(REPO, file);
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!/\b(test|it|describe)\s*(\.\w+)?\s*\(/.test(line)) continue;
      for (const m of line.matchAll(TAG_RE)) {
        const tag = m[1];
        const titel = (line.match(/["'`](.+?)["'`]/)?.[1] ?? line.trim()).slice(0, 90);
        if (!reqs.has(tag)) unknown.push({ file: rel, tag });
        else {
          if (!hits.has(tag)) hits.set(tag, []);
          hits.get(tag)!.push({ file: rel, titel });
        }
      }
    }
  }

  // 3) Validieren
  // PROC-Anforderungen verifiziert der Prozess selbst (dieses Gate, Reviews) —
  // sie brauchen keinen Code-Test.
  const untested = [...reqs.values()].filter(
    (r) => r.status === "umgesetzt" && !r.id.startsWith("REQ-PROC-") && !hits.has(r.id),
  );
  let fail = false;
  if (untested.length) {
    fail = true;
    console.error(`trace: ${untested.length} umgesetzte Requirements OHNE getaggten Test:`);
    untested.forEach((r) => console.error(`  ${r.id} — ${r.titel}`));
  }
  if (unknown.length) {
    fail = true;
    console.error(`trace: ${unknown.length} Test-Tags zeigen auf unbekannte Requirements:`);
    unknown.forEach((u) => console.error(`  ${u.tag} in ${u.file}`));
  }

  // 4) Matrix generieren
  const lines: string[] = [
    "# Traceability-Matrix — Anforderungen ↔ Tests",
    "",
    "GENERIERT von `npm run trace` (scripts/trace-check.ts) — nicht von Hand editieren.",
    `Stand: Requirements ${reqs.size} · getaggte Zuordnungen ${[...hits.values()].reduce((s, h) => s + h.length, 0)}.`,
    "",
    "| Requirement | Status | Verifizierende Tests |",
    "|---|---|---|",
  ];
  for (const r of reqs.values()) {
    const h = hits.get(r.id) ?? [];
    const tests = h.length
      ? h.map((x) => `\`${x.file}\`: ${x.titel}`).join("<br>")
      : r.status === "umgesetzt" ? "⚠ FEHLT" : "—";
    lines.push(`| ${r.id} — ${r.titel} | ${r.status} | ${tests} |`);
  }
  fs.writeFileSync(OUT_FILE, lines.join("\n") + "\n");
  console.error(
    `trace: ${reqs.size} Requirements · ${hits.size} mit Tests verknüpft · Matrix → docs/TRACEABILITY.md`,
  );
  if (fail) process.exit(1);
}

main();
