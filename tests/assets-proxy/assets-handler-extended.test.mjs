import assert from "node:assert/strict";
import test from "node:test";

import { handleAssetsGet } from "../../worker/assets/handler.ts";
import {
  createContext,
  createJsonBucket,
  installInMemoryCacheStub,
} from "../shared/worker-harness.mjs";

test("assets handler: missing MBTI_BUCKET -> 500", async () => {
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/x.png",
      env: {},
      params: { path: "x.png" },
    }),
  );
  assert.equal(res.status, 500);
});

test("assets handler: empty path -> 404", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/a.png": "x" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/",
      env: { MBTI_BUCKET: bucket },
      params: { path: "" },
    }),
  );
  assert.equal(res.status, 404);
});

test("assets handler: params.path as array joins segments", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/a/b.png": "hi" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/a/b.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: ["a", "b.png"] },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: Range suffix bytes=-N returns 206", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/suffix.bin": "abcdef" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/suffix.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/suffix.bin" },
      headers: { range: "bytes=-2" },
    }),
  );
  assert.equal(res.status, 206);
  assert.match(res.headers.get("Content-Range"), /bytes/);
});

test("assets handler: Range bytes=0- open ended uses offset only", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/open.bin": "xyz" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/open.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/open.bin" },
      headers: { range: "bytes=1-" },
    }),
  );
  assert.equal(res.status, 206);
});

test("assets handler: invalid Range header ignored for full 200", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/full.bin": "abc" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/full.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/full.bin" },
      headers: { range: "bytes=9-1" },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: guessContentType woff2 and default octet-stream", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({
    "assets/f/a.woff2": "w",
    "assets/f/b.unknown": "?",
  });
  const r1 = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/f/a.woff2",
      env: { MBTI_BUCKET: bucket },
      params: { path: "f/a.woff2" },
    }),
  );
  assert.equal(r1.headers.get("Content-Type"), "font/woff2");
  const r2 = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/f/b.unknown",
      env: { MBTI_BUCKET: bucket },
      params: { path: "f/b.unknown" },
    }),
  );
  assert.equal(r2.headers.get("Content-Type"), "application/octet-stream");
});

test("assets handler: pragma header bypasses cache read", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/cached.png": "x" });
  const url = "https://example.com/assets/cached.png";
  const first = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "cached.png" },
    }),
  );
  assert.equal(first.status, 200);
  await caches.default.put(new Request(url, { method: "GET" }), first.clone());
  const second = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "cached.png" },
      headers: { pragma: "no-cache" },
    }),
  );
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "MISS");
});

test("assets handler: object uses httpMetadata cacheControl when set", async () => {
  installInMemoryCacheStub();
  const bucket = {
    async get(key) {
      if (key !== "assets/meta/cc.png") return null;
      return {
        etag: "e1",
        size: 3,
        body: new Uint8Array([1, 2, 3]),
        httpMetadata: {
          cacheControl: "public, max-age=10",
          contentType: "image/png",
        },
      };
    },
  };
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/meta/cc.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "meta/cc.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control"), /max-age=10/);
});

test("assets handler: If-None-Match without stored etag skips 304", async () => {
  installInMemoryCacheStub();
  const bucket = {
    async get() {
      return {
        etag: undefined,
        size: 1,
        body: new Uint8Array([1]),
        httpMetadata: { contentType: "image/png" },
      };
    },
  };
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/noetag.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "noetag.png" },
      headers: { "if-none-match": '"x"' },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: versioned ?v= uses immutable cache-control branch", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({
    "assets/v/t.png": "bytes",
  });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/v/t.png?v=1",
      env: { MBTI_BUCKET: bucket },
      params: { path: "v/t.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control"), /immutable/);
});

test("assets handler: second GET hits Cache API (HIT)", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/hit.png": "payload" });
  const url = "https://example.com/assets/hit.png";
  const first = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "hit.png" },
    }),
  );
  assert.equal(first.headers.get("X-MBTI-Edge-Cache"), "MISS");
  await caches.default.put(new Request(url, { method: "GET" }), first.clone());
  const second = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "hit.png" },
    }),
  );
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "HIT");
});

test("assets handler: UI images path uses long-cache branch", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/images/ui.png": "x" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/images/ui.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "images/ui.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control"), /immutable/);
});

test("assets handler: tail that normalizes to empty segments -> 404", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({});
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/../",
      env: { MBTI_BUCKET: bucket },
      params: { path: ".." },
    }),
  );
  assert.equal(res.status, 404);
});
