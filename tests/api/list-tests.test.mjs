import assert from "node:assert/strict";
import test from "node:test";

import { listTests } from "../../worker/api/tests/index.ts";
import {
  createContext,
  createIndexDb,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

const ROW = {
  test_id: "t1",
  title: "One",
  thumbnail_path: "assets/t1/images/thumbnail.png",
  tags_json: "[]",
  source_path: "t1/test.json",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  is_published: 1,
};

test("listTests: no D1 -> 500", async () => {
  const res = await listTests(
    createContext({ url: "https://example.com/api/tests", env: {} }),
    { publishedOnly: true, useCache: true },
  );
  assert.equal(res.status, 500);
});

test("listTests: If-None-Match matches etag -> 304", async () => {
  const url = "https://example.com/api/tests?nocache=1";
  const first = await listTests(
    createContext({
      url,
      env: { MBTI_DB: createIndexDb([ROW]) },
    }),
    { publishedOnly: true, useCache: true },
  );
  assert.equal(first.status, 200);
  const etag = first.headers.get("ETag");
  assert.ok(etag);
  const notModified = await listTests(
    createContext({
      url,
      env: { MBTI_DB: createIndexDb([ROW]) },
      headers: { "if-none-match": etag },
    }),
    { publishedOnly: true, useCache: true },
  );
  assert.equal(notModified.status, 304);
});

test("listTests: publishedOnly false uses admin list", async () => {
  const draft = { ...ROW, test_id: "d1", is_published: 0 };
  const res = await listTests(
    createContext({
      url: "https://example.com/api/admin/tests",
      env: { MBTI_DB: createIndexDb([ROW, draft]) },
    }),
    { publishedOnly: false, useCache: false },
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.tests.length, 2);
});
