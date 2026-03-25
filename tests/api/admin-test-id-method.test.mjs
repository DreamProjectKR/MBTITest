import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPut as adminTestPut } from "../../worker/api/admin/tests/[id].ts";
import {
  createContext,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("admin test PUT: POST method -> 405", async () => {
  const { bucket } = createJsonBucket();
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/x",
      method: "POST",
      env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
      params: { id: "x" },
      body: "{}",
    }),
  );
  assert.equal(res.status, 405);
});

test("admin test PUT: missing MBTI_BUCKET -> 500", async () => {
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/x",
      method: "PUT",
      env: { MBTI_DB: {} },
      params: { id: "x" },
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.match(j.error, /MBTI_BUCKET/);
});

test("admin test PUT: missing MBTI_DB -> 500", async () => {
  const { bucket } = createJsonBucket();
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/x",
      method: "PUT",
      env: { MBTI_BUCKET: bucket },
      params: { id: "x" },
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.match(j.error, /MBTI_DB/);
});

test("admin test PUT: invalid JSON body -> 400", async () => {
  const { bucket } = createJsonBucket();
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/x",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
      params: { id: "x" },
      headers: { "content-type": "application/json" },
      body: "not-json",
    }),
  );
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(j.error, /valid JSON/i);
});
