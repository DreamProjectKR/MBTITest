import assert from "node:assert/strict";
import test from "node:test";

import { dispatchWorkerRequest } from "../../worker/http/dispatch.ts";
import { installDefaultCacheStub } from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("dispatchWorkerRequest: DELETE on known route falls through to 404", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "DELETE" }),
    {},
    { waitUntil() {} },
  );
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: handler rejects with non-Error", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    {
      MBTI_DB: {
        prepare() {
          throw "not-an-error";
        },
      },
    },
    { waitUntil() {} },
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "An unexpected error occurred.");
});

test("dispatchWorkerRequest: Error with empty stack logs without stack line", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests"),
    {
      MBTI_DB: {
        prepare() {
          const err = new Error("boom");
          err.stack = "";
          throw err;
        },
      },
    },
    { waitUntil() {} },
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "An unexpected error occurred.");
});
