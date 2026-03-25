import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { cacheKeyForGet } from "../../worker/api/_utils/http.ts";
import { loadTestDetail } from "../../worker/api/tests/[id].ts";
import {
  createContext,
  createDetailDb,
  createJsonBucket,
  installInMemoryCacheStub,
} from "../shared/worker-harness.mjs";

beforeEach(() => {
  installInMemoryCacheStub();
});

const PUBLISHED_ROW = {
  test_id: "pub-test",
  title: "T",
  description_json: "[]",
  author: "a",
  author_img_path: "assets/pub-test/images/a.png",
  thumbnail_path: "assets/pub-test/images/t.png",
  tags_json: "[]",
  source_path: "pub-test/test.json",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  is_published: 1,
};

test("loadTestDetail: Cache API HIT returns 304 when If-None-Match matches", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({ questions: [], results: {} }),
  });
  const env = {
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb(PUBLISHED_ROW),
  };
  const url = new URL("https://example.com/api/tests/pub-test");
  const first = await loadTestDetail(
    createContext({ url: url.href, env, params: { id: "pub-test" } }),
    { enforcePublished: true, useCache: true },
  );
  assert.equal(first.status, 200);
  const etag = first.headers.get("ETag");
  assert.ok(etag);
  await caches.default.put(cacheKeyForGet(url), first.clone());

  const second = await loadTestDetail(
    createContext({
      url: url.href,
      env,
      params: { id: "pub-test" },
      headers: { "if-none-match": etag },
    }),
    { enforcePublished: true, useCache: true },
  );
  assert.equal(second.status, 304);
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "HIT");
});

test("loadTestDetail: Cache API HIT returns 200 body when no If-None-Match", async () => {
  const url = new URL("https://example.com/api/tests/pub-test");
  const cacheKey = cacheKeyForGet(url);
  const etag = '"only-cache"';
  const payload = { id: "pub-test", questions: [], fromCache: true };
  await caches.default.put(
    cacheKey,
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ETag: etag,
      },
    }),
  );

  const res = await loadTestDetail(
    createContext({
      url: url.href,
      env: {
        MBTI_BUCKET: createJsonBucket({}).bucket,
        MBTI_DB: createDetailDb(PUBLISHED_ROW),
      },
      params: { id: "pub-test" },
    }),
    { enforcePublished: true, useCache: true },
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("X-MBTI-Edge-Cache"), "HIT");
  const j = await res.json();
  assert.equal(j.fromCache, true);
});

test("loadTestDetail: invalid_path whitespace source_path -> 500", async () => {
  const { bucket } = createJsonBucket({});
  const env = {
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
      ...PUBLISHED_ROW,
      source_path: "   ",
    }),
  };
  const res = await loadTestDetail(
    createContext({
      url: "https://example.com/api/tests/pub-test",
      env,
      params: { id: "pub-test" },
    }),
    { enforcePublished: true, useCache: true },
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.match(j.error, /empty path/i);
});

test("loadTestDetail: admin no-cache 200 uses no-store", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({ questions: [], results: {} }),
  });
  const env = {
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb(PUBLISHED_ROW),
  };
  const res = await loadTestDetail(
    createContext({
      url: "https://example.com/api/admin/tests/pub-test",
      env,
      params: { id: "pub-test" },
    }),
    { enforcePublished: false, useCache: false },
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control") || "", /no-store|max-age=0/);
});

test("loadTestDetail: D1 If-None-Match matches etag -> 304 (useCache true)", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({ questions: [], results: {} }),
  });
  const env = {
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb(PUBLISHED_ROW),
  };
  const url = new URL("https://example.com/api/tests/pub-test");
  const first = await loadTestDetail(
    createContext({ url: url.href, env, params: { id: "pub-test" } }),
    { enforcePublished: true, useCache: true },
  );
  assert.equal(first.status, 200);
  const etag = first.headers.get("ETag");
  await caches.default.delete(cacheKeyForGet(url));
  const second = await loadTestDetail(
    createContext({
      url: url.href,
      env,
      params: { id: "pub-test" },
      headers: { "if-none-match": etag },
    }),
    { enforcePublished: true, useCache: true },
  );
  assert.equal(second.status, 304);
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "MISS");
});
