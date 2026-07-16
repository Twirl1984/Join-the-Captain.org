// [REQ-API-FORMAT] Unit tests for http.ts helpers
// Validates that error responses use German key "fehler" not English "error"

import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, fehler } from "../http";

test("[REQ-API-FORMAT] ok() returns NextResponse with 200 status", () => {
  const response = ok({ test: "data" });
  assert.equal(response.status, 200);
});

test("[REQ-API-FORMAT] BUG-050: fehler() returns JSON with German 'fehler' key, not English 'error'", async () => {
  const response = fehler("Test error message", 400);
  assert.equal(response.status, 400);

  // Parse the response body
  const text = await response.text();
  const body = JSON.parse(text);

  // FINDING: API must use German key "fehler" for consistency with German codebase
  // BUG: currently returns { error: "..." } instead of { fehler: "..." }
  assert.ok(body.fehler !== undefined, "Body must have 'fehler' key");
  assert.equal(body.fehler, "Test error message");
  assert.equal(body.error, undefined, "Body must NOT have 'error' key");
});

test("[REQ-API-FORMAT] fehler() uses default status 400 when not specified", async () => {
  const response = fehler("Default status test");
  assert.equal(response.status, 400);
});

test("[REQ-API-FORMAT] fehler() uses custom status code when provided", async () => {
  const response500 = fehler("Server error", 500);
  assert.equal(response500.status, 500);

  const response422 = fehler("Validation error", 422);
  assert.equal(response422.status, 422);
});
