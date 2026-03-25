import assert from "node:assert/strict";
import test from "node:test";

import { dispatchWorkerRequest } from "../../worker/http/dispatch.ts";
import { installDefaultCacheStub } from "../shared/worker-harness.mjs";

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

test("dispatchWorkerRequest: unknown path -> 404", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/no-such-route"),
    {},
    execCtx(),
  );
  assert.equal(res.status, 404);
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
