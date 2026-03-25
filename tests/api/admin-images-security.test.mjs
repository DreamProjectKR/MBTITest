import assert from "node:assert/strict";
import test from "node:test";

import {
  onRequestGet,
  onRequestPut,
} from "../../worker/api/admin/tests/[id]/images.ts";
import { MAX_IMAGE_UPLOAD_BYTES } from "../../worker/api/_utils/bodyLimits.ts";
import { RATE_IMAGE_PUT_PER_WINDOW } from "../../worker/api/_utils/rateLimit.ts";
import {
  createContext,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";
import { createMemoryKv } from "../shared/kv-harness.mjs";

const baseUrl = "https://example.com/api/admin/tests/sec-test/images";

function createUpsertDb() {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };
}

function smallPngFormData() {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const fd = new FormData();
  fd.append("file", new Blob([png], { type: "image/png" }), "t.png");
  fd.append("name", "thumbnail");
  return fd;
}

test("onRequestGet: POST -> 405", async () => {
  installDefaultCacheStub();
  const res = await onRequestGet(
    createContext({
      url: baseUrl,
      method: "POST",
      env: { MBTI_DB: createUpsertDb() },
      params: { id: "sec-test" },
    }),
  );
  assert.equal(res.status, 405);
  const body = await res.json();
  assert.equal(body.error, "Method not allowed.");
});

test("onRequestGet: no MBTI_DB -> 500", async () => {
  installDefaultCacheStub();
  const res = await onRequestGet(
    createContext({
      url: baseUrl,
      method: "GET",
      env: {},
      params: { id: "sec-test" },
    }),
  );
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.match(body.error, /MBTI_DB is missing/);
});

test("onRequestGet: empty test id -> 400", async () => {
  installDefaultCacheStub();
  const res = await onRequestGet(
    createContext({
      url: baseUrl,
      method: "GET",
      env: { MBTI_DB: createUpsertDb() },
      params: { id: "   " },
    }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "Missing test id.");
});

test("onRequestGet: success returns items array", async () => {
  installDefaultCacheStub();
  const row = {
    id: 42,
    test_id: "sec-test",
    image_key: "assets/sec-test/images/thumbnail.png",
    image_type: "thumbnail",
    image_name: "thumbnail",
    content_type: "image/png",
    size_bytes: 100,
    uploaded_at: "2025-01-01T00:00:00.000Z",
  };
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          return { results: [row] };
        },
      };
    },
  };

  const res = await onRequestGet(
    createContext({
      url: baseUrl,
      method: "GET",
      env: { MBTI_DB: db },
      params: { id: "sec-test" },
    }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].path, "sec-test/images/thumbnail.png");
  assert.equal(body.items[0].url, "/assets/sec-test/images/thumbnail.png");
});

test("onRequestGet: list throws -> 500", async () => {
  installDefaultCacheStub();
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          throw new Error("list boom");
        },
      };
    },
  };

  const res = await onRequestGet(
    createContext({
      url: baseUrl,
      method: "GET",
      env: { MBTI_DB: db },
      params: { id: "sec-test" },
    }),
  );
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.match(body.error, /list boom/);
});

test("onRequestPut: raw body image/svg+xml -> 415", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket();
  const res = await onRequestPut(
    createContext({
      url: baseUrl,
      method: "PUT",
      env: {
        MBTI_BUCKET: bucket,
        MBTI_DB: createUpsertDb(),
        MBTI_KV: createMemoryKv(),
      },
      params: { id: "sec-test" },
      headers: { "content-type": "image/svg+xml" },
      body: new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"),
    }),
  );
  assert.equal(res.status, 415);
  const body = await res.json();
  assert.match(body.error, /SVG uploads are not allowed/);
});

test("onRequestPut: multipart File with image/svg+xml -> 415", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket();
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new TextEncoder().encode("<svg/>")], {
      type: "image/svg+xml",
    }),
    "x.svg",
  );
  fd.append("name", "thumb");

  const res = await onRequestPut(
    createContext({
      url: baseUrl,
      method: "PUT",
      env: {
        MBTI_BUCKET: bucket,
        MBTI_DB: createUpsertDb(),
        MBTI_KV: createMemoryKv(),
      },
      params: { id: "sec-test" },
      body: fd,
    }),
  );
  assert.equal(res.status, 415);
  const body = await res.json();
  assert.match(body.error, /SVG uploads are not allowed/);
});

test("onRequestPut: Content-Length over max on raw PUT -> 413", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket();
  const res = await onRequestPut(
    createContext({
      url: baseUrl,
      method: "PUT",
      env: {
        MBTI_BUCKET: bucket,
        MBTI_DB: createUpsertDb(),
        MBTI_KV: createMemoryKv(),
      },
      params: { id: "sec-test" },
      headers: {
        "content-type": "image/png",
        "content-length": String(MAX_IMAGE_UPLOAD_BYTES + 1),
      },
      body: new Uint8Array([1, 2, 3, 4]),
    }),
  );
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.equal(body.error, "Payload too large.");
});

test("onRequestPut: multipart small png -> 200 with path", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket();
  const res = await onRequestPut(
    createContext({
      url: baseUrl,
      method: "PUT",
      env: {
        MBTI_BUCKET: bucket,
        MBTI_DB: createUpsertDb(),
        MBTI_KV: createMemoryKv(),
      },
      params: { id: "sec-test" },
      body: smallPngFormData(),
    }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.match(body.path, /thumbnail\.png$/);
  assert.match(body.key, /assets\/sec-test\/images\/thumbnail\.png$/);
});

test(`onRequestPut: ${RATE_IMAGE_PUT_PER_WINDOW + 1} rapid PUTs same IP -> last 429`, async () => {
  installDefaultCacheStub();
  const kv = createMemoryKv();
  const { bucket } = createJsonBucket();
  const db = createUpsertDb();
  const ipHeaders = { "cf-connecting-ip": "198.51.100.50" };

  for (let i = 0; i < RATE_IMAGE_PUT_PER_WINDOW; i++) {
    const res = await onRequestPut(
      createContext({
        url: baseUrl,
        method: "PUT",
        env: {
          MBTI_BUCKET: bucket,
          MBTI_DB: db,
          MBTI_KV: kv,
        },
        params: { id: "rate-test" },
        headers: ipHeaders,
        body: smallPngFormData(),
      }),
    );
    assert.equal(
      res.status,
      200,
      `expected 200 on upload ${i + 1}/${RATE_IMAGE_PUT_PER_WINDOW}`,
    );
  }

  const blocked = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/rate-test/images",
      method: "PUT",
      env: {
        MBTI_BUCKET: bucket,
        MBTI_DB: db,
        MBTI_KV: kv,
      },
      params: { id: "rate-test" },
      headers: {
        ...ipHeaders,
        "content-type": "image/png",
      },
      body: new Uint8Array([1, 2, 3, 4]),
    }),
  );
  assert.equal(blocked.status, 429);
  const body = await blocked.json();
  assert.equal(body.error, "Too many requests.");
});
