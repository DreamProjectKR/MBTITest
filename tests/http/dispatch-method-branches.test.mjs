import assert from "node:assert/strict";
import test from "node:test";

import { dispatchWorkerRequest } from "../../worker/http/dispatch.ts";

test("dispatchWorkerRequest: unsupported method on known route uses ASSETS or 404", async () => {
  const ctx = { waitUntil() {} };
  const env = {
    ASSETS: {
      fetch: async () => new Response("ok", { status: 200 }),
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "PATCH" }),
    env,
    ctx,
  );
  assert.equal(res.status, 200);
});

test("dispatchWorkerRequest: catch non-Error rejection", async () => {
  const ctx = { waitUntil() {} };
  const env = {
    ASSETS: {
      fetch: async () => {
        throw "string throw";
      },
    },
  };
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/unknown-route", { method: "GET" }),
    env,
    ctx,
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "An unexpected error occurred.");
});
