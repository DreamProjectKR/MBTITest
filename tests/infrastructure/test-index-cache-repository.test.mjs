import assert from "node:assert/strict";
import test from "node:test";

import {
  TEST_INDEX_CACHE_KEY,
  deleteTestIndexCache,
  readTestIndexCache,
  writeTestIndexCache,
} from "../../worker/infrastructure/repositories/kv/testIndexCacheRepository.ts";
import { createMemoryKv } from "../shared/kv-harness.mjs";

test("test index cache: write, read, delete", async () => {
  const kv = createMemoryKv();
  const body = { tests: [{ id: "t1" }] };
  await writeTestIndexCache(kv, { etag: '"e1"', body });
  const read = await readTestIndexCache(kv);
  assert.equal(read?.etag, '"e1"');
  assert.deepEqual(read?.body, body);
  await deleteTestIndexCache(kv);
  assert.equal(await readTestIndexCache(kv), null);
  assert.equal(TEST_INDEX_CACHE_KEY, "tests:index");
});

test("readTestIndexCache throws when KV value is not valid JSON", async () => {
  const kv = createMemoryKv();
  await kv.put(TEST_INDEX_CACHE_KEY, "not-json");
  await assert.rejects(() => readTestIndexCache(kv), SyntaxError);
});
