import assert from "node:assert/strict";
import test from "node:test";

import { rateLimitOr429 } from "../../worker/api/_utils/rateLimit.ts";
import { createMemoryKV } from "../shared/kv-harness.mjs";

const opts = (routeKey) => ({
  routeKey,
  limit: 3,
  windowSec: 60,
});

test("rateLimitOr429 returns null when kv is undefined (fail-open)", async () => {
  const req = new Request("https://example.com/api", {
    headers: { "cf-connecting-ip": "1.1.1.1" },
  });
  const out = await rateLimitOr429(undefined, req, opts("route-a"));
  assert.equal(out, null);
});

test("same CF-Connecting-IP: 4th request returns 429", async () => {
  const kv = createMemoryKV();
  const url = "https://example.com/compute";
  const headers = { "cf-connecting-ip": "192.0.2.1" };

  for (let i = 0; i < 3; i++) {
    const res = await rateLimitOr429(
      kv,
      new Request(url, { method: "POST", headers }),
      opts("compute"),
    );
    assert.equal(res, null);
  }

  const blocked = await rateLimitOr429(
    kv,
    new Request(url, { method: "POST", headers }),
    opts("compute"),
  );
  assert.ok(blocked instanceof Response);
  assert.equal(blocked.status, 429);
  const body = await blocked.json();
  assert.deepEqual(body, { error: "Too many requests." });
});

test("uses first IP from x-forwarded-for when cf-connecting-ip absent", async () => {
  const kv = createMemoryKV();
  const url = "https://example.com/xff";
  const headers = { "x-forwarded-for": "198.51.100.2, 10.0.0.1" };

  for (let i = 0; i < 3; i++) {
    const res = await rateLimitOr429(
      kv,
      new Request(url, { method: "POST", headers }),
      opts("xff-route"),
    );
    assert.equal(res, null);
  }

  const blocked = await rateLimitOr429(
    kv,
    new Request(url, { method: "POST", headers }),
    opts("xff-route"),
  );
  assert.equal(blocked?.status, 429);
});

test("rateLimitOr429: whitespace-only CF-Connecting-IP maps to unknown client bucket", async () => {
  const kv = createMemoryKV();
  const url = "https://example.com/ws-cf";
  const headers = { "cf-connecting-ip": "   \t" };

  for (let i = 0; i < 3; i++) {
    const res = await rateLimitOr429(
      kv,
      new Request(url, { method: "POST", headers }),
      opts("ws-cf"),
    );
    assert.equal(res, null);
  }
  const blocked = await rateLimitOr429(
    kv,
    new Request(url, { method: "POST", headers }),
    opts("ws-cf"),
  );
  assert.equal(blocked?.status, 429);
});

test("rateLimitOr429: x-forwarded-for with empty first hop maps to unknown", async () => {
  const kv = createMemoryKV();
  const url = "https://example.com/xff-empty-first";
  const headers = { "x-forwarded-for": ", 198.51.100.9" };

  for (let i = 0; i < 3; i++) {
    const res = await rateLimitOr429(
      kv,
      new Request(url, { method: "POST", headers }),
      opts("xff-empty"),
    );
    assert.equal(res, null);
  }
  const blocked = await rateLimitOr429(
    kv,
    new Request(url, { method: "POST", headers }),
    opts("xff-empty"),
  );
  assert.equal(blocked?.status, 429);
});

test("non-numeric count in KV is treated as 0", async () => {
  const kv = createMemoryKV();
  const windowSec = 60;
  const routeKey = "bad-count";
  const client = "203.0.113.7";
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const key = `ratelimit:v1:${routeKey}:${client}:${bucket}`;
  await kv.put(key, "not-a-number");

  const req = new Request("https://example.com/", {
    headers: { "cf-connecting-ip": client },
  });
  const res = await rateLimitOr429(kv, req, {
    routeKey,
    limit: 1,
    windowSec,
  });
  assert.equal(res, null);
});
