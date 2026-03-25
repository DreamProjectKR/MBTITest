import assert from "node:assert/strict";
import test from "node:test";

import { invalidatePublicTestCaches } from "../../worker/application/cache/invalidateTestCaches.ts";

test("invalidatePublicTestCaches no-ops when MBTI_KV missing and caches missing", () => {
  const prev = globalThis.caches;
  try {
    globalThis.caches = undefined;
    const calls = [];
    invalidatePublicTestCaches(
      {
        env: {},
        request: new Request("https://x.com/api/tests/t"),
        waitUntil: (p) => calls.push(p),
      },
      "t",
    );
    assert.equal(calls.length, 0);
  } finally {
    globalThis.caches = prev;
  }
});

test("invalidatePublicTestCaches schedules KV delete and two cache deletes", async () => {
  const prevCaches = globalThis.caches;
  const waitUntilCalls = [];
  const deletedPaths = [];
  try {
    globalThis.caches = {
      default: {
        async delete(req) {
          deletedPaths.push(new URL(req.url).pathname);
          return true;
        },
      },
    };
    const kv = { delete: async () => {} };
    invalidatePublicTestCaches(
      {
        env: { MBTI_KV: kv },
        request: new Request("https://example.com/z"),
        waitUntil: (p) => waitUntilCalls.push(p),
      },
      "tid",
    );
    await Promise.all(waitUntilCalls);
    assert.equal(waitUntilCalls.length, 3);
    assert.ok(deletedPaths.includes("/api/tests"));
    assert.ok(deletedPaths.includes("/api/tests/tid"));
  } finally {
    globalThis.caches = prevCaches;
  }
});
