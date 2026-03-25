import assert from "node:assert/strict";
import test from "node:test";

import { uploadTestImageWorkflow } from "../../worker/application/workflows/uploadTestImage.ts";
import {
  createContext,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

const bucket = { async put() {} };
const db = {
  prepare() {
    return {
      bind() {
        return this;
      },
      async all() {},
    };
  },
};

async function runWithBase(baseName) {
  return uploadTestImageWorkflow(
    createContext({
      url: "https://x",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
    }),
    {
      testId: "t1",
      baseName,
      extension: "png",
      contentType: "image/png",
      buffer: new Uint8Array([1]).buffer,
    },
  );
}

test("uploadTestImageWorkflow: inferImageType covers thumbnail, author, question, result, misc", async () => {
  const r1 = await runWithBase("thumbnail");
  assert.match(r1.path, /thumbnail\.png$/);
  const r2 = await runWithBase("author");
  assert.match(r2.path, /author\.png$/);
  const r3 = await runWithBase("Q5");
  assert.match(r3.path, /Q5\.png$/);
  const r4 = await runWithBase("ENFP");
  assert.match(r4.path, /ENFP\.png$/);
  const r5 = await runWithBase("miscName");
  assert.match(r5.path, /miscName\.png$/);
});

test("uploadTestImageWorkflow: question regex q1/q12 and misc for q100", async () => {
  const q1 = await runWithBase("q1");
  assert.match(q1.path, /q1\.png$/i);
  const q12 = await runWithBase("q12");
  assert.match(q12.path, /q12\.png$/i);
  const q100 = await runWithBase("q100");
  assert.match(q100.path, /q100\.png$/i);
});

test("uploadTestImageWorkflow: inferImageType misc for q-only and short MBTI-like names", async () => {
  const qBare = await runWithBase("q");
  assert.match(qBare.path, /\/q\.png$/);
  const shortMbti = await runWithBase("ENF");
  assert.match(shortMbti.path, /ENF\.png$/);
});

test("uploadTestImageWorkflow: inferImageType handles undefined baseName (falsy → empty string)", async () => {
  const r = await runWithBase(undefined);
  assert.equal(r.ok, true);
  assert.ok(r.url.startsWith("/assets/"));
  assert.match(r.path, /\.png$/);
});

test("uploadTestImageWorkflow: invalidates Cache API only when MBTI_KV absent", async () => {
  const prevCaches = globalThis.caches;
  const waitUntilCalls = [];
  const deletedUrls = [];
  try {
    globalThis.caches = {
      default: {
        async delete(req) {
          deletedUrls.push(new URL(req.url).pathname);
          return true;
        },
      },
    };
    await uploadTestImageWorkflow(
      createContext({
        url: "https://example.com/",
        env: { MBTI_BUCKET: bucket, MBTI_DB: db },
        waitUntil: (p) => {
          waitUntilCalls.push(p);
        },
      }),
      {
        testId: "t1",
        baseName: "nocachekv",
        extension: "png",
        contentType: "image/png",
        buffer: new Uint8Array([1]).buffer,
      },
    );
    await Promise.all(waitUntilCalls);
    assert.equal(waitUntilCalls.length, 2);
    assert.ok(deletedUrls.includes("/api/tests"));
    assert.ok(deletedUrls.includes("/api/tests/t1"));
  } finally {
    globalThis.caches = prevCaches;
  }
});

test("uploadTestImageWorkflow: KV invalidation when Cache API absent", async () => {
  const prevCaches = globalThis.caches;
  const waitUntilCalls = [];
  try {
    globalThis.caches = undefined;
    const kv = { delete: async () => {} };
    await uploadTestImageWorkflow(
      createContext({
        url: "https://example.com/",
        env: { MBTI_BUCKET: bucket, MBTI_DB: db, MBTI_KV: kv },
        waitUntil: (p) => {
          waitUntilCalls.push(p);
        },
      }),
      {
        testId: "t1",
        baseName: "kvonly",
        extension: "png",
        contentType: "image/png",
        buffer: new Uint8Array([1]).buffer,
      },
    );
    assert.equal(
      waitUntilCalls.length,
      1,
      "only KV delete when Cache API is unavailable",
    );
  } finally {
    globalThis.caches = prevCaches;
  }
});

test("uploadTestImageWorkflow: KV delete plus Cache API when both present", async () => {
  const prevCaches = globalThis.caches;
  const waitUntilCalls = [];
  try {
    globalThis.caches = {
      default: {
        async delete() {
          return true;
        },
      },
    };
    const kv = { delete: async () => {} };
    await uploadTestImageWorkflow(
      createContext({
        url: "https://example.com/",
        env: { MBTI_BUCKET: bucket, MBTI_DB: db, MBTI_KV: kv },
        waitUntil: (p) => {
          waitUntilCalls.push(p);
        },
      }),
      {
        testId: "t1",
        baseName: "kv-and-cache",
        extension: "png",
        contentType: "image/png",
        buffer: new Uint8Array([1]).buffer,
      },
    );
    await Promise.all(waitUntilCalls);
    assert.equal(waitUntilCalls.length, 3);
  } finally {
    globalThis.caches = prevCaches;
  }
});
