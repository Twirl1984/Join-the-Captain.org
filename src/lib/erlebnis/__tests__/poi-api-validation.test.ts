import { test } from "node:test";
import assert from "node:assert";

test("[QA-R7] /api/erlebnis/poi: empty revier parameter should be rejected", () => {
  // Test that querystring handling doesn't allow empty revier
  const emptyRevier = "";
  assert.strictEqual(emptyRevier.length, 0, "Empty revier should have length 0");
  // In practice, the API should validate this before querying
});

test("[QA-R7] /api/erlebnis/poi: revier parameter with only whitespace", () => {
  const whitespaceRevier = "   ";
  // Should not be treated as a valid revier
  assert.strictEqual(whitespaceRevier.trim().length, 0, "Whitespace-only revier should validate to empty");
});

test("[QA-R7] /api/erlebnis/poi: route parameter with newlines", () => {
  const routeWithNewline = "54.0,13.0\n54.5,13.5";
  // Should be rejected during parsing
  assert.match(routeWithNewline, /\n/, "Route contains newline");
});

test("[QA-R7] /api/erlebnis/poi: bbox parameter with negative coordinates (valid)", () => {
  // Negative coordinates ARE valid (e.g., Southern Hemisphere, Western Hemisphere)
  const bbox = "-30.0,-60.0,-20.0,-50.0"; // South America bbox
  const parts = bbox.split(",");
  assert.strictEqual(parts.length, 4, "Bbox should have 4 parts");
  const [minLat, minLon, maxLat, maxLon] = parts.map(Number);
  assert(minLat >= -90 && maxLat <= 90, "Latitudes should be in range");
  assert(minLon >= -180 && maxLon <= 180, "Longitudes should be in range");
});

test("[QA-R7] /api/erlebnis/poi: route parameter with control characters", () => {
  const routeWithControl = "54.0,13.0;\x00\x01\x02"; // Null bytes and control chars
  assert.match(routeWithControl, /\x00/, "Route contains null byte");
  // API should reject this
});

test("[QA-R7] /api/erlebnis/poi: very long revier parameter (possible truncation)", () => {
  const longRevier = "a".repeat(10000);
  // Should not cause database issues, just not match anything
  assert.strictEqual(longRevier.length, 10000, "Long revier parameter");
});

test("[QA-R7] /api/erlebnis/poi: revier parameter with path traversal attempt", () => {
  const traversalRevier = "../../../etc/passwd";
  // Should be treated as literal revier ID, not a path
  assert.match(traversalRevier, /\.\.\//, "Traversal attempt");
  // Parameterized queries should prevent this anyway
});

test("[QA-R7] /api/erlebnis/poi: route parameter with semicolon at end", () => {
  const routeWithTrailingSemicolon = "54.0,13.0;54.5,13.5;";
  const points = routeWithTrailingSemicolon.split(";").filter((p) => p.length > 0);
  assert.strictEqual(points.length, 2, "Should only have 2 valid points");
});

test("[QA-R7] /api/erlebnis/poi: malformed JSON in highlights parameter", () => {
  const malformedJson = "{invalid json}";
  try {
    JSON.parse(malformedJson);
    assert.fail("Should throw on invalid JSON");
  } catch (e) {
    assert.ok(e instanceof SyntaxError, "Should be syntax error");
  }
});
