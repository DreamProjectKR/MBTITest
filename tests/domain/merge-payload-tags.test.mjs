import assert from "node:assert/strict";
import test from "node:test";

import { mergeTestDetailPayload } from "../../worker/domain/tests/mergePayload.ts";

test("mergeTestDetailPayload: tags_json null uses empty tags", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "x",
      title: "T",
      tags_json: null,
    },
    {},
  );
  assert.deepEqual(p.tags, []);
});

test("mergeTestDetailPayload: tags_json parses string array", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "x",
      title: "T",
      tags_json: '["a","b"]',
    },
    {},
  );
  assert.deepEqual(p.tags, ["a", "b"]);
});
