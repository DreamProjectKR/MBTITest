import assert from "node:assert/strict";
import test from "node:test";

import { loadTestDetail } from "../../worker/api/tests/[id].ts";
import {
  createContext,
  createDetailDb,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

const BASE_URL = "https://example.com/api/tests/pub-test";
const OPT = { enforcePublished: true, useCache: true };

function ctx(overrides) {
  return createContext({
    url: BASE_URL,
    method: "GET",
    params: { id: "pub-test" },
    ...overrides,
  });
}

test("loadTestDetail: no R2 bucket -> 500", async () => {
  const res = await loadTestDetail(ctx({ env: { MBTI_DB: {} } }), OPT);
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.match(j.error, /MBTI_BUCKET|R2 binding/i);
});

test("loadTestDetail: no D1 -> 500", async () => {
  const res = await loadTestDetail(
    ctx({ env: { MBTI_BUCKET: {} }, params: { id: "x" } }),
    OPT,
  );
  assert.equal(res.status, 500);
});

test("loadTestDetail: empty id -> 400", async () => {
  const { bucket } = createJsonBucket({});
  const res = await loadTestDetail(
    createContext({
      url: "https://example.com/api/tests/",
      env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
      params: { id: "" },
    }),
    OPT,
  );
  assert.equal(res.status, 400);
});

test("loadTestDetail: KV get invalid JSON -> continues to origin", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({
      questions: [],
      results: {},
    }),
  });
  const env = {
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
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
    }),
    MBTI_KV: {
      async get() {
        return "not-json{";
      },
      async put() {},
      async delete() {},
    },
  };
  const res = await loadTestDetail(ctx({ env }), OPT);
  assert.equal(res.status, 200);
});

test("loadTestDetail: KV get throws -> continues to D1+R2", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({
      id: "pub-test",
      title: "From R2 after KV throw",
      questions: [],
      results: {},
    }),
  });
  const env = {
    MBTI_KV: {
      async get() {
        throw new Error("kv unavailable");
      },
      async put() {},
      async delete() {},
    },
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
      test_id: "pub-test",
      title: "T",
      description_json: "[]",
      author: "a",
      author_img_path: "a",
      thumbnail_path: "t",
      tags_json: "[]",
      source_path: "pub-test/test.json",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      is_published: 1,
    }),
  };
  const res = await loadTestDetail(ctx({ env }), OPT);
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.title, "From R2 after KV throw");
});

test("loadTestDetail: KV hit returns 304 when If-None-Match matches", async () => {
  const etagVal = '"kv-etag-1"';
  const kvBody = { etag: etagVal, body: { id: "pub-test", questions: [] } };
  const env = {
    MBTI_KV: {
      async get() {
        return JSON.stringify(kvBody);
      },
      async put() {},
      async delete() {},
    },
    MBTI_BUCKET: {},
    MBTI_DB: {},
  };
  const res = await loadTestDetail(
    createContext({
      url: BASE_URL,
      env,
      params: { id: "pub-test" },
      headers: { "if-none-match": etagVal },
    }),
    OPT,
  );
  assert.equal(res.status, 304);
});

test("loadTestDetail: KV hit returns 200 JSON without If-None-Match", async () => {
  const kvBody = { etag: '"e2"', body: { id: "pub-test", title: "From KV" } };
  const env = {
    MBTI_KV: {
      async get() {
        return JSON.stringify(kvBody);
      },
      async put() {},
      async delete() {},
    },
    MBTI_BUCKET: {},
    MBTI_DB: {},
  };
  const res = await loadTestDetail(ctx({ env }), OPT);
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.title, "From KV");
});

test("loadTestDetail: KV hit returns 200 when If-None-Match does not match cached etag", async () => {
  const kvBody = {
    etag: '"kv-current"',
    body: { id: "pub-test", title: "Stale INM" },
  };
  const env = {
    MBTI_KV: {
      async get() {
        return JSON.stringify(kvBody);
      },
      async put() {},
      async delete() {},
    },
    MBTI_BUCKET: {},
    MBTI_DB: {},
  };
  const res = await loadTestDetail(
    createContext({
      url: BASE_URL,
      env,
      params: { id: "pub-test" },
      headers: { "if-none-match": '"other"' },
    }),
    OPT,
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.title, "Stale INM");
});

test("loadTestDetail: KV hit with object body but no etag skips 304 and returns 200", async () => {
  const kvBody = { body: { id: "pub-test", title: "KV no etag" } };
  const env = {
    MBTI_KV: {
      async get() {
        return JSON.stringify(kvBody);
      },
      async put() {},
      async delete() {},
    },
    MBTI_BUCKET: {},
    MBTI_DB: {},
  };
  const res = await loadTestDetail(
    createContext({
      url: BASE_URL,
      env,
      params: { id: "pub-test" },
      headers: { "if-none-match": '"any"' },
    }),
    OPT,
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.title, "KV no etag");
});

test("loadTestDetail: KV entry with non-object body skips shortcut and uses R2", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({
      id: "pub-test",
      title: "From R2",
      questions: [],
      results: {},
    }),
  });
  const kvBody = { etag: '"e-bad-body"', body: "not-a-record" };
  const env = {
    MBTI_KV: {
      async get() {
        return JSON.stringify(kvBody);
      },
      async put() {},
      async delete() {},
    },
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
      test_id: "pub-test",
      title: "T",
      description_json: "[]",
      author: "a",
      author_img_path: "a",
      thumbnail_path: "t",
      tags_json: "[]",
      source_path: "pub-test/test.json",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      is_published: 1,
    }),
  };
  const res = await loadTestDetail(ctx({ env }), OPT);
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.title, "From R2");
});

test("loadTestDetail: missing R2 body -> 404", async () => {
  const { bucket } = createJsonBucket({});
  const env = {
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
      test_id: "pub-test",
      title: "T",
      description_json: "[]",
      author: "a",
      author_img_path: "a",
      thumbnail_path: "t",
      tags_json: "[]",
      source_path: "pub-test/test.json",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      is_published: 1,
    }),
  };
  const res = await loadTestDetail(ctx({ env }), OPT);
  assert.equal(res.status, 404);
  const j = await res.json();
  assert.match(j.error, /not found|Test JSON/i);
});

test("loadTestDetail: invalid JSON in R2 -> 500", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": "{broken",
  });
  const env = {
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
      test_id: "pub-test",
      title: "T",
      description_json: "[]",
      author: "a",
      author_img_path: "a",
      thumbnail_path: "t",
      tags_json: "[]",
      source_path: "pub-test/test.json",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      is_published: 1,
    }),
  };
  const res = await loadTestDetail(ctx({ env }), OPT);
  assert.equal(res.status, 500);
});

test("loadTestDetail: KV entry with etag but no body falls through to D1+R2", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({
      id: "pub-test",
      title: "From R2 after KV body miss",
      questions: [],
      results: {},
    }),
  });
  const env = {
    MBTI_KV: {
      async get() {
        return JSON.stringify({ etag: '"etag-only"' });
      },
      async put() {},
      async delete() {},
    },
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
      test_id: "pub-test",
      title: "T",
      description_json: "[]",
      author: "a",
      author_img_path: "a",
      thumbnail_path: "t",
      tags_json: "[]",
      source_path: "pub-test/test.json",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      is_published: 1,
    }),
  };
  const res = await loadTestDetail(ctx({ env }), OPT);
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.title, "From R2 after KV body miss");
});

test("loadTestDetail: admin useCache false returns 304 when If-None-Match matches", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({ questions: [], results: {} }),
  });
  const env = {
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
      test_id: "pub-test",
      title: "T",
      description_json: "[]",
      author: "a",
      author_img_path: "a",
      thumbnail_path: "t",
      tags_json: "[]",
      source_path: "pub-test/test.json",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      is_published: 1,
    }),
  };
  const pubUrl = new URL("https://example.com/api/tests/pub-test");
  const pubFirst = await loadTestDetail(
    createContext({ url: pubUrl.href, env, params: { id: "pub-test" } }),
    { enforcePublished: true, useCache: true },
  );
  assert.equal(pubFirst.status, 200);
  const etag = pubFirst.headers.get("ETag");
  assert.ok(etag);

  const adminOpt = { enforcePublished: false, useCache: false };
  const adminUrl = "https://example.com/api/admin/tests/pub-test";
  const second = await loadTestDetail(
    createContext({
      url: adminUrl,
      env,
      params: { id: "pub-test" },
      headers: { "if-none-match": etag },
    }),
    adminOpt,
  );
  assert.equal(second.status, 304);
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "BYPASS");
});
