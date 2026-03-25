import assert from "node:assert/strict";
import test from "node:test";

import {
  JSON_HEADERS,
  withCacheHeaders,
} from "../../worker/api/_utils/http.ts";
import { listTests } from "../../worker/api/tests/index.ts";
import {
  computeTestsIndexEtag,
  mapRowToTestMeta,
} from "../../worker/domain/tests/listPayload.ts";
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

test("listTests: useCache false If-None-Match matches D1 etag -> 304 BYPASS", async () => {
  const url = "https://example.com/api/tests?bypass304=1";
  const etag = computeTestsIndexEtag([mapRowToTestMeta(ROW)]);
  const res = await listTests(
    createContext({
      url,
      env: { MBTI_DB: createIndexDb([ROW]) },
      headers: { "if-none-match": etag },
    }),
    { publishedOnly: true, useCache: false },
  );
  assert.equal(res.status, 304);
  assert.equal(res.headers.get("X-MBTI-Edge-Cache"), "BYPASS");
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

test("listTests: D1 If-None-Match 304 uses headersFactory when useCache true", async () => {
  const url = "https://example.com/api/tests?headersFactory304=1";
  const env = { MBTI_DB: createIndexDb([ROW]) };
  const first = await listTests(createContext({ url, env }), {
    publishedOnly: true,
    useCache: true,
    headersFactory: (etag) =>
      withCacheHeaders(JSON_HEADERS, {
        etag,
        maxAge: 30,
        sMaxAge: 300,
        staleWhileRevalidate: 600,
      }),
  });
  assert.equal(first.status, 200);
  const etag = first.headers.get("ETag");
  assert.ok(etag);
  const notModified = await listTests(
    createContext({
      url,
      env,
      headers: { "if-none-match": etag },
    }),
    {
      publishedOnly: true,
      useCache: true,
      headersFactory: (e) =>
        withCacheHeaders(JSON_HEADERS, {
          etag: e,
          maxAge: 30,
          sMaxAge: 300,
          staleWhileRevalidate: 600,
        }),
    },
  );
  assert.equal(notModified.status, 304);
  assert.equal(notModified.headers.get("X-MBTI-Edge-Cache"), "MISS");
  assert.ok(notModified.headers.get("ETag"));
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
