import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPut } from "../../worker/api/admin/tests/[id]/results/[mbti]/image.ts";
import {
  createContext,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

const url = "https://example.com/api/admin/tests/t1/results/ENFP/image";

test("result image PUT: POST -> 405", async () => {
  installDefaultCacheStub();
  const res = await onRequestPut(
    createContext({
      url,
      method: "POST",
      env: { MBTI_BUCKET: {}, MBTI_DB: {} },
      params: { id: "t1", mbti: "ENFP" },
    }),
  );
  assert.equal(res.status, 405);
});

test("result image PUT: missing MBTI_BUCKET -> 500", async () => {
  installDefaultCacheStub();
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_DB: {} },
      params: { id: "t1", mbti: "ENFP" },
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1]),
    }),
  );
  assert.equal(res.status, 500);
});

test("result image PUT: missing MBTI_DB -> 500", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({});
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket },
      params: { id: "t1", mbti: "ENFP" },
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1]),
    }),
  );
  assert.equal(res.status, 500);
});

test("result image PUT: invalid MBTI code -> 400", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({});
  const res = await onRequestPut(
    createContext({
      url: "https://example.com/api/admin/tests/t1/results/XXXX/image",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
      params: { id: "t1", mbti: "XXXX" },
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1]),
    }),
  );
  assert.equal(res.status, 400);
});

test("result image PUT: empty raw body -> 400", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({
    "assets/t1/test.json": JSON.stringify({
      questions: [],
      results: { ENFP: { image: "x", summary: "y" } },
    }),
  });
  const db = {
    prepare() {
      return { bind() {}, async all() {} };
    },
    async batch() {
      return [];
    },
  };
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      headers: { "content-type": "image/png" },
      body: new ArrayBuffer(0),
    }),
  );
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(j.error, /File upload required/);
});

test("result image PUT: raw body without content-type defaults to image/png", async () => {
  installDefaultCacheStub();
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
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      headers: {},
      body: new Uint8Array([7, 8, 9]),
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.match(String(j.path), /\.png$/i);
});

test("result image PUT: multipart file succeeds and uses file type for extension", async () => {
  installDefaultCacheStub();
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
    new File([new Uint8Array([1, 2])], "out.webp", { type: "image/webp" }),
  );
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      body: fd,
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.match(String(j.path), /\.webp$/i);
});

test("result image PUT: multipart without file field -> 400", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({
    "assets/t1/test.json": JSON.stringify({
      questions: [],
      results: { ENFP: { image: "old", summary: "s" } },
    }),
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
  fd.set("note", "no-file");
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      body: fd,
    }),
  );
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(j.error, /File upload required/);
});

test("result image PUT: multipart File with empty type defaults to png extension", async () => {
  installDefaultCacheStub();
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
    new File([new Uint8Array([9, 9])], "blob", { type: "" }),
  );
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      body: fd,
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.match(String(j.path), /\.png$/i);
});

test("result image PUT: raw image/webp uses webp extension on success", async () => {
  installDefaultCacheStub();
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
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      headers: {
        "content-type": "image/webp",
        "content-length": "2",
      },
      body: new Uint8Array([1, 2]),
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.match(String(j.path), /\.webp$/i);
});

test("result image PUT: raw image/gif uses gif extension on success", async () => {
  installDefaultCacheStub();
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
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      headers: {
        "content-type": "image/gif",
        "content-length": "3",
      },
      body: new Uint8Array([0x47, 0x49, 0x46]),
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.match(String(j.path), /\.gif$/i);
});

test("result image PUT: raw image/jpeg uses jpg extension on success", async () => {
  installDefaultCacheStub();
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
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      headers: {
        "content-type": "image/jpeg",
        "content-length": "3",
      },
      body: new Uint8Array([0xff, 0xd8, 0xff]),
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.match(String(j.path), /\.jpg$/i);
});

test("result image PUT: raw image/jpg maps to jpg extension on success", async () => {
  installDefaultCacheStub();
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
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      headers: {
        "content-type": "image/jpg",
        "content-length": "2",
      },
      body: new Uint8Array([1, 2]),
    }),
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.match(String(j.path), /\.jpg$/i);
});

test("result image PUT: no test.json in R2 -> 404", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({});
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
      };
    },
    async batch() {
      return [];
    },
  };
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1, 2]),
    }),
  );
  assert.equal(res.status, 404);
  const j = await res.json();
  assert.match(j.error, /Test JSON not found/);
});

test("result image PUT: generic workflow error -> 500", async () => {
  installDefaultCacheStub();
  const bucket = {
    async get() {
      return {
        async text() {
          return JSON.stringify({ questions: [], results: { ENFP: {} } });
        },
      };
    },
    async put() {
      throw new Error("put failed");
    },
  };
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
      };
    },
    async batch() {
      return [];
    },
  };
  const res = await onRequestPut(
    createContext({
      url,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1", mbti: "ENFP" },
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1, 2]),
    }),
  );
  assert.equal(res.status, 500);
});
