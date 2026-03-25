import assert from "node:assert/strict";
import test from "node:test";

import { safeJsonArray } from "../../worker/domain/tests/listPayload.ts";
import { parseJsonArray } from "../../worker/domain/tests/mergePayload.ts";

test("safeJsonArray returns [] on invalid JSON string", () => {
  assert.deepEqual(safeJsonArray("[}"), []);
});

test("parseJsonArray returns null on invalid JSON", () => {
  assert.equal(parseJsonArray("{"), null);
});
