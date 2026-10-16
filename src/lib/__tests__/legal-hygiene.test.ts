import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Abmahn-Regression (Audit 2026-10-16): O-01 Werbekennzeichnung, O-02 Claims, O-03 „JTC“, O-07 Drittanbieter.
const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "__tests__") files(p, out); }
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}
const all = files(SRC).map((f) => ({ f: path.relative(SRC, f), s: fs.readFileSync(f, "utf8") }));

test("[LEGAL-O01] Affiliate-Hinweise stehen nie ohne Label „Werbung“", () => {
  for (const { f, s } of all) {
    if (f.endsWith("AffiliateLabel.tsx") || f.endsWith(".css")) continue;
    assert.ok(!/>\s*Affiliate(-Link)? ·/.test(s), `${f}: alter Affiliate-Hinweis ohne Werbung-Label`);
  }
});

test("[LEGAL-O01] Partnerlink zum Tool-Klick nutzt rel=sponsored", () => {
  const f = all.find((x) => x.f.replace(/\\/g, "/").endsWith("app/tools/[slug]/page.tsx"))!;
  assert.match(f.s, /rel=\{AFFILIATE_REL\}/);
  assert.match(f.s, /Zum Anbieter \(Werbung\)/);
});

test("[LEGAL-O02] keine Neutralitäts-Claims", () => {
  for (const { f, s } of all) assert.ok(!/Geprüfte Tools|ehrliche Empfehlungen|Marketing-Lärm/.test(s), `${f}: Neutralitäts-Claim`);
});

test("[LEGAL-O03] kein sichtbares Kürzel „JTC“ in Textknoten", () => {
  for (const { f, s } of all) assert.ok(!/>[^<{}]*\bJTC\b[^<{}]*</.test(s), `${f}: JTC sichtbar`);
});

test("[LEGAL-O07] keine Drittanbieter-Hosts im Quellcode (außer Plausible/Datenquellen im Backend)", () => {
  for (const { f, s } of all) {
    if (f.includes("/lib/") || f.includes("\\lib\\") || f.includes("/api/")) continue; // Server-Aufrufe (Open-Meteo etc.)
    assert.ok(!/fonts\.googleapis|tpembars|tp\.media|googletagmanager|js\.stripe\.com|connect\.facebook/.test(s), `${f}: Drittanbieter-Request`);
  }
});

test("[LEGAL-O05] Impressum ohne ODR-Link", () => {
  const f = all.find((x) => x.f.replace(/\\/g, "/").endsWith("impressum/page.tsx"))!;
  assert.ok(!/ec\.europa\.eu\/consumers\/odr/.test(f.s));
});
