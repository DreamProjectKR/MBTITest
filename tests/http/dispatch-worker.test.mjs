import assert from "node:assert/strict";
import test from "node:test";

import { dispatchWorkerRequest } from "../../worker/http/dispatch.ts";
import {
  createIndexDb,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

function execCtx() {
  return {
    waitUntil() {},
  };
}

test("dispatchWorkerRequest: handler throws -> 500 JSON envelope", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    {
      MBTI_DB: {
        prepare() {
          throw new Error("prepare boom");
        },
      },
    },
    execCtx(),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "An unexpected error occurred.");
});

test("dispatchWorkerRequest: Error with undefined stack uses single-arg log branch", async () => {
  const err = new Error("no stack trace");
  err.stack = undefined;
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    {
      MBTI_DB: {
        prepare() {
          throw err;
        },
      },
    },
    execCtx(),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "An unexpected error occurred.");
});

test("dispatchWorkerRequest: Error with empty stack uses console branch without stack", async () => {
  const err = new Error("no stack trace");
  err.stack = "";
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    {
      MBTI_DB: {
        prepare() {
          throw err;
        },
      },
    },
    execCtx(),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "An unexpected error occurred.");
});

test("dispatchWorkerRequest: unknown path -> 404", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/no-such-route"),
    {},
    execCtx(),
  );
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: HEAD on known route without handler -> 404", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "HEAD" }),
    {},
    execCtx(),
  );
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: HEAD skips tiered SELF fetch", async () => {
  let selfCalled = false;
  const env = {
    SELF: {
      fetch() {
        selfCalled = true;
        return Promise.reject(new Error("SELF should not run for HEAD"));
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "HEAD" }),
    env,
    execCtx(),
  );
  assert.equal(selfCalled, false);
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: origin subrequest on unknown path without ASSETS -> 404", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/unknown-segment/x", {
      headers: { "X-Mbti-Origin-Request": "1" },
    }),
    {},
    execCtx(),
  );
  assert.equal(res.status, 404);
  const j = await res.json();
  assert.equal(j.error, "Not Found");
});

test("dispatchWorkerRequest: origin subrequest uses ASSETS when no API handler", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/favicon.ico", {
      headers: { "X-Mbti-Origin-Request": "1" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("ico", { status: 200 }),
      },
    },
    execCtx(),
  );
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "ico");
});

test("dispatchWorkerRequest: non-Error throw uses generic message and single-arg log branch", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    {
      MBTI_DB: {
        prepare() {
          throw "not an Error";
        },
      },
    },
    execCtx(),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "An unexpected error occurred.");
});

test("dispatchWorkerRequest: DELETE on known route has no handler -> 404", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "DELETE" }),
    {},
    execCtx(),
  );
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: PATCH on known API route -> 404 (no PATCH handler)", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "PATCH" }),
    {},
    execCtx(),
  );
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: LINK on known API route -> 404 (unsupported method)", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "LINK" }),
    {},
    execCtx(),
  );
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: PUT on tests index route -> 404 (GET-only)", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "PUT" }),
    {},
    execCtx(),
  );
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: GET on POST-only compute route has no GET handler -> 404", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests/foo/compute"),
    {},
    execCtx(),
  );
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: POST skips tiered cache (SELF not called)", async () => {
  let selfCalled = false;
  const env = {
    MBTI_DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          async all() {
            return { results: [] };
          },
        };
      },
    },
    SELF: {
      fetch() {
        selfCalled = true;
        return Promise.reject(new Error("SELF should not run for POST"));
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "POST" }),
    env,
    execCtx(),
  );
  assert.equal(selfCalled, false);
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: GET admin route with tieredCache null does not call SELF", async () => {
  let selfCalled = false;
  const env = {
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
    SELF: {
      fetch() {
        selfCalled = true;
        return Promise.reject(
          new Error("SELF should not run when cfOptions null"),
        );
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/admin/tests"),
    env,
    execCtx(),
  );
  assert.equal(selfCalled, false);
  assert.equal(res.status, 200);
});

test("dispatchWorkerRequest: unknown path with SELF does not call SELF", async () => {
  let selfCalled = false;
  const env = {
    SELF: {
      fetch() {
        selfCalled = true;
        return Promise.reject(
          new Error("SELF should not run for unknown route"),
        );
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/no-tiered-route"),
    env,
    execCtx(),
  );
  assert.equal(selfCalled, false);
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: PATCH with origin uses ASSETS when no method handler", async () => {
  let assetsCalled = false;
  const env = {
    ASSETS: {
      async fetch(req) {
        assetsCalled = true;
        assert.equal(req.method, "PATCH");
        return new Response(null, { status: 204 });
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", {
      method: "PATCH",
      headers: { "X-Mbti-Origin-Request": "1" },
    }),
    env,
    execCtx(),
  );
  assert.equal(assetsCalled, true);
  assert.equal(res.status, 204);
});

test("dispatchWorkerRequest: OPTIONS with origin uses ASSETS when no method handler", async () => {
  let assetsCalled = false;
  const env = {
    ASSETS: {
      async fetch(req) {
        assetsCalled = true;
        assert.equal(req.method, "OPTIONS");
        return new Response(null, { status: 204 });
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", {
      method: "OPTIONS",
      headers: { "X-Mbti-Origin-Request": "1" },
    }),
    env,
    execCtx(),
  );
  assert.equal(assetsCalled, true);
  assert.equal(res.status, 204);
});

test("dispatchWorkerRequest: X-Mbti-Origin-Request skips tiered cache self-fetch", async () => {
  let selfCalled = false;
  const env = {
    MBTI_DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          async all() {
            return {
              results: [
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
              ],
            };
          },
        };
      },
    },
    SELF: {
      fetch() {
        selfCalled = true;
        return Promise.reject(
          new Error("should not be used for origin subrequest"),
        );
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", {
      headers: { "X-Mbti-Origin-Request": "1" },
    }),
    env,
    execCtx(),
  );
  assert.equal(selfCalled, false);
  assert.equal(res.status, 200);
});
