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

test("mergeTestDetailPayload: tags_json drops non-string entries", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "x",
      title: "T",
      tags_json: '["a",1,null,"b"]',
    },
    {},
  );
  assert.deepEqual(p.tags, ["a", "b"]);
});

test("mergeTestDetailPayload: tags_json empty JSON array yields empty tags", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "x",
      title: "T",
      tags_json: "[]",
    },
    {},
  );
  assert.deepEqual(p.tags, []);
});

test("mergeTestDetailPayload: non-object bodyJson does not spread into payload", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "x",
      title: "T",
    },
    42,
  );
  assert.equal(p.id, "x");
  assert.equal(p.title, "T");
  assert.equal("42" in p, false);
});

test("mergeTestDetailPayload: truthy string bodyJson does not spread (typeof !== object)", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "x",
      title: "T",
    },
    "not-an-object",
  );
  assert.equal(p.id, "x");
  assert.equal(p.title, "T");
  assert.equal("0" in p, false);
});
