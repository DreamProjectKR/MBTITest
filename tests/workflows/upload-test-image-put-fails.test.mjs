import assert from "node:assert/strict";
import test from "node:test";

import { uploadTestImageWorkflow } from "../../worker/application/workflows/uploadTestImage.ts";
import {
  createContext,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("uploadTestImageWorkflow: put throws — cleanup delete is attempted", async () => {
  const deleted = [];
  const bucket = {
    async put() {
      throw new Error("r2 put boom");
    },
    async delete(key) {
      deleted.push(String(key));
    },
  };
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          return { success: true };
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
    /r2 put boom/,
  );
  assert.equal(deleted.length, 1);
});
