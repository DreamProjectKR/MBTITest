import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost } from "../../worker/api/tests/[id]/compute.ts";
import { createContext, createDetailDb } from "../shared/worker-harness.mjs";

test("POST compute: arrayBuffer rejection -> 400", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.error(new Error("stream read failed"));
    },
  });
  const req = new Request("https://example.com/api/tests/t1/compute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  });
  const res = await onRequestPost({
    request: req,
    env: {
      MBTI_DB: createDetailDb({ test_id: "t1", is_published: 1 }),
    },
    params: { id: "t1" },
    waitUntil() {},
  });
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(j.error, /could not be read|read/i);
});
