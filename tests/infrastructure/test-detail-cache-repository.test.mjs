import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteTestDetailCache,
  getTestDetailCacheKey,
  readTestDetailCache,
  writeTestDetailCache,
} from "../../worker/infrastructure/repositories/kv/testDetailCacheRepository.ts";

test("getTestDetailCacheKey uses test: prefix", () => {
  assert.equal(getTestDetailCacheKey("abc"), "test:abc");
});

test("readTestDetailCache throws when KV value is not valid JSON", async () => {
  const kv = {
    async get() {
      return "{broken";
    },
  };
  await assert.rejects(() => readTestDetailCache(kv, "bad-json"), SyntaxError);
});

test("writeTestDetailCache puts JSON with expirationTtl 300; read round-trips; delete clears", async () => {
  const store = new Map();
  const puts = [];
  const kv = {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, options) {
      puts.push({ key, options, value });
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };

  await writeTestDetailCache(kv, "tid", {
    etag: '"e1"',
    body: { id: "tid", title: "T" },
  });

  assert.ok(puts.some((p) => p.options?.expirationTtl === 300));
  const read = await readTestDetailCache(kv, "tid");
  assert.equal(read?.etag, '"e1"');
  assert.equal(read?.body?.title, "T");

  await deleteTestDetailCache(kv, "tid");
  assert.equal(await readTestDetailCache(kv, "tid"), null);
});
