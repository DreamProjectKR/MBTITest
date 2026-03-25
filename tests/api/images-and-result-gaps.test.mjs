import assert from "node:assert/strict";
import test from "node:test";

import { MAX_IMAGE_UPLOAD_BYTES } from "../../worker/api/_utils/bodyLimits.ts";
import { onRequestGet as adminImagesGet } from "../../worker/api/admin/tests/[id]/images.ts";
import { onRequestPut as adminImagesPut } from "../../worker/api/admin/tests/[id]/images.ts";
import { onRequestPut as resultImagePut } from "../../worker/api/admin/tests/[id]/results/[mbti]/image.ts";
import {
  createContext,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("admin images PUT: empty test id uses badRequest helper", async () => {
  const { bucket } = createJsonBucket({});
  const res = await adminImagesPut(
    createContext({
      url: "https://example.com/api/admin/tests/t/images",
      method: "PUT",
      env: {
        MBTI_BUCKET: bucket,
        MBTI_DB: {
          prepare() {
            return { bind() {}, async all() {} };
          },
        },
      },
      params: { id: "" },
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1]),
    }),
  );
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(j.error, /Missing test id/);
});

test("admin images PUT: multipart formData throws -> Unable to parse", async () => {
  const { bucket } = createJsonBucket({});
  const db = {
    prepare() {
      return { bind() {}, async all() {} };
    },
  };
  const res = await adminImagesPut({
    request: {
      method: "PUT",
      headers: new Headers({
        "content-type": "multipart/form-data; boundary=----x",
      }),
      async formData() {
        throw new Error("multipart parse boom");
      },
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    },
    env: { MBTI_BUCKET: bucket, MBTI_DB: db },
    params: { id: "t1" },
    waitUntil() {},
  });
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(j.error, /Unable to parse uploaded file/);
});

test("admin images PUT: multipart file over max bytes -> 413", async () => {
  const { bucket } = createJsonBucket({});
  const db = {
    prepare() {
      return { bind() {}, async all() {} };
    },
  };
  const fd = new FormData();
  fd.set(
    "file",
    new File([new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)], "huge.png", {
      type: "image/png",
    }),
  );
  const res = await adminImagesPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: {},
      body: fd,
    }),
  );
  assert.equal(res.status, 413);
});

test("admin images PUT: workflow rejects non-Error from put", async () => {
  const bucket = {
    async put() {
      throw "not-an-error";
    },
  };
  const db = {
    prepare() {
      return { bind() {}, async all() {} };
    },
  };
  const res = await adminImagesPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: { "content-type": "image/png" },
      body: new Uint8Array([1, 2, 3]),
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "Failed to upload image.");
});

test("admin images GET: row id 0 maps to item id 0", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          return {
            results: [
              {
                id: 0,
                test_id: "t1",
                image_key: "assets/t1/images/a.png",
                image_type: "misc",
                image_name: "a",
                content_type: "image/png",
                size_bytes: 3,
                uploaded_at: "2026-01-01",
              },
            ],
          };
        },
      };
    },
  };
  const res = await adminImagesGet(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      env: { MBTI_DB: db },
      params: { id: "t1" },
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.items[0].id, 0);
});

test("result image PUT: multipart upload succeeds", async () => {
  const testJson = JSON.stringify({
    questions: [],
    results: { ENFP: { image: "old", summary: "s" } },
  });
  const { bucket } = createJsonBucket({
    "assets/t1/test.json": testJson,
  });
  const db = {
    prepare() {
      return { bind() {}, async all() {} };
    },
    async batch() {
      return [];
    },
  };
  const fd = new FormData();
  fd.set(
    "file",
    new File([new Uint8Array([0x89, 0x50])], "x.png", { type: "image/png" }),
  );
  const res = await resultImagePut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/results/ENFP/image",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      body: fd,
    }),
  );
  assert.equal(res.status, 200);
});

test("result image PUT: formData throws -> 400", async () => {
  const { bucket } = createJsonBucket({
    "assets/t1/test.json": "{}",
  });
  const db = {
    prepare() {
      return { bind() {}, async all() {} };
    },
    async batch() {
      return [];
    },
  };
  const res = await resultImagePut({
    request: {
      method: "PUT",
      headers: new Headers({
        "content-type": "multipart/form-data; boundary=----x",
      }),
      async formData() {
        throw new Error("boom");
      },
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    },
    env: { MBTI_BUCKET: bucket, MBTI_DB: db },
    params: { id: "t1", mbti: "ENFP" },
    waitUntil() {},
  });
  assert.equal(res.status, 400);
});

test("result image PUT: workflow throws non-Error -> 500", async () => {
  const bucket = {
    async get() {
      return {
        async text() {
          return JSON.stringify({
            questions: [],
            results: { ENFP: { image: "x", summary: "y" } },
          });
        },
      };
    },
    async put() {
      throw "bad";
    },
  };
  const db = {
    prepare() {
      return { bind() {}, async all() {} };
    },
    async batch() {
      return [];
    },
  };
  const res = await resultImagePut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/results/ENFP/image",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      headers: { "content-type": "image/png" },
      body: new Uint8Array([1]),
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "Failed to upload image.");
});
