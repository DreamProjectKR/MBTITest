import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPut } from "../../worker/api/admin/tests/[id]/images.ts";
import {
  createContext,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

const baseUrl = "https://example.com/api/admin/tests/t1/images";

test("images PUT: missing MBTI_BUCKET -> 500", async () => {
  installDefaultCacheStub();
  const res = await onRequestPut(
    createContext({
      url: baseUrl,
      method: "PUT",
      env: { MBTI_DB: {} },
      params: { id: "t1" },
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1, 2, 3]),
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.match(j.error, /MBTI_BUCKET/);
});

test("images PUT: missing MBTI_DB -> 500", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket({});
  const res = await onRequestPut(
    createContext({
      url: baseUrl,
      method: "PUT",
      env: { MBTI_BUCKET: bucket },
      params: { id: "t1" },
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1]),
    }),
  );
  assert.equal(res.status, 500);
});

test("images PUT: workflow throws -> 500 with message", async () => {
  installDefaultCacheStub();
  const bucket = {
    async get() {
      return {
        async text() {
          return JSON.stringify({ questions: [], results: {} });
        },
      };
    },
    async put() {
      throw new Error("r2 boom");
    },
    async delete() {},
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
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const res = await onRequestPut(
    createContext({
      url: baseUrl,
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "t1" },
      headers: { "content-type": "application/octet-stream" },
      body: png.buffer,
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.match(j.error, /r2 boom/);
});
