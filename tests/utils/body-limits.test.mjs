import assert from "node:assert/strict";
import test from "node:test";

import {
  getContentLength,
  MAX_COMPUTE_JSON_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  payloadTooLargeResponse,
} from "../../worker/api/_utils/bodyLimits.ts";

test("getContentLength returns null when header missing", () => {
  const req = new Request("https://example.com/", { method: "POST" });
  assert.equal(getContentLength(req), null);
});

test("getContentLength returns parsed number when valid", () => {
  const req = new Request("https://example.com/", {
    method: "POST",
    headers: { "content-length": "1024" },
  });
  assert.equal(getContentLength(req), 1024);
});

test("getContentLength returns null when invalid", () => {
  const req = new Request("https://example.com/", {
    method: "POST",
    headers: { "content-length": "not-a-number" },
  });
  assert.equal(getContentLength(req), null);
});

test("MAX_COMPUTE_JSON_BYTES and MAX_IMAGE_UPLOAD_BYTES are positive numbers", () => {
  assert.ok(Number.isFinite(MAX_COMPUTE_JSON_BYTES));
  assert.ok(MAX_COMPUTE_JSON_BYTES > 0);
  assert.ok(Number.isFinite(MAX_IMAGE_UPLOAD_BYTES));
  assert.ok(MAX_IMAGE_UPLOAD_BYTES > 0);
});

test("payloadTooLargeResponse returns 413 and JSON error", async () => {
  const res = payloadTooLargeResponse();
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.deepEqual(body, { error: "Payload too large." });
});
