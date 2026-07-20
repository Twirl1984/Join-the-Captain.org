// Unit-Tests für die /api/navigation-Handler (Review-Finding #14: die
// Server-Logik lief in keinem Test end-to-end — E2E mockt die Antworten).
// Lauf: node --import tsx --test src/lib/navigation/__tests__/api-handlers.test.ts
//
// Getestet werden die Pfade OHNE Upstream (Validierung, Flag, Limits,
// Landvermeidungs-422) — der Open-Meteo-Erfolgspfad braucht Netz und bleibt
// beim Live-Smoke (docs/navigation-test-notes.md).

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as routePost } from "../../../app/api/navigation/route/route";
import { GET as depthGet } from "../../../app/api/navigation/depth/route";

const url = "http://localhost/api/navigation/route";

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `t-${seq++}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
// Jeder Test nutzt eine eigene Pseudo-IP, damit der Rate-Limiter nicht
// zwischen Tests durchschlägt.
let seq = 0;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_FEATURE_NAVIGATION;
});

test("Feature-Flag off -> 404 (Kill-Switch wirkt auch auf die API)", async () => {
  process.env.NEXT_PUBLIC_FEATURE_NAVIGATION = "off";
  const res = await routePost(post({}));
  assert.equal(res.status, 404);
});

test("kaputtes JSON -> 400", async () => {
  const res = await routePost(post("das ist kein json"));
  assert.equal(res.status, 400);
});

test("Body über dem Limit -> 413 auch OHNE content-length-Header", async () => {
  // Der frühere Check las nur den (fälschbaren) Header; jetzt zählt die
  // echte Länge. NextRequest setzt hier selbst keinen content-length.
  const big = { revier: "ruegen", pad: "x".repeat(70_000) };
  const res = await routePost(post(big));
  assert.equal(res.status, 413);
});

test("unbekanntes Revier / fehlende Wegpunkte / >25 Wegpunkte -> 400", async () => {
  assert.equal((await routePost(post({ revier: "atlantis" }))).status, 400);
  assert.equal(
    (await routePost(post({ revier: "ruegen", waypoints: [{ lat: 54.5, lon: 13 }] }))).status,
    400,
  );
  const viele = Array.from({ length: 26 }, (_, i) => ({ lat: 54.3 + i * 0.01, lon: 13 }));
  assert.equal((await routePost(post({ revier: "ruegen", waypoints: viele }))).status, 400);
});

test("Wegpunkt tief an Land -> 422 mit verständlicher Meldung (kein Upstream nötig)", async () => {
  const res = await routePost(
    post({
      revier: "ruegen",
      waypoints: [
        { lat: 54.05, lon: 13.4, name: "Acker" },
        { lat: 54.9, lon: 12.5 },
      ],
    }),
  );
  assert.equal(res.status, 422);
  const body = (await res.json()) as { fehler: string };
  assert.match(body.fehler, /Kein Wasserweg/);
  assert.match(body.fehler, /Acker/);
});

test("Rate-Limit: 31. Anfrage derselben IP im Fenster -> 429", async () => {
  const ip = "flood-1";
  let last = 0;
  for (let i = 0; i < 31; i++) {
    // absichtlich ungültiger Body (400) — zählt trotzdem gegen das Limit
    const res = await routePost(post("x", { "x-forwarded-for": ip }));
    last = res.status;
  }
  assert.equal(last, 429);
});

test("Depth-Handler: Koordinaten-Validierung 400, Tiefgang > 20 wird geklemmt statt ignoriert", async () => {
  const bad = new NextRequest("http://localhost/api/navigation/depth?lat=999&lon=0");
  assert.equal((await depthGet(bad)).status, 400);

  // Upstream ist offline blockiert -> 502; wichtig ist: kein 400 wegen tiefgang=25.
  const clamped = new NextRequest(
    "http://localhost/api/navigation/depth?lat=54.5&lon=13.2&tiefgang=25",
    { headers: { "x-forwarded-for": "depth-1" } },
  );
  const res = await depthGet(clamped);
  assert.ok([200, 502].includes(res.status), `unerwarteter Status ${res.status}`);
});
