import assert from "node:assert/strict";
import test from "node:test";

import {
  computeTestsIndexEtag,
  mapRowToTestMeta,
  safeJsonArray,
} from "../../worker/domain/tests/listPayload.ts";

test("safeJsonArray: non-string input", () => {
  assert.deepEqual(safeJsonArray(null), []);
  assert.deepEqual(safeJsonArray(1), []);
});

test("safeJsonArray: JSON that is not an array", () => {
  assert.deepEqual(safeJsonArray("{}"), []);
});

test("safeJsonArray: array with non-strings filtered out", () => {
  assert.deepEqual(safeJsonArray('["a",1,"b"]'), ["a", "b"]);
});

test("computeTestsIndexEtag: empty list", () => {
  assert.equal(computeTestsIndexEtag([]), '"0-"');
});

test("computeTestsIndexEtag: picks lexicographic max updatedAt", () => {
  const e = computeTestsIndexEtag([
    { updatedAt: "2024-01-01" },
    { updatedAt: "2025-01-01" },
  ]);
  assert.match(e, /2025-01-01/);
});

test("mapRowToTestMeta: optional fields missing", () => {
  const m = mapRowToTestMeta({
    test_id: "x",
    title: "T",
    thumbnail_path: null,
    tags_json: "[]",
    source_path: null,
    created_at: null,
    updated_at: null,
    is_published: 0,
  });
  assert.equal(m.thumbnail, "");
  assert.equal(m.path, "");
  assert.equal(m.createdAt, "");
  assert.equal(m.updatedAt, "");
  assert.equal(m.is_published, false);
});
