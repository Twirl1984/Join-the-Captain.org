// Unit-Tests für Feature-Flags (flags.ts) — TDD.
// Lauf: node --import tsx --test src/lib/__tests__/flags.test.ts
//
// Reversibilitäts-Regel aus dem Agentic-Playbook: nutzerseitige Features stehen
// hinter einem Env-Kill-Switch. Default ist AN (Flag ist Rollback-Hebel, keine
// Freischalt-Hürde); nur explizites "off"/"false"/"0" deaktiviert.

import { test } from "node:test";
import assert from "node:assert/strict";
import { flagEnabled } from "../flags";

test("Default (undefined/leer) ist AN", () => {
  assert.equal(flagEnabled(undefined), true);
  assert.equal(flagEnabled(""), true);
  assert.equal(flagEnabled("   "), true);
});

test("off/false/0 (case-insensitiv, getrimmt) schalten AUS", () => {
  for (const v of ["off", "OFF", "false", "False", "0", " off "]) {
    assert.equal(flagEnabled(v), false, `"${v}" sollte deaktivieren`);
  }
});

test("alles andere bleibt AN (on, true, 1, Tippfehler)", () => {
  for (const v of ["on", "true", "1", "yes", "offf"]) {
    assert.equal(flagEnabled(v), true, `"${v}" sollte aktiv lassen`);
  }
});
