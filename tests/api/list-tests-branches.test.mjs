import assert from "node:assert/strict";
import test from "node:test";

import {
  JSON_HEADERS,
  cacheKeyForGet,
  withCacheHeaders,
} from "../../worker/api/_utils/http.ts";
import { listTests } from "../../worker/api/tests/index.ts";
import {
  createContext,
  createIndexDb,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

const cacheMemory = new Map();
installDefaultCacheStub({
  async match(req) {
    const key = new URL(req.url).origin + new URL(req.url).pathname;
    return cacheMemory.get(key) ?? null;
  },
  async put(req, res) {
    const key = new URL(req.url).origin + new URL(req.url).pathname;
    cacheMemory.set(key, res.clone());
  },
});

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

test("listTests: Cache API HIT on second request", async () => {
  const url = new URL("https://example.com/api/tests?cachebranch=1");
  const env = { MBTI_DB: createIndexDb([ROW]) };
  const first = await listTests(createContext({ url: url.href, env }), {
    publishedOnly: true,
    useCache: true,
  });
  assert.equal(first.status, 200);
  await caches.default.put(cacheKeyForGet(url), first.clone());
  const second = await listTests(createContext({ url: url.href, env }), {
    publishedOnly: true,
    useCache: true,
  });
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "HIT");
});

test("listTests: Cache HIT returns 304 when If-None-Match matches cached ETag", async () => {
  const url = new URL("https://example.com/api/tests?cache304=1");
  const env = { MBTI_DB: createIndexDb([ROW]) };
  const first = await listTests(createContext({ url: url.href, env }), {
    publishedOnly: true,
    useCache: true,
  });
  assert.equal(first.status, 200);
  const etag = first.headers.get("ETag");
  assert.ok(etag);
  await caches.default.put(cacheKeyForGet(url), first.clone());
  const notModified = await listTests(
    createContext({
      url: url.href,
      env,
      headers: { "if-none-match": etag },
    }),
    { publishedOnly: true, useCache: true },
  );
  assert.equal(notModified.status, 304);
  assert.equal(notModified.headers.get("X-MBTI-Edge-Cache"), "HIT");
});

test("listTests: responseHeaders merged into response", async () => {
  const res = await listTests(
    createContext({
      url: "https://example.com/api/tests",
      env: { MBTI_DB: createIndexDb([ROW]) },
    }),
    {
      publishedOnly: true,
      useCache: false,
      responseHeaders: { "X-Test-Extra": "1" },
    },
  );
  assert.equal(res.headers.get("X-Test-Extra"), "1");
});

test("listTests: headersFactory overrides default cache headers when useCache", async () => {
  const res = await listTests(
    createContext({
      url: "https://example.com/api/tests",
      env: { MBTI_DB: createIndexDb([ROW]) },
    }),
    {
      publishedOnly: true,
      useCache: true,
      headersFactory: (etag) =>
        withCacheHeaders(JSON_HEADERS, {
          etag,
          maxAge: 30,
          sMaxAge: 300,
          staleWhileRevalidate: 600,
        }),
    },
  );
  assert.equal(res.status, 200);
  assert.ok(res.headers.get("ETag"));
});
