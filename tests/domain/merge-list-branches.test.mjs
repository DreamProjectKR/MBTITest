import assert from "node:assert/strict";
import test from "node:test";

import {
  computeTestsIndexEtag,
  mapRowToTestMeta,
  safeJsonArray,
} from "../../worker/domain/tests/listPayload.ts";
import {
  buildTestDetailEtag,
  isPublishedRow,
  mergeTestDetailPayload,
  parseJsonArray,
} from "../../worker/domain/tests/mergePayload.ts";

test("parseJsonArray covers non-string, invalid JSON, non-array", () => {
  assert.equal(parseJsonArray(null), null);
  assert.equal(parseJsonArray("{"), null);
  assert.equal(parseJsonArray(JSON.stringify({ a: 1 })), null);
});

test("mergeTestDetailPayload uses empty description when JSON not array", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "t",
      description_json: JSON.stringify({ not: "array" }),
      tags_json: "not-json",
    },
    null,
  );
  assert.equal(p.description, null);
  assert.deepEqual(p.tags, []);
});

test("mergeTestDetailPayload spreads body when object", () => {
  const p = mergeTestDetailPayload({ test_id: "t", title: "T" }, { extra: 1 });
  assert.equal(p.extra, 1);
});

test("buildTestDetailEtag handles null row and null etag", () => {
  assert.equal(buildTestDetailEtag(null, null), '"|"');
});

test("isPublishedRow is false for null row", () => {
  assert.equal(isPublishedRow(null), false);
});

test("safeJsonArray returns [] on invalid JSON string", () => {
  assert.deepEqual(safeJsonArray("{"), []);
});

test("mapRowToTestMeta handles missing optional fields", () => {
  const m = mapRowToTestMeta({});
  assert.equal(m.id, "");
  assert.equal(m.thumbnail, "");
});

test("computeTestsIndexEtag picks max updatedAt", () => {
  const e = computeTestsIndexEtag([
    {
      updatedAt: "2026-01-01",
      id: "a",
      title: "",
      thumbnail: "",
      tags: [],
      path: "",
      createdAt: "",
      is_published: true,
    },
    {
      updatedAt: "2026-02-01",
      id: "b",
      title: "",
      thumbnail: "",
      tags: [],
      path: "",
      createdAt: "",
      is_published: true,
    },
  ]);
  assert.match(e, /2026-02-01/);
});
