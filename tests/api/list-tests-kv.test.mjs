import assert from "node:assert/strict";
import test from "node:test";

import { listTests } from "../../worker/api/tests/index.ts";
import {
  computeTestsIndexEtag,
  mapRowToTestMeta,
} from "../../worker/domain/tests/listPayload.ts";
import { writeTestIndexCache } from "../../worker/infrastructure/repositories/kv/testIndexCacheRepository.ts";
import { createMemoryKv } from "../shared/kv-harness.mjs";
import { createContext, createIndexDb } from "../shared/worker-harness.mjs";

const ROW = {
  test_id: "t1",
  title: "One",
  thumbnail_path: "assets/t1/images/thumbnail.png",
  tags_json: "[]",
  source_path: "t1/test.json",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  is_published: 1,
};

test("listTests: KV HIT returns index without D1", async () => {
  const kv = createMemoryKv();
  const tests = [mapRowToTestMeta(ROW)];
  const etag = computeTestsIndexEtag(tests);
  await writeTestIndexCache(kv, { etag, body: { tests } });

  const res = await listTests(
    createContext({
      url: "https://example.com/api/tests?kv=1",
      env: { MBTI_KV: kv, MBTI_DB: createIndexDb([]) },
    }),
    { publishedOnly: true, useCache: true },
  );

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("X-MBTI-Edge-Cache"), "BYPASS");
  const j = await res.json();
  assert.equal(j.tests.length, 1);
  assert.match(res.headers.get("Server-Timing") || "", /kv/);
  assert.equal(j.tests[0].id, "t1");
});
