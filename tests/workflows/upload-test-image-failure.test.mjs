import assert from "node:assert/strict";
import test from "node:test";

import { uploadTestImageWorkflow } from "../../worker/application/workflows/uploadTestImage.ts";
import {
  createContext,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("uploadTestImageWorkflow: throws when MBTI_BUCKET is missing", async () => {
  await assert.rejects(
    () =>
      uploadTestImageWorkflow(
        createContext({
          url: "https://x",
          env: {
            MBTI_DB: {
              prepare() {
                return { bind() {}, async all() {} };
              },
            },
          },
        }),
        {
          testId: "tid",
          baseName: "thumbnail",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1]).buffer,
        },
      ),
    /MBTI_BUCKET/,
  );
});

test("uploadTestImageWorkflow: throws when MBTI_DB is missing", async () => {
  await assert.rejects(
    () =>
      uploadTestImageWorkflow(
        createContext({
          url: "https://x",
          env: {
            MBTI_BUCKET: { async put() {} },
          },
        }),
        {
          testId: "tid",
          baseName: "thumbnail",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1]).buffer,
        },
      ),
    /MBTI_DB/,
  );
});

test("uploadTestImageWorkflow: metadata failure triggers delete cleanup", async () => {
  const deleted = [];
  const bucket = {
    async put() {},
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
        async all() {
          throw new Error("d1 fail");
        },
      };
    },
  };
  await assert.rejects(
    () =>
      uploadTestImageWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_BUCKET: bucket, MBTI_DB: db },
        }),
        {
          testId: "tid",
          baseName: "thumbnail",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1, 2, 3]).buffer,
        },
      ),
    /d1 fail/,
  );
  assert.equal(deleted.length, 1);
});
