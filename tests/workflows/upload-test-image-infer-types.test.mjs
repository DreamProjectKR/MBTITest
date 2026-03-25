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
