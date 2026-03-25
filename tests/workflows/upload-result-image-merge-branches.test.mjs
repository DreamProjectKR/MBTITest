import assert from "node:assert/strict";
import test from "node:test";

import { uploadResultImageWorkflow } from "../../worker/application/workflows/uploadResultImage.ts";
import {
  createContext,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

function makeBucket(initialTestJson) {
  return {
    async get(key) {
      if (key.endsWith("test.json")) {
        return {
          async text() {
            return initialTestJson;
          },
        };
      }
      return null;
    },
    async put() {},
    async delete() {},
  };
}

const dbOk = {
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

const dbFail = {
  prepare() {
    return {
      bind() {
        return this;
      },
    };
  },
  async batch() {
    throw new Error("meta fail");
  },
};

test("uploadResultImageWorkflow: merge when results is null", async () => {
  const body = JSON.stringify({ questions: [], results: null });
  await uploadResultImageWorkflow(
    createContext({
      url: "https://x",
      env: { MBTI_BUCKET: makeBucket(body), MBTI_DB: dbOk },
    }),
    {
      testId: "t1",
      mbti: "ENFP",
      extension: "png",
      contentType: "image/png",
      buffer: new Uint8Array([1]).buffer,
    },
  );
});

test("uploadResultImageWorkflow: merge when MBTI result entry is non-object", async () => {
  const body = JSON.stringify({
    questions: [],
    results: { ENFP: "not-an-object" },
  });
  await uploadResultImageWorkflow(
    createContext({
      url: "https://x",
      env: { MBTI_BUCKET: makeBucket(body), MBTI_DB: dbOk },
    }),
    {
      testId: "t1",
      mbti: "ENFP",
      extension: "png",
      contentType: "image/png",
      buffer: new Uint8Array([2]).buffer,
    },
  );
});

test("uploadResultImageWorkflow: rollback body write failure is swallowed", async () => {
  let bodyWrites = 0;
  const original = JSON.stringify({
    questions: [],
    results: { ENFP: { image: "old", summary: "s" } },
  });
  const bucket = {
    async get() {
      return {
        async text() {
          return original;
        },
      };
    },
    async put(key) {
      if (key.includes("test.json")) {
        bodyWrites += 1;
        if (bodyWrites === 2) {
          throw new Error("rollback failed");
        }
      }
    },
    async delete() {},
  };
  await assert.rejects(
    () =>
      uploadResultImageWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_BUCKET: bucket, MBTI_DB: dbFail },
        }),
        {
          testId: "t1",
          mbti: "ENFP",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1]).buffer,
        },
      ),
    /meta fail/,
  );
});
