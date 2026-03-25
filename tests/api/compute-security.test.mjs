import assert from "node:assert/strict";
import test from "node:test";

import { MAX_COMPUTE_JSON_BYTES } from "../../worker/api/_utils/bodyLimits.ts";
import { RATE_COMPUTE_PER_WINDOW } from "../../worker/api/_utils/rateLimit.ts";
import { onRequestPost } from "../../worker/api/tests/[id]/compute.ts";
import { createMemoryKv } from "../shared/kv-harness.mjs";
import { createContext, createDetailDb } from "../shared/worker-harness.mjs";

const COMPUTE_URL = "https://example.com/api/tests/t1/compute";
const MINIMAL_BODY = JSON.stringify({
  answers: [{ mbtiAxis: "EI", direction: "E" }],
});

function baseEnv(overrides = {}) {
  return {
    MBTI_DB: createDetailDb({
      test_id: "t1",
      is_published: 1,
    }),
    ...overrides,
  };
}

test("POST compute: MBTI_DB missing -> 500", async () => {
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: {},
      params: { id: "t1" },
      headers: { "content-type": "application/json" },
      body: MINIMAL_BODY,
    }),
  );
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.match(body.error, /MBTI_DB|D1 binding/i);
});

test("POST compute: missing test id in params -> 400", async () => {
  const res = await onRequestPost(
    createContext({
      url: "https://example.com/api/tests//compute",
      method: "POST",
      env: baseEnv(),
      params: {},
      headers: { "content-type": "application/json" },
      body: MINIMAL_BODY,
    }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /test id/i);
});

test("POST compute: Content-Length exceeds MAX_COMPUTE_JSON_BYTES -> 413", async () => {
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: baseEnv(),
      params: { id: "t1" },
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_COMPUTE_JSON_BYTES + 1),
      },
      body: "{}",
    }),
  );
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.equal(body.error, "Payload too large.");
});

test("POST compute: body over max without Content-Length -> 413", async () => {
  const oversized = new Uint8Array(33 * 1024).fill(0x7b);
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: baseEnv(),
      params: { id: "t1" },
      headers: { "content-type": "application/json" },
      body: oversized,
    }),
  );
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.equal(body.error, "Payload too large.");
});

test("POST compute: invalid JSON -> 400", async () => {
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: baseEnv(),
      params: { id: "t1" },
      headers: { "content-type": "application/json" },
      body: "{not-json",
    }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /JSON/i);
});

test("POST compute: empty answers array -> 400", async () => {
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: baseEnv(),
      params: { id: "t1" },
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: [] }),
    }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /answers array is required/i);
});

test("POST compute: answers not an array -> 400", async () => {
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: baseEnv(),
      params: { id: "t1" },
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: { "0": { mbtiAxis: "EI", direction: "E" } } }),
    }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /answers array is required/i);
});

test("POST compute: no DB row -> 404", async () => {
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: {
        MBTI_DB: createDetailDb(null),
      },
      params: { id: "t1" },
      headers: { "content-type": "application/json" },
      body: MINIMAL_BODY,
    }),
  );
  assert.equal(res.status, 404);
});

test("POST compute: row with empty test_id -> 404", async () => {
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: {
        MBTI_DB: createDetailDb({
          test_id: "",
          is_published: 1,
        }),
      },
      params: { id: "t1" },
      headers: { "content-type": "application/json" },
      body: MINIMAL_BODY,
    }),
  );
  assert.equal(res.status, 404);
});

test("POST compute: draft (is_published 0) -> 404", async () => {
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: {
        MBTI_DB: createDetailDb({ test_id: "t1", is_published: 0 }),
      },
      params: { id: "t1" },
      headers: { "content-type": "application/json" },
      body: MINIMAL_BODY,
    }),
  );
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.error, /not found/i);
});

test("POST compute: published -> 200 with mbti in body", async () => {
  const res = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: baseEnv(),
      params: { id: "t1" },
      headers: { "content-type": "application/json" },
      body: MINIMAL_BODY,
    }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.testId, "t1");
  assert.ok(typeof body.mbti === "string" && body.mbti.length === 4);
});

test("POST compute: MBTI_KV rate limit -> 429 on 11th request in window", async () => {
  const kv = createMemoryKv();
  const ip = "203.0.113.50";
  const headers = {
    "content-type": "application/json",
    "cf-connecting-ip": ip,
  };

  for (let i = 0; i < RATE_COMPUTE_PER_WINDOW; i++) {
    const res = await onRequestPost(
      createContext({
        url: COMPUTE_URL,
        method: "POST",
        env: baseEnv({ MBTI_KV: kv }),
        params: { id: "t1" },
        headers,
        body: MINIMAL_BODY,
      }),
    );
    assert.equal(res.status, 200, `expected 200 on request ${i + 1}`);
  }

  const blocked = await onRequestPost(
    createContext({
      url: COMPUTE_URL,
      method: "POST",
      env: baseEnv({ MBTI_KV: kv }),
      params: { id: "t1" },
      headers,
      body: MINIMAL_BODY,
    }),
  );
  assert.equal(blocked.status, 429);
  const errBody = await blocked.json();
  assert.match(errBody.error, /too many/i);
});
