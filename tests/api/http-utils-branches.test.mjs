import assert from "node:assert/strict";
import test from "node:test";

import {
  cacheKeyForGet,
  getDefaultCache,
  jsonResponse,
  noStoreJsonResponse,
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

test("getDefaultCache returns null when caches.default is missing", () => {
  const prev = globalThis.caches;
  try {
    globalThis.caches = {};
    assert.equal(getDefaultCache(), null);
  } finally {
    globalThis.caches = prev;
  }
});

test("getDefaultCache returns default cache when present", () => {
  const fake = {};
  const prev = globalThis.caches;
  globalThis.caches = { default: fake };
  try {
    assert.strictEqual(getDefaultCache(), fake);
  } finally {
    globalThis.caches = prev;
  }
});

test("cacheKeyForGet strips query and hash from URL", () => {
  const u = new URL("https://example.com/api/tests/foo?x=1#h");
  const key = cacheKeyForGet(u);
  assert.equal(new URL(key.url).href, "https://example.com/api/tests/foo");
});

test("withCacheHeaders uses default stale-while-revalidate from maxAge when swr omitted", () => {
  const h = withCacheHeaders(
    { "Content-Type": "application/json" },
    { maxAge: 10 },
  );
  assert.match(h.get("Cache-Control"), /stale-while-revalidate=100/);
});

test("withCacheHeaders stale-if-error uses maxAge*5 when sMaxAge omitted", () => {
  const h = withCacheHeaders({}, { maxAge: 10 });
  assert.match(h.get("Cache-Control"), /stale-if-error=50/);
});

test("withCacheHeaders stale-if-error uses finite sMaxAge when set", () => {
  const h = withCacheHeaders({}, { maxAge: 10, sMaxAge: 33 });
  assert.match(h.get("Cache-Control"), /stale-if-error=33/);
});

test("withCacheHeaders applies defaults when opts omitted", () => {
  const h = withCacheHeaders({ "Content-Type": "application/json" });
  assert.match(h.get("Cache-Control"), /max-age=60/);
  assert.match(h.get("Cache-Control"), /stale-while-revalidate=600/);
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

test("withCacheHeaders uses maxAge-derived swr when staleWhileRevalidate is not finite", () => {
  const h = withCacheHeaders(
    {},
    { maxAge: 10, staleWhileRevalidate: Number.NaN },
  );
  assert.match(h.get("Cache-Control"), /stale-while-revalidate=100/);
});

test("withCacheHeaders uses maxAge-derived swr when staleWhileRevalidate is Infinity", () => {
  const h = withCacheHeaders(
    {},
    { maxAge: 10, staleWhileRevalidate: Infinity },
  );
  assert.match(h.get("Cache-Control"), /stale-while-revalidate=100/);
});

test("withCacheHeaders uses maxAge-derived swr when staleWhileRevalidate is non-number", () => {
  const h = withCacheHeaders(
    {},
    { maxAge: 10, staleWhileRevalidate: /** @type {any} */ ("60") },
  );
  assert.match(h.get("Cache-Control"), /stale-while-revalidate=100/);
});

test("withCacheHeaders omits s-maxage when sMaxAge is Infinity", () => {
  const h = withCacheHeaders({}, { maxAge: 10, sMaxAge: Infinity });
  assert.ok(!/s-maxage=/i.test(h.get("Cache-Control") || ""));
});

test("withCacheHeaders omits s-maxage when sMaxAge is not finite", () => {
  const h = withCacheHeaders({}, { maxAge: 10, sMaxAge: Number.NaN });
  assert.match(h.get("Cache-Control"), /max-age=10/);
  assert.ok(!/s-maxage=/i.test(h.get("Cache-Control") || ""));
});

test("withCacheHeaders sets ETag when etag option provided", () => {
  const h = withCacheHeaders({}, { maxAge: 10, etag: '"v1"' });
  assert.equal(h.get("ETag"), '"v1"');
});

test("withCacheHeaders does not set ETag when etag is empty string", () => {
  const h = withCacheHeaders({}, { maxAge: 10, etag: "" });
  assert.equal(h.has("ETag"), false);
});

test("withCacheHeaders includes s-maxage=0 when sMaxAge is zero", () => {
  const h = withCacheHeaders({}, { maxAge: 10, sMaxAge: 0 });
  assert.match(h.get("Cache-Control"), /s-maxage=0/);
});

test("withCacheHeaders floors negative sMaxAge to zero in s-maxage", () => {
  const h = withCacheHeaders({}, { maxAge: 10, sMaxAge: -3 });
  assert.match(h.get("Cache-Control"), /s-maxage=0/);
});

test("serverTimingHeader omits desc when desc is only whitespace", () => {
  const s = serverTimingHeader([{ name: "m", desc: "   " }]);
  assert.equal(s, "m");
});

test("jsonResponse and noStoreJsonResponse serialize JSON", async () => {
  const res201 = jsonResponse({ x: 1 }, { status: 201 });
  assert.equal(res201.status, 201);
  const j = await res201.json();
  assert.deepEqual(j, { x: 1 });
  const res400 = noStoreJsonResponse({ y: 2 }, 400);
  assert.equal(res400.status, 400);
  assert.deepEqual(await res400.json(), { y: 2 });
});

test("jsonResponse uses custom headers from init", async () => {
  const res = jsonResponse(
    { ok: true },
    { headers: { "X-Custom": "1", "Content-Type": "application/json" } },
  );
  assert.equal(res.headers.get("X-Custom"), "1");
  assert.deepEqual(await res.json(), { ok: true });
});

test("jsonResponse with empty init uses defaults", async () => {
  const res = jsonResponse({ x: 1 }, {});
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") || "", /application\/json/);
  assert.deepEqual(await res.json(), { x: 1 });
});

test("jsonResponse without init uses status 200 and default JSON headers", async () => {
  const res = jsonResponse({ a: 1 });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") || "", /application\/json/);
  assert.deepEqual(await res.json(), { a: 1 });
});

test("serverTimingHeader skips metrics without name and escapes quotes in desc", () => {
  const s = serverTimingHeader([
    { name: "" },
    { name: "a", dur: 1.2, desc: 'say "hi"' },
  ]);
  assert.match(s, /a;dur=1\.2;desc="say \\"hi\\""/);
});

test("serverTimingHeader omits dur when value is not finite", () => {
  const s = serverTimingHeader([{ name: "n", dur: Number.NaN }]);
  assert.equal(s, "n");
});

test("serverTimingHeader omits dur when value is Infinity", () => {
  const s = serverTimingHeader([{ name: "n", dur: Infinity }]);
  assert.equal(s, "n");
});

test("serverTimingHeader clamps negative finite dur to zero", () => {
  const s = serverTimingHeader([{ name: "n", dur: -2.3 }]);
  assert.match(s, /dur=0\.0/);
});

test("serverTimingHeader skips non-string desc", () => {
  const s = serverTimingHeader([{ name: "n", desc: 42 }]);
  assert.equal(s, "n");
});

test("serverTimingHeader filters null metrics", () => {
  assert.equal(serverTimingHeader([null, { name: "ok" }]), "ok");
});

test("setServerTiming does not set header when value empty", () => {
  const h = new Headers();
  setServerTiming(h, [{ name: "" }]);
  assert.equal(h.has("Server-Timing"), false);
});

test("setServerTiming sets Server-Timing when metrics valid", () => {
  const h = new Headers();
  setServerTiming(h, [{ name: "db", dur: 2.5 }]);
  assert.match(h.get("Server-Timing") || "", /db;dur=2\.5/);
});
