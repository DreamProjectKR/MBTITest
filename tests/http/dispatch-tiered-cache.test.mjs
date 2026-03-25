import assert from "node:assert/strict";
import test from "node:test";

import { dispatchWorkerRequest } from "../../worker/http/dispatch.ts";
import {
  createIndexDb,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

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
