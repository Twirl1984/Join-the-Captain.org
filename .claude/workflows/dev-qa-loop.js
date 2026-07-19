// dev-qa-loop — wiederverwendbarer dev↔qa-Loop für dieses Repo.
//
// Aufruf:  Workflow({ name: "dev-qa-loop", args: { … } })  — oder über den
// Skill /dev-loop. Rollen: .claude/skills/dev-tdd + .claude/skills/qa-adversarial.
//
// args (alle optional, sinnvolle Defaults):
//   worktree   absoluter Pfad der Arbeitskopie (Default: aktuelles CWD via pwd-Agent)
//   branch     Branch, auf dem gearbeitet wird (nur informativ im Prompt)
//   focus      1–3 Sätze: WAS gehärtet wird + die betroffenen Pfade
//   maxRounds  Obergrenze der QA↔Dev-Runden (Default 10)
//   dbSetup    true, wenn DB-Features geprüft werden (QA bekommt die Postgres-Anleitung)
//   gitBin     git-Binary (Default "git"; auf diesem Mac /Library/Developer/CommandLineTools/usr/bin/git)
export const meta = {
  name: "dev-qa-loop",
  description: "dev↔qa-Loop: ein Ziel adversarisch härten (QA bricht, Dev fixt) bis grün",
  phases: [
    { title: "QA-Scan", detail: "adversariale Findings + neue Tests" },
    { title: "Dev-Fix", detail: "Regressionstest zuerst, dann Fix" },
    { title: "Verify", detail: "volle Suite als Wahrheit" },
  ],
};

const a = args ?? {};
const WT = a.worktree ?? process.env.PWD ?? ".";
const GIT = a.gitBin ?? "git";
const MAX = Math.max(1, Math.min(10, a.maxRounds ?? 10));
// MODELL-DIVERSITÄT (Generator-Verifier-Asymmetrie): Autor und Prüfer laufen
// auf VERSCHIEDENEN, gleich starken Modellen — sonst teilen sie den blinden
// Fleck. NIE Haiku für die adversariale QA (zu schwach).
const DEV_MODEL = a.devModel ?? "opus";
const QA_MODEL = a.qaModel ?? "sonnet";
const FOCUS = a.focus ?? "die zuletzt geänderten Dateien dieses Branches (git diff gegen origin/main)";
const DB = a.dbSetup
  ? `\nDB-Features: echte Postgres nutzen —\n  docker run -d --name jtc-qa-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=jtc_org -p 55433:5432 postgres:16\n  export DATABASE_URL="postgresql://postgres:postgres@localhost:55433/jtc_org?sslmode=disable"\n  npm run db:migrate && npm run db:seed:erlebnis`
  : "";

const BASE = `Arbeitskopie: ${WT}${a.branch ? ` (Branch ${a.branch})` : ""}. JEDER Bash-Call beginnt mit \`builtin cd ${WT} && pwd\`. git-Binary: ${GIT}.
Fokus dieser Härtung: ${FOCUS}. Andere, bereits verifizierte Bereiche NICHT anfassen.
Prozess bindend: .claude/skills/dev-tdd/SKILL.md und .claude/skills/qa-adversarial/SKILL.md. Diffs klein halten (docs/GATES.md, <400 Zeilen).${DB}`;

const FINDINGS = {
  type: "object",
  required: ["findings", "suiteGruen", "zusammenfassung"],
  properties: {
    suiteGruen: { type: "boolean" },
    zusammenfassung: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["titel", "datei", "repro", "schwere"],
        properties: {
          titel: { type: "string" },
          datei: { type: "string" },
          repro: { type: "string", description: "konkrete Eingabe/Schritte → falsches Verhalten" },
          schwere: { type: "string", enum: ["kritisch", "mittel", "gering"] },
        },
      },
    },
  },
};

let round = 0;
let offen = [];
const historie = [];

while (round < MAX) {
  round++;
  phase("QA-Scan");
  const kontext =
    round === 1
      ? "Erste Runde: suche die LÜCKEN, die ein Happy-Path-Test übersieht (Ränder, Leerfälle, Nebenläufigkeit, Sicherheit, DB-Integrität, Geräte-Spezifika)."
      : `Runde ${round}. Prüfe ZUERST, ob die zuletzt gemeldeten Findings WIRKLICH gefixt sind (Regressionstest grün): ${JSON.stringify(offen.map((f) => f.titel))}. Dann suche Neues.`;
  const qa = await agent(
    `${BASE}\n\nDu bist qa-adversarial. ${kontext}\n\nSchreibe NEUE Tests, die brechen sollen (in die passenden __tests__/ bzw. e2e/), und führe die ECHTE Suite aus: npm run verify; bei UI \`npm run build && PW_PORT=3312 npx playwright test\`; bei DB die Postgres oben. Gib NUR reproduzierbare Findings zurück (Eingabe→falsches Verhalten). Tests im Working Tree lassen, NICHT committen — der Dev-Agent nagelt sie fest.`,
    { label: `qa:r${round}`, phase: "QA-Scan", schema: FINDINGS, effort: "high", model: QA_MODEL },
  );
  historie.push({ round, rolle: "qa", ...qa });

  const echte = (qa?.findings ?? []).filter((f) => f.schwere !== "gering" || round <= 2);
  if ((!echte || echte.length === 0) && qa?.suiteGruen) {
    log(`Runde ${round}: QA findet nichts Neues, Suite grün → fertig.`);
    offen = [];
    break;
  }
  log(`Runde ${round}: ${echte.length} Finding(s) → dev-fix.`);

  phase("Dev-Fix");
  const fix = await agent(
    `${BASE}\n\nDu bist dev-tdd. QA-Findings (mit Repro):\n${JSON.stringify(echte, null, 2)}\n\nFür JEDES: erst der rote Regressionstest (nutze/prüfe den vom QA hinterlassenen), dann der minimale Fix, dann grün. BUGLOG-Eintrag je Bug. Kein echter Bug? Kurz begründen statt blind ändern — Beweislast bei dir. Am Ende MUSS \`npm run verify\` grün sein. Kurze Bilanz zurück.`,
    { label: `dev:r${round}`, phase: "Dev-Fix", effort: "high", model: DEV_MODEL },
  );
  historie.push({ round, rolle: "dev", text: fix });

  phase("Verify");
  const check = await agent(
    `${BASE}\n\nNeutrale Verifikation nach dem Dev-Fix (Runde ${round}): führe \`npm run verify\` aus, melde EXAKT verify grün ja/nein + trace-Zeile + ob uncommittete Änderungen da sind. Nur Fakten.`,
    { label: `verify:r${round}`, phase: "Verify" },
  );
  historie.push({ round, rolle: "verify", text: check });
  offen = echte;
}

return {
  runden: round,
  abbruchGrund: offen.length === 0 ? "grün — QA findet nichts mehr" : `Max-Runden erreicht, ${offen.length} offen`,
  offeneFindings: offen,
  historie: historie.map((h) => ({
    round: h.round,
    rolle: h.rolle,
    kern: h.zusammenfassung ?? (typeof h.text === "string" ? h.text.slice(0, 300) : ""),
  })),
};
