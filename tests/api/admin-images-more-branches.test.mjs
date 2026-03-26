import assert from "node:assert/strict";
import test from "node:test";

import { MAX_IMAGE_UPLOAD_BYTES } from "../../worker/api/_utils/bodyLimits.ts";
import {
  onRequestGet,
  onRequestPut,
} from "../../worker/api/admin/tests/[id]/images.ts";
import {
  createContext,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

test("admin images GET: maps rows with null optional fields", async () => {
  installDefaultCacheStub();
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
                id: null,
                test_id: "t1",
                image_key: "assets/t1/images/x.png",
                image_type: null,
                image_name: null,
                content_type: null,
                size_bytes: null,
                uploaded_at: null,
              },
            ],
          };
        },
      };
    },
  };
  const res = await onRequestGet(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      env: { MBTI_DB: db },
      params: { id: "t1" },
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.items[0].imageType, "");
  assert.equal(j.items[0].imageName, "");
  assert.equal(j.items[0].contentType, "");
  assert.equal(j.items[0].size, 0);
  assert.equal(j.items[0].lastModified, null);
});

test("admin images GET: image_key without assets prefix maps path and url", async () => {
  installDefaultCacheStub();
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
                id: 1,
                test_id: "t1",
                image_key: "t1/images/legacy.png",
                image_type: "misc",
                image_name: "legacy",
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
  const res = await onRequestGet(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      env: { MBTI_DB: db },
      params: { id: "t1" },
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.items[0].path, "t1/images/legacy.png");
  assert.equal(j.items[0].url, "/assets/t1/images/legacy.png");
});

test("admin images GET: POST method -> 405", async () => {
  installDefaultCacheStub();
  const res = await onRequestGet(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "POST",
      env: { MBTI_DB: {} },
      params: { id: "t1" },
    }),
  );
  assert.equal(res.status, 405);
});

test("admin images GET: list throws non-Error -> 500 with generic message", async () => {
  installDefaultCacheStub();
  const db = {
    prepare() {
      throw "db-down";
    },
  };
  const res = await onRequestGet(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      env: { MBTI_DB: db },
      params: { id: "t1" },
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "Failed to list images.");
});

test("admin images PUT: raw image/gif and image/webp map extensions", async () => {
  installDefaultCacheStub();
  const keys = [];
  const bucket = {
    async put(key) {
      keys.push(key);
    },
  };
  const db = {
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
  const gifBuf = new Uint8Array([0x47, 0x49, 0x46]).buffer;
  const webpBuf = new Uint8Array([1]).buffer;
  const resGif = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: {
        "content-type": "image/gif",
        "content-length": String(gifBuf.byteLength),
      },
      body: gifBuf,
    }),
  );
  assert.equal(resGif.status, 200);
  assert.match(String(keys[0]), /\.gif$/);
  const resWebp = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: {
        "content-type": "image/webp",
        "content-length": String(webpBuf.byteLength),
      },
      body: webpBuf,
    }),
  );
  assert.equal(resWebp.status, 200);
  assert.match(String(keys[1]), /\.webp$/);
});

test("admin images PUT: raw image/jpeg maps to jpg extension", async () => {
  installDefaultCacheStub();
  let lastKey;
  const bucket = {
    async put(key) {
      lastKey = key;
    },
  };
  const db = {
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
  const buf = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: {
        "content-type": "image/jpeg",
        "content-length": String(buf.byteLength),
      },
      body: buf,
    }),
  );
  assert.equal(res.status, 200);
  assert.match(String(lastKey), /\.jpg$/);
});

test("admin images PUT: raw image/jpg maps to jpg extension", async () => {
  installDefaultCacheStub();
  let lastKey;
  const bucket = {
    async put(key) {
      lastKey = key;
    },
  };
  const db = {
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
  const buf = new Uint8Array([1]).buffer;
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: {
        "content-type": "image/jpg",
        "content-length": String(buf.byteLength),
      },
      body: buf,
    }),
  );
  assert.equal(res.status, 200);
  assert.match(String(lastKey), /\.jpg$/);
});

test("admin images PUT: raw body without content-type defaults to png extension", async () => {
  installDefaultCacheStub();
  let lastKey;
  const bucket = {
    async put(key) {
      lastKey = key;
    },
  };
  const db = {
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
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: {
        "content-length": "1",
      },
      body: new Uint8Array([1]),
    }),
  );
  assert.equal(res.status, 200);
  assert.match(String(lastKey), /\.png$/);
});

test("admin images PUT: workflow throws non-Error -> 500 generic message", async () => {
  installDefaultCacheStub();
  const bucket = {
    async put() {
      throw "not-an-error-object";
    },
  };
  const db = {
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
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: {
        "content-type": "application/octet-stream",
        "content-length": "1",
      },
      body: new Uint8Array([1]),
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "Failed to upload image.");
});

test("admin images PUT: POST method -> 405", async () => {
  installDefaultCacheStub();
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "POST",
      env: { MBTI_BUCKET: {}, MBTI_DB: {} },
      params: { id: "t1" },
    }),
  );
  assert.equal(res.status, 405);
});

test("admin images GET: list throws Error -> 500 uses error message", async () => {
  installDefaultCacheStub();
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          throw new Error("list-images-query-failed");
        },
      };
    },
  };
  const res = await onRequestGet(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      env: { MBTI_DB: db },
      params: { id: "t1" },
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "list-images-query-failed");
});

test("admin images PUT: multipart file field is not a File -> 400", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({});
  const db = {
    prepare() {
      return { bind() {}, async all() {} };
    },
  };
  const fd = new FormData();
  fd.set("file", "not-a-file");
  fd.set("name", "thumb");
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      body: fd,
    }),
  );
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(j.error, /File upload required/);
});

test("admin images PUT: falls back to img-timestamp when randomUUID unavailable", async () => {
  installDefaultCacheStub();
  const prevCrypto = globalThis.crypto;
  let lastKey = "";
  const bucket = {
    async put(key) {
      lastKey = key;
    },
  };
  const db = {
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
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: {},
      configurable: true,
      writable: true,
      enumerable: true,
    });
    const res = await onRequestPut(
      createContext({
        url: "https://example.com/api/admin/tests/t1/images",
        method: "PUT",
        env: { MBTI_BUCKET: bucket, MBTI_DB: db },
        params: { id: "t1" },
        headers: {
          "content-type": "application/octet-stream",
          "content-length": "1",
        },
        body: new Uint8Array([1]),
      }),
    );
    assert.equal(res.status, 200);
    assert.match(String(lastKey), /^assets\/t1\/images\/img-\d+\.png$/);
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      value: prevCrypto,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  }
});

test("admin images GET: missing MBTI_DB -> 500", async () => {
  installDefaultCacheStub();
  const res = await onRequestGet(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      env: {},
      params: { id: "t1" },
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.match(j.error, /MBTI_DB/);
});

test("admin images PUT: raw body empty -> File upload required", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({});
  const db = {
    prepare() {
      return { bind() {}, async all() {} };
    },
  };
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: { "content-type": "application/octet-stream" },
      body: new ArrayBuffer(0),
    }),
  );
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(j.error, /File upload required/);
});

test("admin images PUT: raw body over max without Content-Length -> 413", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({});
  const db = {
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
  const buf = new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1);
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: { "content-type": "application/octet-stream" },
      body: buf,
    }),
  );
  assert.equal(res.status, 413);
  const j = await res.json();
  assert.match(j.error, /Payload too large/i);
});

test("admin images PUT: multipart name Author! canonicalizes to author basename", async () => {
  installDefaultCacheStub();
  let lastKey = "";
  const bucket = {
    async put(key) {
      lastKey = key;
    },
  };
  const db = {
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
  const fd = new FormData();
  fd.set("name", "Author!");
  fd.set(
    "file",
    new File([new Uint8Array([1])], "x.png", { type: "image/png" }),
  );
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      body: fd,
    }),
  );
  assert.equal(res.status, 200);
  assert.match(String(lastKey), /\/author\.png$/i);
});

test("admin images PUT: multipart File with empty type uses header fallback", async () => {
  installDefaultCacheStub();
  let lastKey = "";
  const bucket = {
    async put(key) {
      lastKey = key;
    },
  };
  const db = {
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
  const fd = new FormData();
  fd.set("name", "emptytype");
  fd.set(
    "file",
    new File([new Uint8Array([1])], "x.bin", { type: "" }),
  );
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/images",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      body: fd,
    }),
  );
  assert.equal(res.status, 200);
  assert.match(String(lastKey), /emptytype\.png$/i);
});
