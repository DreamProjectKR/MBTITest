import assert from "node:assert/strict";
import test from "node:test";

import { uploadResultImageWorkflow } from "../../worker/application/workflows/uploadResultImage.ts";
import {
  createContext,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

const BASE_TEST = JSON.stringify({
  questions: [],
  results: {
    ENFP: { image: "old", summary: "s" },
  },
});

test("uploadResultImageWorkflow: success returns path and invalidates caches", async () => {
  const waitUntilCalls = [];
  const puts = [];
  const bucket = {
    async get(key) {
      if (key.endsWith("test.json")) {
        return {
          async text() {
            return BASE_TEST;
          },
        };
      }
      return null;
    },
    async put(key, value) {
      puts.push({ key, value });
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
  const kv = { delete: async () => {} };
  const result = await uploadResultImageWorkflow(
    createContext({
      url: "https://example.com",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db, MBTI_KV: kv },
      waitUntil: (p) => waitUntilCalls.push(p),
    }),
    {
      testId: "tid",
      mbti: "ENFP",
      extension: "png",
      contentType: "image/png",
      buffer: new Uint8Array([1, 2, 3]).buffer,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.mbti, "ENFP");
  assert.match(result.path, /ENFP\.png$/);
  assert.match(result.url, /assets\/tid\/images\/ENFP\.png$/);
  assert.ok(puts.some((p) => p.key.includes("ENFP.png")));
  assert.ok(puts.some((p) => p.key.endsWith("test.json")));
  assert.ok(
    waitUntilCalls.length >= 3,
    "invalidatePublicTestCaches schedules KV delete + two cache.delete",
  );
});
