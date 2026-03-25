import assert from "node:assert/strict";
import test from "node:test";

import { loadTestDetail } from "../../worker/api/tests/[id].ts";
import {
  createContext,
  createDetailDb,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

const BASE_URL = "https://example.com/api/tests/pub-test";
const OPT = { enforcePublished: true, useCache: true };

test("loadTestDetail: KV miss then origin 200 records kv Server-Timing MISS when kvMs > 0", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({ questions: [], results: {} }),
  });
  const env = {
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
      test_id: "pub-test",
      title: "T",
      description_json: "[]",
      author: "a",
      author_img_path: "a",
      thumbnail_path: "t",
      tags_json: "[]",
      source_path: "pub-test/test.json",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      is_published: 1,
    }),
    MBTI_KV: {
      async get() {
        await new Promise((r) => setTimeout(r, 5));
        return null;
      },
      async put() {},
      async delete() {},
    },
  };
  const res = await loadTestDetail(
    createContext({
      url: BASE_URL,
      env,
      params: { id: "pub-test" },
    }),
    OPT,
  );
  assert.equal(res.status, 200);
  const st = res.headers.get("Server-Timing") || "";
  assert.ok(st.includes("kv") && st.includes("MISS"));
});
