import assert from "node:assert/strict";
import test from "node:test";

import { handleAssetsGet } from "../../worker/assets/handler.ts";
import {
  createContext,
  createJsonBucket,
  installInMemoryCacheStub,
} from "../shared/worker-harness.mjs";

test("assets handler: missing MBTI_BUCKET -> 500", async () => {
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/x.png",
      env: {},
      params: { path: "x.png" },
    }),
  );
  assert.equal(res.status, 500);
});

test("assets handler: empty path -> 404", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/a.png": "x" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/",
      env: { MBTI_BUCKET: bucket },
      params: { path: "" },
    }),
  );
  assert.equal(res.status, 404);
});

test("assets handler: params.path as array joins segments", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/a/b.png": "hi" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/a/b.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: ["a", "b.png"] },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: Range suffix bytes=-N returns 206", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/suffix.bin": "abcdef" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/suffix.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/suffix.bin" },
      headers: { range: "bytes=-2" },
    }),
  );
  assert.equal(res.status, 206);
  assert.match(res.headers.get("Content-Range"), /bytes/);
});

test("assets handler: Range bytes=0- open ended uses offset only", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/open.bin": "xyz" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/open.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/open.bin" },
      headers: { range: "bytes=1-" },
    }),
  );
  assert.equal(res.status, 206);
});

test("assets handler: invalid Range header ignored for full 200", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/full.bin": "abc" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/full.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/full.bin" },
      headers: { range: "bytes=9-1" },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: Range bytes=0-0 on single-byte object returns 206", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/one.bin": "x" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/one.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/one.bin" },
      headers: { range: "bytes=0-0" },
    }),
  );
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("Content-Range"), "bytes 0-0/1");
});

test("assets handler: guessContentType woff2 and default octet-stream", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({
    "assets/f/a.woff2": "w",
    "assets/f/b.unknown": "?",
  });
  const r1 = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/f/a.woff2",
      env: { MBTI_BUCKET: bucket },
      params: { path: "f/a.woff2" },
    }),
  );
  assert.equal(r1.headers.get("Content-Type"), "font/woff2");
  const r2 = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/f/b.unknown",
      env: { MBTI_BUCKET: bucket },
      params: { path: "f/b.unknown" },
    }),
  );
  assert.equal(r2.headers.get("Content-Type"), "application/octet-stream");
});

test("assets handler: guessContentType gif svg css js", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({
    "assets/f/x.gif": "g",
    "assets/f/x.svg": "<svg/>",
    "assets/f/x.css": "a{}",
    "assets/f/x.js": "//",
    "assets/f/x.jpg": "j",
    "assets/f/x.jpeg": "e",
  });
  const types = [
    ["f/x.gif", "image/gif"],
    ["f/x.svg", "image/svg+xml"],
    ["f/x.css", "text/css; charset=utf-8"],
    ["f/x.js", "text/javascript; charset=utf-8"],
    ["f/x.jpg", "image/jpeg"],
    ["f/x.jpeg", "image/jpeg"],
  ];
  for (const [path, expected] of types) {
    const res = await handleAssetsGet(
      createContext({
        url: `https://example.com/assets/${path}`,
        env: { MBTI_BUCKET: bucket },
        params: { path },
      }),
    );
    assert.equal(res.headers.get("Content-Type"), expected, path);
  }
});

test("assets handler: UI image path uses long immutable cache-control", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/images/hero.png": "x" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/images/hero.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "images/hero.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control") || "", /immutable/);
});

test("assets handler: invalid Range bytes=bad-1 ignored for full 200", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/badstart.bin": "abc" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/badstart.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/badstart.bin" },
      headers: { range: "bytes=bad-1" },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: does not cache.put when Cache-Control is no-store from R2 metadata", async () => {
  const cacheCalls = installInMemoryCacheStub();
  const bucket = {
    async get() {
      return {
        etag: "e1",
        size: 3,
        body: new Uint8Array([1, 2, 3]),
        httpMetadata: {
          cacheControl: "no-store",
          contentType: "image/png",
        },
      };
    },
  };
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/ns/nostore.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "ns/nostore.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control") || "", /no-store/i);
  assert.equal(cacheCalls.put.length, 0);
});

test("assets handler: skips cache.put when Cache API is unavailable", async () => {
  const prev = globalThis.caches;
  let waitUntilCalls = 0;
  try {
    globalThis.caches = undefined;
    const { bucket } = createJsonBucket({ "assets/nocacheapi.png": "x" });
    const res = await handleAssetsGet(
      createContext({
        url: "https://example.com/assets/nocacheapi.png",
        env: { MBTI_BUCKET: bucket },
        params: { path: "nocacheapi.png" },
        waitUntil(fn) {
          waitUntilCalls += 1;
          return fn();
        },
      }),
    );
    assert.equal(res.status, 200);
    assert.equal(waitUntilCalls, 0);
  } finally {
    globalThis.caches = prev;
  }
});

test("assets handler: pragma header bypasses cache read", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/cached.png": "x" });
  const url = "https://example.com/assets/cached.png";
  const first = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "cached.png" },
    }),
  );
  assert.equal(first.status, 200);
  await caches.default.put(new Request(url, { method: "GET" }), first.clone());
  const second = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "cached.png" },
      headers: { pragma: "no-cache" },
    }),
  );
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "MISS");
});

test("assets handler: Cache-Control no-cache bypasses cache read", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/cc-nocache.png": "x" });
  const url = "https://example.com/assets/cc-nocache.png";
  const first = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "cc-nocache.png" },
    }),
  );
  assert.equal(first.status, 200);
  await caches.default.put(new Request(url, { method: "GET" }), first.clone());
  const second = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "cc-nocache.png" },
      headers: { "cache-control": "no-cache" },
    }),
  );
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "MISS");
});

test("assets handler: resolves object under legacy assets/data/ key", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({
    "assets/data/legacy-only/x.png": "z",
  });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/legacy-only/x.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "legacy-only/x.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(
    res.headers.get("X-MBTI-R2-Key"),
    "assets/data/legacy-only/x.png",
  );
});

test("assets handler: suffix range with missing obj.size uses wildcard Content-Range", async () => {
  installInMemoryCacheStub();
  const bucket = {
    async get(_key, options) {
      if (!options?.range?.suffix) return null;
      return {
        etag: "e1",
        body: new Uint8Array([9, 9]),
        httpMetadata: { contentType: "application/octet-stream" },
      };
    },
  };
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/nosize.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "nosize.bin" },
      headers: { range: "bytes=-2" },
    }),
  );
  assert.equal(res.status, 206);
  assert.match(res.headers.get("Content-Range"), /bytes 0-\*\/\*/);
});

test("assets handler: invalid Range bytes=-0 returns full 200", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/bad-suffix.bin": "ab" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/bad-suffix.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/bad-suffix.bin" },
      headers: { range: "bytes=-0" },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: object uses httpMetadata cacheControl when set", async () => {
  installInMemoryCacheStub();
  const bucket = {
    async get(key) {
      if (key !== "assets/meta/cc.png") return null;
      return {
        etag: "e1",
        size: 3,
        body: new Uint8Array([1, 2, 3]),
        httpMetadata: {
          cacheControl: "public, max-age=10",
          contentType: "image/png",
        },
      };
    },
  };
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/meta/cc.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "meta/cc.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control"), /max-age=10/);
});

test("assets handler: If-None-Match matches etag -> 304", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/etag-match.png": "xy" });
  const url = "https://example.com/assets/etag-match.png";
  const first = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "etag-match.png" },
    }),
  );
  assert.equal(first.status, 200);
  const etag = first.headers.get("ETag");
  assert.ok(etag);
  const notModified = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "etag-match.png" },
      headers: {
        pragma: "no-cache",
        "if-none-match": etag,
      },
    }),
  );
  assert.equal(notModified.status, 304);
  assert.equal(notModified.headers.get("ETag"), etag);
});

test("assets handler: If-None-Match without stored etag skips 304", async () => {
  installInMemoryCacheStub();
  const bucket = {
    async get() {
      return {
        etag: undefined,
        size: 1,
        body: new Uint8Array([1]),
        httpMetadata: { contentType: "image/png" },
      };
    },
  };
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/noetag.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "noetag.png" },
      headers: { "if-none-match": '"x"' },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: versioned ?v= uses immutable cache-control branch", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({
    "assets/v/t.png": "bytes",
  });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/v/t.png?v=1",
      env: { MBTI_BUCKET: bucket },
      params: { path: "v/t.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control"), /immutable/);
});

test("assets handler: second GET hits Cache API (HIT)", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/hit.png": "payload" });
  const url = "https://example.com/assets/hit.png";
  const first = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "hit.png" },
    }),
  );
  assert.equal(first.headers.get("X-MBTI-Edge-Cache"), "MISS");
  await caches.default.put(new Request(url, { method: "GET" }), first.clone());
  const second = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "hit.png" },
    }),
  );
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "HIT");
});

test("assets handler: UI images path uses long-cache branch", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/images/ui.png": "x" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/images/ui.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "images/ui.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control"), /immutable/);
});

test("assets handler: tail that normalizes to empty segments -> 404", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({});
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/../",
      env: { MBTI_BUCKET: bucket },
      params: { path: ".." },
    }),
  );
  assert.equal(res.status, 404);
});

test("assets handler: localhost fetches first candidate from R2_PUBLIC_BASE_URL", async () => {
  installInMemoryCacheStub();
  const prevFetch = globalThis.fetch;
  const bucket = {
    async get() {
      return null;
    },
  };
  try {
    globalThis.fetch = async (input) => {
      const u = String(input instanceof Request ? input.url : input);
      assert.ok(u.includes("cdn.example.com/assets/remote-first.png"));
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    };
    const res = await handleAssetsGet(
      createContext({
        url: "http://127.0.0.1/assets/remote-first.png",
        env: {
          MBTI_BUCKET: bucket,
          R2_PUBLIC_BASE_URL: "https://cdn.example.com",
        },
        params: { path: "remote-first.png" },
      }),
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-MBTI-R2-Key"), "assets/remote-first.png");
    assert.match(res.headers.get("Server-Timing") || "", /REMOTE/);
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("assets handler: non-localhost never calls global fetch for R2 miss", async () => {
  installInMemoryCacheStub();
  const prevFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response("bad", { status: 200 });
  };
  try {
    const bucket = {
      async get() {
        return null;
      },
    };
    const res = await handleAssetsGet(
      createContext({
        url: "https://example.com/assets/nofetch.png",
        env: {
          MBTI_BUCKET: bucket,
          R2_PUBLIC_BASE_URL: "https://cdn.example.com",
        },
        params: { path: "nofetch.png" },
      }),
    );
    assert.equal(res.status, 404);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("assets handler: localhost returns 404 when all remote fetches fail", async () => {
  installInMemoryCacheStub();
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 404 });
  try {
    const bucket = {
      async get() {
        return null;
      },
    };
    const res = await handleAssetsGet(
      createContext({
        url: "http://127.0.0.1/assets/all-remote-404.png",
        env: {
          MBTI_BUCKET: bucket,
          R2_PUBLIC_BASE_URL: "https://cdn.example.com",
        },
        params: { path: "all-remote-404.png" },
      }),
    );
    assert.equal(res.status, 404);
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("assets handler: request Cache-Control no-store bypasses cache read", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/nsreq.png": "x" });
  const url = "https://example.com/assets/nsreq.png";
  const first = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "nsreq.png" },
    }),
  );
  assert.equal(first.status, 200);
  await caches.default.put(new Request(url, { method: "GET" }), first.clone());
  const second = await handleAssetsGet(
    createContext({
      url,
      env: { MBTI_BUCKET: bucket },
      params: { path: "nsreq.png" },
      headers: { "cache-control": "no-store" },
    }),
  );
  assert.equal(second.headers.get("X-MBTI-Edge-Cache"), "MISS");
});

test("assets handler: invalid Range bytes=10-5 yields full 200", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/badclosed.bin": "abc" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/badclosed.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/badclosed.bin" },
      headers: { range: "bytes=10-5" },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: localhost tries later lookup keys until fetch succeeds", async () => {
  installInMemoryCacheStub();
  const prevFetch = globalThis.fetch;
  const bucket = {
    async get() {
      return null;
    },
  };
  try {
    globalThis.fetch = async (input) => {
      const u = String(input instanceof Request ? input.url : input);
      if (u === "https://pub.example.com/remote-tail.png") {
        return new Response(new Uint8Array([9]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return new Response("missing", { status: 404 });
    };
    const res = await handleAssetsGet(
      createContext({
        url: "http://localhost/assets/remote-tail.png",
        env: {
          MBTI_BUCKET: bucket,
          R2_PUBLIC_BASE_URL: "https://pub.example.com",
        },
        params: { path: "remote-tail.png" },
      }),
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-MBTI-R2-Key"), "remote-tail.png");
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("assets handler: open-ended Range bytes=N- with missing obj.size", async () => {
  installInMemoryCacheStub();
  const bucket = {
    async get(_key, options) {
      if (!options?.range?.offset && options?.range?.offset !== 0) return null;
      return {
        etag: "e1",
        body: new Uint8Array([9, 9, 9]),
        httpMetadata: { contentType: "application/octet-stream" },
      };
    },
  };
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/open.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "open.bin" },
      headers: { range: "bytes=1-" },
    }),
  );
  assert.equal(res.status, 206);
  assert.match(res.headers.get("Content-Range"), /bytes 1-\*\/\*/);
});

test("assets handler: schedules cache.put for cacheable 200", async () => {
  const cacheCalls = installInMemoryCacheStub();
  const waitUntilPromises = [];
  const { bucket } = createJsonBucket({ "assets/cache-put.png": "body" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/cache-put.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "cache-put.png" },
      waitUntil(p) {
        waitUntilPromises.push(Promise.resolve(p));
      },
    }),
  );
  assert.equal(res.status, 200);
  await Promise.all(waitUntilPromises);
  assert.equal(cacheCalls.put.length, 1);
});

test("assets handler: .json tail uses short-cache policy", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/data/sample.json": "{}" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/data/sample.json",
      env: { MBTI_BUCKET: bucket },
      params: { path: "data/sample.json" },
    }),
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control"), /must-revalidate/);
  assert.match(res.headers.get("Cache-Control"), /max-age=60/);
});

test("assets handler: Cache-Tag includes test id for assets/test-* paths", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/test-xyz/img.png": "x" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/test-xyz/img.png",
      env: { MBTI_BUCKET: bucket },
      params: { path: "test-xyz/img.png" },
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Tag"), "assets,test,test-xyz");
});

test("assets handler: Range without hyphen in value is ignored", async () => {
  installInMemoryCacheStub();
  const { bucket } = createJsonBucket({ "assets/r/nohyphen.bin": "abc" });
  const res = await handleAssetsGet(
    createContext({
      url: "https://example.com/assets/r/nohyphen.bin",
      env: { MBTI_BUCKET: bucket },
      params: { path: "r/nohyphen.bin" },
      headers: { range: "bytes=invalid" },
    }),
  );
  assert.equal(res.status, 200);
});

test("assets handler: localhost remote uses immutable cache when ?v= present", async () => {
  installInMemoryCacheStub();
  const prevFetch = globalThis.fetch;
  const bucket = {
    async get() {
      return null;
    },
  };
  try {
    globalThis.fetch = async (input) => {
      const u = String(input instanceof Request ? input.url : input);
      if (u.includes("assets/vremote.png")) {
        return new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      return new Response("", { status: 404 });
    };
    const res = await handleAssetsGet(
      createContext({
        url: "http://127.0.0.1/assets/vremote.png?v=1",
        env: {
          MBTI_BUCKET: bucket,
          R2_PUBLIC_BASE_URL: "https://cdn.example.com",
        },
        params: { path: "vremote.png" },
      }),
    );
    assert.equal(res.status, 200);
    assert.match(res.headers.get("Cache-Control") || "", /immutable/);
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("assets handler: localhost R2_PUBLIC_BASE_URL slash-only skips tryFetchRemote", async () => {
  installInMemoryCacheStub();
  const prevFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response("", { status: 200 });
  };
  try {
    const bucket = {
      async get() {
        return null;
      },
    };
    const res = await handleAssetsGet(
      createContext({
        url: "http://127.0.0.1/assets/slash-only.png",
        env: { MBTI_BUCKET: bucket, R2_PUBLIC_BASE_URL: "///" },
        params: { path: "slash-only.png" },
      }),
    );
    assert.equal(res.status, 404);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = prevFetch;
  }
});
