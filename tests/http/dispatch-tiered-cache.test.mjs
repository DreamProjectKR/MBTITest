import assert from "node:assert/strict";
import test from "node:test";

import { dispatchWorkerRequest } from "../../worker/http/dispatch.ts";
import {
  createDetailDb,
  createIndexDb,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("dispatchWorkerRequest: tiered cache returns null when SELF omits content-type on GET /api/tests", async () => {
  const env = {
    SELF: {
      async fetch() {
        return new Response(JSON.stringify({ tests: [] }), {
          status: 200,
          headers: {},
        });
      },
    },
    MBTI_DB: createIndexDb([
      {
        test_id: "only",
        title: "Only",
        thumbnail_path: "assets/only/images/thumbnail.png",
        tags_json: "[]",
        source_path: "only/test.json",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        is_published: 1,
      },
    ]),
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    env,
    { waitUntil() {} },
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.tests.length, 1);
});

test("dispatchWorkerRequest: tiered cache SELF.fetch rejection returns 500", async () => {
  const env = {
    SELF: {
      fetch() {
        return Promise.reject(new Error("SELF tiered fetch failed"));
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    env,
    { waitUntil() {} },
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "An unexpected error occurred.");
});

test("dispatchWorkerRequest: Error without stack logs message only", async () => {
  const calls = [];
  const orig = console.error;
  console.error = (...args) => {
    calls.push(args);
  };
  try {
    const env = {
      SELF: {
        fetch() {
          const err = new Error("tiered-no-stack");
          delete err.stack;
          return Promise.reject(err);
        },
      },
    };
    const res = await dispatchWorkerRequest(
      new Request("https://example.com/api/tests"),
      env,
      { waitUntil() {} },
    );
    assert.equal(res.status, 500);
    const hit = calls.some(
      (c) =>
        c.length === 2 && c[0] === "[worker]" && c[1] === "tiered-no-stack",
    );
    assert.ok(hit, `expected two-arg console.error, got ${JSON.stringify(calls)}`);
  } finally {
    console.error = orig;
  }
});

test("dispatchWorkerRequest: tiered cache uses SELF.fetch for GET /api/tests", async () => {
  let originSeen = false;
  const env = {
    SELF: {
      async fetch(req) {
        originSeen = req.headers.get("X-Mbti-Origin-Request") === "1";
        return new Response(JSON.stringify({ tests: [] }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    env,
    { waitUntil() {} },
  );
  assert.equal(originSeen, true);
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.ok(Array.isArray(j.tests));
});

test("dispatchWorkerRequest: tiered cache returns null for non-JSON content-type from SELF", async () => {
  const env = {
    SELF: {
      async fetch() {
        return new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    },
    MBTI_DB: createIndexDb([
      {
        test_id: "t",
        title: "T",
        thumbnail_path: "assets/t/images/thumbnail.png",
        tags_json: "[]",
        source_path: "t/test.json",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        is_published: 1,
      },
    ]),
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    env,
    { waitUntil() {} },
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.tests.length, 1);
});

test("dispatchWorkerRequest: tiered cache accepts SELF JSON when content-type uses uppercase APPLICATION/JSON", async () => {
  const env = {
    SELF: {
      async fetch() {
        return new Response(JSON.stringify({ tests: [] }), {
          status: 200,
          headers: { "content-type": "APPLICATION/JSON; charset=utf-8" },
        });
      },
    },
    MBTI_DB: createIndexDb([
      {
        test_id: "only",
        title: "Only",
        thumbnail_path: "assets/only/images/thumbnail.png",
        tags_json: "[]",
        source_path: "only/test.json",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        is_published: 1,
      },
    ]),
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    env,
    { waitUntil() {} },
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.ok(Array.isArray(j.tests));
});

test("dispatchWorkerRequest: tiered cache returns null when SELF returns text/plain on GET /api/tests", async () => {
  const env = {
    SELF: {
      async fetch() {
        return new Response("not json", {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      },
    },
    MBTI_DB: createIndexDb([
      {
        test_id: "only",
        title: "Only",
        thumbnail_path: "assets/only/images/thumbnail.png",
        tags_json: "[]",
        source_path: "only/test.json",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        is_published: 1,
      },
    ]),
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    env,
    { waitUntil() {} },
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.tests.length, 1);
});

test("dispatchWorkerRequest: tiered cache returns null when SELF returns application/hal+json on GET /api/tests", async () => {
  const env = {
    SELF: {
      async fetch() {
        return new Response(JSON.stringify({ tests: [] }), {
          status: 200,
          headers: { "content-type": "application/hal+json" },
        });
      },
    },
    MBTI_DB: createIndexDb([
      {
        test_id: "only",
        title: "Only",
        thumbnail_path: "assets/only/images/thumbnail.png",
        tags_json: "[]",
        source_path: "only/test.json",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        is_published: 1,
      },
    ]),
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    env,
    { waitUntil() {} },
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.tests.length, 1);
});

test("dispatchWorkerRequest: tiered cache returns null for non-JSON from SELF on GET /api/tests/:id", async () => {
  const { bucket } = createJsonBucket({
    "assets/pub-test/test.json": JSON.stringify({
      id: "pub-test",
      title: "Detail",
      questions: [],
      results: {
        ESTJ: { image: "assets/pub-test/images/r.png", summary: "s" },
      },
    }),
  });
  const env = {
    SELF: {
      async fetch() {
        return new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    },
    MBTI_BUCKET: bucket,
    MBTI_DB: createDetailDb({
      test_id: "pub-test",
      title: "Detail",
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
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests/pub-test"),
    env,
    { waitUntil() {} },
  );
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.id, "pub-test");
});

test("dispatchWorkerRequest: tiered cache wraps SELF response for assets route (non-API)", async () => {
  let selfCalled = false;
  const env = {
    SELF: {
      async fetch() {
        selfCalled = true;
        return new Response("binary-bytes", {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        });
      },
    },
    MBTI_BUCKET: createJsonBucket().bucket,
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/assets/t1/hero.png"),
    env,
    { waitUntil() {} },
  );
  assert.ok(selfCalled);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "binary-bytes");
});
