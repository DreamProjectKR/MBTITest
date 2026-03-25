import assert from "node:assert/strict";
import test from "node:test";

import { uploadResultImageWorkflow } from "../../worker/application/workflows/uploadResultImage.ts";
import {
  createContext,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("uploadResultImageWorkflow: non-object test.json body throws before upload", async () => {
  const bucket = {
    async get() {
      return {
        async text() {
          return "42";
        },
      };
    },
    async put() {},
    async delete() {},
  };
  await assert.rejects(
    () =>
      uploadResultImageWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
          params: { id: "tid", mbti: "ENFP" },
        }),
        {
          testId: "tid",
          mbti: "ENFP",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1]).buffer,
        },
      ),
    /Test JSON not found/,
  );
});

const BASE_TEST = JSON.stringify({
  questions: [],
  results: {
    ENFP: { image: "old", summary: "s" },
  },
});

test("uploadResultImageWorkflow: D1 failure restores previous test.json", async () => {
  let writeCalls = 0;
  const bucket = {
    async get(key) {
      if (key.includes("test.json")) {
        return {
          async text() {
            return BASE_TEST;
          },
        };
      }
      return null;
    },
    async put(key, value) {
      if (key.includes("test.json")) {
        writeCalls += 1;
        if (writeCalls === 2) {
          throw new Error("rollback write failed");
        }
      }
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
      throw new Error("batch metadata failed");
    },
  };
  await assert.rejects(
    () =>
      uploadResultImageWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_BUCKET: bucket, MBTI_DB: db },
          params: { id: "tid", mbti: "ENFP" },
        }),
        {
          testId: "tid",
          mbti: "ENFP",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1, 2]).buffer,
        },
      ),
    /batch metadata failed/,
  );
});

test("uploadResultImageWorkflow: body write after image put triggers delete cleanup", async () => {
  const deleted = [];
  const bucket = {
    async get(key) {
      if (key.includes("test.json")) {
        return {
          async text() {
            return BASE_TEST;
          },
        };
      }
      return null;
    },
    async put(key) {
      if (key.includes("test.json")) {
        throw new Error("body write failed");
      }
    },
    async delete(key) {
      deleted.push(key);
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
  await assert.rejects(
    () =>
      uploadResultImageWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_BUCKET: bucket, MBTI_DB: db },
          params: { id: "tid", mbti: "ENFP" },
        }),
        {
          testId: "tid",
          mbti: "ENFP",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1]).buffer,
        },
      ),
    /body write failed/,
  );
  assert.ok(
    deleted.some((k) => String(k).includes("ENFP") && k.endsWith(".png")),
  );
});

test("uploadResultImageWorkflow: throws when MBTI_BUCKET is missing", async () => {
  await assert.rejects(
    () =>
      uploadResultImageWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_DB: {} },
          params: { id: "tid", mbti: "ENFP" },
        }),
        {
          testId: "tid",
          mbti: "ENFP",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1]).buffer,
        },
      ),
    /MBTI_BUCKET/,
  );
});

test("uploadResultImageWorkflow: throws when MBTI_DB is missing", async () => {
  await assert.rejects(
    () =>
      uploadResultImageWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_BUCKET: {} },
          params: { id: "tid", mbti: "ENFP" },
        }),
        {
          testId: "tid",
          mbti: "ENFP",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1]).buffer,
        },
      ),
    /MBTI_DB/,
  );
});

test("uploadResultImageWorkflow: delete asset best-effort when delete throws", async () => {
  const bucket = {
    async get() {
      return {
        async text() {
          return BASE_TEST;
        },
      };
    },
    async put() {},
    async delete() {
      throw new Error("delete failed");
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
      throw new Error("batch failed");
    },
  };
  await assert.rejects(
    () =>
      uploadResultImageWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_BUCKET: bucket, MBTI_DB: db },
        }),
        {
          testId: "tid",
          mbti: "ENFP",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1]).buffer,
        },
      ),
    /batch failed/,
  );
});
