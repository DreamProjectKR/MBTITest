import assert from "node:assert/strict";
import test from "node:test";

import {
  onRequestGet,
  onRequestPut,
} from "../../worker/api/admin/tests/[id]/images.ts";
import {
  createContext,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

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
