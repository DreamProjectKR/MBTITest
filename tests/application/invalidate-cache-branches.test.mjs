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
