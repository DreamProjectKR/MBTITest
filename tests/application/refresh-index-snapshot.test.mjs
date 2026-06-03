import assert from "node:assert/strict";
import test from "node:test";

import { refreshPublishedTestsIndexSnapshot } from "../../worker/application/cache/refreshPublishedTestsIndexSnapshot.ts";
import { createContext, createIndexDb } from "../shared/worker-harness.mjs";

const ROW = {
  test_id: "snap-1",
  title: "Snap",
  thumbnail_path: "assets/snap-1/images/thumbnail.png",
  tags_json: "[]",
  source_path: "snap-1/test.json",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  is_published: 1,
};

test("refreshPublishedTestsIndexSnapshot writes assets/index.json to R2", async () => {
  const store = new Map();
  const bucket = {
    async put(key, value, options) {
      store.set(
        key,
        new TextDecoder().decode(
          value instanceof Uint8Array ? value : new Uint8Array(value),
        ),
      );
      return { key, httpMetadata: options?.httpMetadata };
    },
  };
  const waits = [];
  const context = createContext({
    url: "https://example.com/api/admin/tests/snap-1",
    env: {
      MBTI_DB: createIndexDb([ROW]),
      MBTI_BUCKET: bucket,
    },
    waitUntil: (p) => {
      waits.push(p);
    },
  });

  refreshPublishedTestsIndexSnapshot(context);
  await Promise.all(waits);

  const raw = store.get("assets/index.json");
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.tests.length, 1);
  assert.equal(parsed.tests[0].id, "snap-1");
});
