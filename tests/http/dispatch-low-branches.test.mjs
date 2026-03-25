import assert from "node:assert/strict";
import test from "node:test";

import { dispatchWorkerRequest } from "../../worker/http/dispatch.ts";
import {
  createIndexDb,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("dispatchWorkerRequest: PATCH on known API route -> 404 (no PUT/GET/POST handler)", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/api/tests", { method: "PATCH" }),
    {},
    { waitUntil() {} },
  );
  assert.equal(res.status, 404);
});

test("dispatchWorkerRequest: GET /api/tests without SELF skips tiered cache and lists from D1", async () => {
  const env = {
    MBTI_DB: createIndexDb([
      {
        test_id: "a",
        title: "A",
        thumbnail_path: "assets/a/t.png",
        tags_json: "[]",
        source_path: "a/test.json",
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

test("dispatchWorkerRequest: unknown route with SELF absent does not throw", async () => {
  const res = await dispatchWorkerRequest(
    new Request("https://example.com/unknown/path"),
    {},
    { waitUntil() {} },
  );
  assert.equal(res.status, 404);
});
