import { test } from "node:test";
import assert from "node:assert";
import { validateToernShareId } from "../share";

test("[QA-R7] validateToernShareId: akzeptiert nur exakt 8 Zeichen", () => {
  // Valid case
  validateToernShareId("abcd1234");

  // Invalid cases should throw
  assert.throws(() => validateToernShareId("abc"));
  assert.throws(() => validateToernShareId("abcdefghij"));
  assert.throws(() => validateToernShareId(""));
});

test("[QA-R7] validateToernShareId: akzeptiert nur base36 (a-z, 0-9)", () => {
  // Invalid characters - all should throw
  assert.throws(() => validateToernShareId("ABCD1234"), /base36/);
  assert.throws(() => validateToernShareId("abcd!@#$"), /base36/);
  assert.throws(() => validateToernShareId("abcd__34"), /base36/);
  assert.throws(() => validateToernShareId("abcd 234"), /base36/);
  assert.throws(() => validateToernShareId("abcd-234"), /base36/);
});

test("[QA-R7] validateToernShareId: SQL-Injection-Versuch wird blockiert", () => {
  // SQL injection attempts should throw (invalid characters due to special chars)
  assert.throws(() => validateToernShareId("abc' OR;"), /base36|Zeichen/);
  assert.throws(() => validateToernShareId("abcd' OR"), /base36/);
  assert.throws(() => validateToernShareId("select'2"), /base36/); // 8 chars with apostrophe
});

test("[QA-R7] validateToernShareId: Unicode/UTF-8 wird blockiert", () => {
  // Unicode should throw (invalid characters)
  assert.throws(() => validateToernShareId("äöü12345"), /base36|Zeichen/);
  assert.throws(() => validateToernShareId("日本語12"), /base36|Zeichen/);
});

test("[QA-R7] validateToernShareId: Whitespace wird blockiert", () => {
  // Whitespace should throw
  assert.throws(() => validateToernShareId("abc12 34"), /base36/);
  assert.throws(() => validateToernShareId("abcd123\n"), /base36/);
  assert.throws(() => validateToernShareId("\tabcd123"), /base36/);
});
