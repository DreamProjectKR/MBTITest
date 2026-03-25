import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultCache,
  serverTimingHeader,
  setServerTiming,
  withCacheHeaders,
} from "../../worker/api/_utils/http.ts";

test("getDefaultCache returns null when caches API missing", () => {
  const prev = globalThis.caches;
  try {
    globalThis.caches = undefined;
    assert.equal(getDefaultCache(), null);
  } finally {
    globalThis.caches = prev;
  }
});

test("withCacheHeaders uses default stale-while-revalidate from maxAge when swr omitted", () => {
  const h = withCacheHeaders(
    { "Content-Type": "application/json" },
    { maxAge: 10 },
  );
  assert.match(h.get("Cache-Control"), /stale-while-revalidate=100/);
});

test("withCacheHeaders accepts explicit sMaxAge and finite staleWhileRevalidate", () => {
  const h = withCacheHeaders(
    { "Content-Type": "application/json" },
    {
      maxAge: 30,
      sMaxAge: 120,
      staleWhileRevalidate: 5,
    },
  );
  assert.match(h.get("Cache-Control"), /s-maxage=120/);
  assert.match(h.get("Cache-Control"), /stale-while-revalidate=5/);
});

test("serverTimingHeader skips metrics without name and escapes quotes in desc", () => {
  const s = serverTimingHeader([
    { name: "" },
    { name: "a", dur: 1.2, desc: 'say "hi"' },
  ]);
  assert.match(s, /a;dur=1\.2;desc="say \\"hi\\""/);
});

test("setServerTiming does not set header when value empty", () => {
  const h = new Headers();
  setServerTiming(h, [{ name: "" }]);
  assert.equal(h.has("Server-Timing"), false);
});
