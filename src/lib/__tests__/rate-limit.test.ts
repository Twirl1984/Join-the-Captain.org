// Unit-Tests für den In-Memory-Rate-Limiter (rate-limit.ts) — TDD.
// Lauf: node --import tsx --test src/lib/__tests__/rate-limit.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { createLimiter } from "../rate-limit";

test("[REQ-SAFE-004] erlaubt bis zum Limit, blockt danach, Fenster läuft ab", () => {
  let now = 1_000_000;
  const lim = createLimiter({ limit: 3, windowMs: 60_000, clock: () => now });
  assert.equal(lim.allow("ip-a"), true);
  assert.equal(lim.allow("ip-a"), true);
  assert.equal(lim.allow("ip-a"), true);
  assert.equal(lim.allow("ip-a"), false, "4. Anfrage im Fenster muss geblockt sein");
  now += 61_000; // Fenster vorbei
  assert.equal(lim.allow("ip-a"), true, "nach Fensterablauf wieder frei");
});

test("[REQ-SAFE-004] Schlüssel sind unabhängig (eine IP blockt nicht die andere)", () => {
  let now = 0;
  const lim = createLimiter({ limit: 1, windowMs: 60_000, clock: () => now });
  assert.equal(lim.allow("a"), true);
  assert.equal(lim.allow("b"), true);
  assert.equal(lim.allow("a"), false);
  now += 1; // Zeit spielt hier keine Rolle
  assert.equal(lim.allow("b"), false);
});

test("[REQ-SAFE-004] Speicher wächst nicht unbegrenzt: abgelaufene Einträge werden geräumt", () => {
  let now = 0;
  const lim = createLimiter({ limit: 1, windowMs: 1_000, clock: () => now });
  for (let i = 0; i < 5_000; i++) lim.allow(`ip-${i}`);
  now += 2_000;
  lim.allow("neu"); // triggert Aufräumen
  assert.ok(lim.size() < 100, `Limiter hält ${lim.size()} alte Einträge`);
});
