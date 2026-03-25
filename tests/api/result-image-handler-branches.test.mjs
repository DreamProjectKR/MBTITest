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
