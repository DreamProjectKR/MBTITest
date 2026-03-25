import assert from "node:assert/strict";
import test from "node:test";

import { uploadTestImageWorkflow } from "../../worker/application/workflows/uploadTestImage.ts";
import {
  createContext,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("uploadTestImageWorkflow: inner delete failure is swallowed", async () => {
  const bucket = {
    async put() {},
    async delete() {
      throw new Error("cannot delete");
    },
  };
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          throw new Error("metadata failed");
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
          baseName: "thumb",
          extension: "png",
          contentType: "image/png",
          buffer: new Uint8Array([1]).buffer,
        },
      ),
    /metadata failed/,
  );
});
