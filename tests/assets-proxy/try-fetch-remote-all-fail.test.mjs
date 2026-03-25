import assert from "node:assert/strict";
import test from "node:test";

import { handleAssetsGet } from "../../worker/assets/handler.ts";
import {
  createContext,
  createJsonBucket,
  installInMemoryCacheStub,
} from "../shared/worker-harness.mjs";

test("assets handler: tryFetchRemote returns null when all remote fetches fail", async () => {
  installInMemoryCacheStub();
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 404 });
  try {
    const { bucket } = createJsonBucket({});
    const res = await handleAssetsGet(
      createContext({
        url: "http://127.0.0.1:8787/assets/missing.png",
        env: {
          MBTI_BUCKET: bucket,
          R2_PUBLIC_BASE_URL: "https://cdn.example.com",
        },
        params: { path: "missing.png" },
      }),
    );
    assert.equal(res.status, 404);
  } finally {
    globalThis.fetch = orig;
  }
});
