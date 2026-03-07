import assert from "node:assert/strict";
import test from "node:test";

import { handleAssetsGet } from "../../worker/assets/handler.ts";
import {
  createContext,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

test("assets handler returns 304 for matching ETag", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({
    "assets/test-a/images/thumbnail.png": "image-bytes",
  });
  const response = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/test-a/images/thumbnail.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "test-a/images/thumbnail.png" },
      headers: { "if-none-match": "etag-assets/test-a/images/thumbnail.png" },
    }),
  );

  assert.equal(response.status, 304);
  assert.equal(
    response.headers.get("ETag"),
    "etag-assets/test-a/images/thumbnail.png",
  );
});

test("assets handler supports Range requests", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({
    "assets/test-a/images/thumbnail.png": "abcdef",
  });
  const response = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/test-a/images/thumbnail.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "test-a/images/thumbnail.png" },
      headers: { range: "bytes=0-2" },
    }),
  );

  assert.equal(response.status, 206);
  assert.match(response.headers.get("Content-Range"), /^bytes 0-2\//);
});

test("assets handler falls back to public R2 URL on localhost", async () => {
  installDefaultCacheStub();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) =>
    new Response("remote-image", {
      status:
        url.toString().includes("assets/test-a/images/thumbnail.png") ?
          200
        : 404,
      headers: { etag: "remote-etag", "content-type": "image/png" },
    });

  try {
    const env = {
      MBTI_BUCKET: {
        async get() {
          return null;
        },
      },
      R2_PUBLIC_BASE_URL: "https://pub.example.com",
    };
    const response = await handleAssetsGet(
      createContext({
        url: "http://localhost:8787/assets/test-a/images/thumbnail.png",
        env,
        params: { path: "test-a/images/thumbnail.png" },
      }),
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(body, "remote-image");
    assert.equal(response.headers.get("X-MBTI-Edge-Cache"), "MISS");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
