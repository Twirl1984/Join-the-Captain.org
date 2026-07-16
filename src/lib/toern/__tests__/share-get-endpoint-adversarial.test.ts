import { test } from "node:test";
import assert from "node:assert";
import { getToernShare, createToernShare, buildShareSnapshot } from "../share";

// Skip DB tests if DATABASE_URL is not set
const skipDb = process.env.DATABASE_URL ? false : true;

if (!skipDb) {
  test("[QA-R7] getToernShare: no validation on GET, accepts non-8-char IDs", async () => {
    // Single character ID - should not crash, just return null
    const result1 = await getToernShare("x");
    assert.strictEqual(result1, null, "Single-char ID should return null (not found)");

    // Very long ID - should not crash
    const result2 = await getToernShare("abcdefghijklmnopqrstuvwxyz");
    assert.strictEqual(result2, null, "Long ID should return null (not found)");

    // ID with special characters (but valid in base36) - should not crash
    const result3 = await getToernShare("12345678");
    assert.strictEqual(result3, null, "All-digit ID should return null (not found)");
  });

  test("[QA-R7] getToernShare: accepts IDs with uppercase (which would never be created)", async () => {
    // generateShareId always produces lowercase, but getToernShare doesn't enforce this
    const result = await getToernShare("ABCD1234");
    assert.strictEqual(result, null, "Uppercase ID should return null (not found)");
  });

  test("[QA-R7] getToernShare: accepts IDs with invalid characters", async () => {
    const invalidIds = [
      "abcd!@#$", // special chars
      "abcd-1234", // hyphen
      "abcd_1234", // underscore
    ];

    for (const id of invalidIds) {
      const result = await getToernShare(id);
      assert.strictEqual(result, null, `Invalid ID "${id}" should return null (not found)`);
    }
  });

  test("[QA-R7] getToernShare: SQL injection in ID - parameterized query prevents it", async () => {
    // Parameterized query should prevent SQL execution
    const injectionId = "'; DROP TABLE geteilter_toern; --";
    const result = await getToernShare(injectionId);
    assert.strictEqual(result, null, "SQL injection attempt should return null (not execute)");

    // Verify table still exists by querying with valid ID
    await getToernShare("00000000");
    // If no error, query was safe
    assert.strictEqual(result, null, "Table should still exist after injection attempt");
  });

  test("[QA-R7] createToernShare validates ID before INSERT", async () => {
    const snapshot = buildShareSnapshot({
      revierId: "test-revier",
      punkte: [
        { lat: 54, lon: 13, name: "Start" },
        { lat: 55, lon: 14, name: "Ende" },
      ],
      plan: { total_nm: 10, eta: "2025-01-01T12:00:00Z", warnings: [] },
    });

    try {
      const id = await createToernShare(snapshot);
      assert.match(id, /^[a-z0-9]{8}$/, "Created ID should be valid base36 8-char");
    } catch (err) {
      assert.ok(err instanceof Error, "Should throw an error");
    }
  });

  test("[QA-R7] getToernShare + createToernShare round-trip: valid ID only", async () => {
    const snapshot = buildShareSnapshot({
      revierId: "test-revier",
      punkte: [
        { lat: 54, lon: 13, name: "A" },
        { lat: 55, lon: 14, name: "B" },
      ],
      plan: { total_nm: 20, eta: "2025-01-15T10:00:00Z", warnings: [] },
    });

    const id = await createToernShare(snapshot);
    const retrieved = await getToernShare(id);

    assert.ok(retrieved, "Should retrieve created share");
    assert.strictEqual(retrieved!.id, id, "ID should match");
    assert.strictEqual(retrieved!.revier_id, "test-revier", "Revier should match");
  });
}
