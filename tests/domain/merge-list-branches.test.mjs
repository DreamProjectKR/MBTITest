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
  assert.equal(parseJsonArray("5"), null);
  assert.equal(parseJsonArray("true"), null);
  assert.equal(parseJsonArray("null"), null);
});

test("parseJsonArray returns array for valid JSON array strings", () => {
  assert.deepEqual(parseJsonArray(JSON.stringify(["a", "b"])), ["a", "b"]);
  assert.deepEqual(parseJsonArray("[]"), []);
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

test("mergeTestDetailPayload: non-string description_json yields null description", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "t",
      title: "T",
      description_json: 123,
      tags_json: "[]",
    },
    null,
  );
  assert.equal(p.description, null);
});

test("mergeTestDetailPayload: non-string tags_json yields empty tags", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "t",
      title: "T",
      tags_json: 99,
    },
    null,
  );
  assert.deepEqual(p.tags, []);
});

test("mergeTestDetailPayload spreads body when object", () => {
  const p = mergeTestDetailPayload({ test_id: "t", title: "T" }, { extra: 1 });
  assert.equal(p.extra, 1);
});

test("mergeTestDetailPayload body object overrides D1 id and title", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "from-row",
      title: "Row title",
      tags_json: "[]",
    },
    { id: "from-body", title: "Body title", tags: ["a"] },
  );
  assert.equal(p.id, "from-body");
  assert.equal(p.title, "Body title");
  assert.deepEqual(p.tags, ["a"]);
});

test("mergeTestDetailPayload ignores non-object bodyJson", () => {
  const p = mergeTestDetailPayload(
    { test_id: "t", title: "T" },
    "not-an-object",
  );
  assert.equal(p.extra, undefined);
});

test("mergeTestDetailPayload spreads array bodyJson index keys", () => {
  const p = mergeTestDetailPayload({ test_id: "t", title: "T" }, ["x", "y"]);
  assert.equal(p[0], "x");
  assert.equal(p[1], "y");
});

test("mergeTestDetailPayload filters falsy description entries", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "t",
      description_json: JSON.stringify(["a", null, "", "b"]),
    },
    null,
  );
  assert.deepEqual(p.description, ["a", "b"]);
});

test("mergeTestDetailPayload: description array only non-string or falsy becomes empty", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "t",
      description_json: JSON.stringify(["", false, 0, null]),
    },
    null,
  );
  assert.deepEqual(p.description, []);
});

test("mergeTestDetailPayload: empty description array stays empty array", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "t",
      description_json: "[]",
    },
    null,
  );
  assert.deepEqual(p.description, []);
});

test("mergeTestDetailPayload: all-null description array becomes empty after filter", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "t",
      description_json: "[null,null]",
    },
    null,
  );
  assert.deepEqual(p.description, []);
});

test("mergeTestDetailPayload filters non-string tags from JSON array", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "t",
      description_json: "[]",
      tags_json: JSON.stringify(["a", 1, null, "b"]),
    },
    null,
  );
  assert.deepEqual(p.tags, ["a", "b"]);
});

test("mergeTestDetailPayload uses empty strings for falsy row string fields", () => {
  const p = mergeTestDetailPayload(
    {
      test_id: "tid",
      title: null,
      author: null,
      author_img_path: null,
      thumbnail_path: null,
      source_path: null,
      created_at: null,
      updated_at: null,
      description_json: null,
      tags_json: null,
    },
    null,
  );
  assert.equal(p.title, "");
  assert.equal(p.author, "");
  assert.equal(p.authorImg, "");
  assert.equal(p.thumbnail, "");
  assert.equal(p.path, "");
  assert.equal(p.createdAt, "");
  assert.equal(p.updatedAt, "");
});

test("buildTestDetailEtag handles null row and null etag", () => {
  assert.equal(buildTestDetailEtag(null, null), '"|"');
});

test("buildTestDetailEtag joins row updated_at and R2 etag", () => {
  assert.equal(
    buildTestDetailEtag({ updated_at: "2026-01-02" }, "etag-r2"),
    '"etag-r2|2026-01-02"',
  );
});

test("buildTestDetailEtag with null row keeps D1 part empty", () => {
  assert.equal(buildTestDetailEtag(null, "only-r2"), '"only-r2|"');
});

test("buildTestDetailEtag treats empty updated_at like missing", () => {
  assert.equal(buildTestDetailEtag({ updated_at: "" }, "e"), '"e|"');
});

test("isPublishedRow is false for null row", () => {
  assert.equal(isPublishedRow(null), false);
});

test("isPublishedRow is true when is_published is truthy", () => {
  assert.equal(isPublishedRow({ is_published: 1 }), true);
});

test("isPublishedRow is false when is_published is 0", () => {
  assert.equal(isPublishedRow({ is_published: 0 }), false);
});

test("buildTestDetailEtag uses empty R2 segment when resolved etag is empty string", () => {
  assert.equal(
    buildTestDetailEtag({ updated_at: "2026-03-01" }, ""),
    '"|2026-03-01"',
  );
});

test("mergeTestDetailPayload with null bodyJson skips spread", () => {
  const p = mergeTestDetailPayload({ test_id: "x", title: "T" }, null);
  assert.equal(p.id, "x");
  assert.equal(Object.keys(p).includes("extra"), false);
});

test("mergeTestDetailPayload: truthy non-object bodyJson does not spread", () => {
  const row = { test_id: "t", title: "T" };
  assert.equal(mergeTestDetailPayload(row, true).extra, undefined);
  assert.equal(mergeTestDetailPayload(row, 1).extra, undefined);
  assert.equal(mergeTestDetailPayload(row, Symbol("x")).extra, undefined);
});

test("mergeTestDetailPayload: falsy bodyJson 0 skips spread", () => {
  const p = mergeTestDetailPayload({ test_id: "t", title: "T" }, 0);
  assert.equal(p.extra, undefined);
});

test("mergeTestDetailPayload spreads null-prototype body object", () => {
  const body = Object.create(null);
  body.mergedKey = "from-null-proto";
  const p = mergeTestDetailPayload({ test_id: "t", title: "Row" }, body);
  assert.equal(p.mergedKey, "from-null-proto");
  assert.equal(p.title, "Row");
});

test("mergeTestDetailPayload spreads boxed String body as object-typed value", () => {
  const body = Object("extra");
  const p = mergeTestDetailPayload({ test_id: "t", title: "Row" }, body);
  assert.equal(p[0], "e");
  assert.equal(p.title, "Row");
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
