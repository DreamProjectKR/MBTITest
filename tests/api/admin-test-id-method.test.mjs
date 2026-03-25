import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPut as adminTestPut } from "../../worker/api/admin/tests/[id].ts";
import {
  createContext,
  createJsonBucket,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

test("admin test PUT: missing test id in params -> 400", async () => {
  const { bucket } = createJsonBucket();
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
      params: {},
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(String(j.error || ""), /missing test id/i);
});

test("admin test PUT: whitespace-only test id -> 400", async () => {
  const { bucket } = createJsonBucket();
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/%20%20%20",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
      params: { id: "   " },
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(String(j.error || ""), /missing test id/i);
});

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

test("admin test PUT: body must be an object", async () => {
  const { bucket } = createJsonBucket();
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/x",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
      params: { id: "x" },
      headers: { "content-type": "application/json" },
      body: JSON.stringify([]),
    }),
  );
  assert.equal(res.status, 400);
});

test("admin test PUT: JSON primitive body -> 400 must be object", async () => {
  const { bucket } = createJsonBucket();
  const bodies = ["42", "true", "false", "null", '"only-a-string"'];
  for (const body of bodies) {
    const res = await adminTestPut(
      createContext({
        url: "https://example.com/api/admin/tests/x",
        method: "PUT",
        env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
        params: { id: "x" },
        headers: { "content-type": "application/json" },
        body,
      }),
    );
    assert.equal(res.status, 400);
    const j = await res.json();
    assert.match(String(j.error || ""), /object/i);
  }
});

test("admin test PUT: payload id must match URL", async () => {
  const { bucket } = createJsonBucket();
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/x",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
      params: { id: "x" },
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "y", title: "T" }),
    }),
  );
  assert.equal(res.status, 400);
});

test("admin test PUT: validation error returns 400 with message", async () => {
  const { bucket } = createJsonBucket();
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/val-x",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: {} },
      params: { id: "val-x" },
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "T",
        thumbnail: "assets/val-x/thumb.png",
        authorImg: "assets/val-x/author.png",
        questions: [],
        results: {},
      }),
    }),
  );
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.match(String(j.error || ""), /12|question/i);
});

test("admin test PUT: R2 put throws Error -> 500 with error message", async () => {
  const bucket = {
    async get() {
      return null;
    },
    async put() {
      throw new Error("r2-write-failed");
    },
    async delete() {},
  };
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async run() {},
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/r2fail",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "r2fail" },
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "T",
        thumbnail: "assets/r2fail/images/t.png",
        authorImg: "assets/r2fail/images/a.png",
        questions: Array.from({ length: 12 }, (_, i) => ({
          label: `Q${i}`,
          questionImage: `assets/r2fail/images/q${i}.png`,
          answers: [
            { label: "A", mbtiAxis: "EI", direction: "E" },
            { label: "B", mbtiAxis: "EI", direction: "I" },
          ],
        })),
        results: Object.fromEntries(
          [
            "INTJ",
            "INTP",
            "ENTJ",
            "ENTP",
            "INFJ",
            "INFP",
            "ENFJ",
            "ENFP",
            "ISTJ",
            "ISTP",
            "ESTJ",
            "ESTP",
            "ISFJ",
            "ISFP",
            "ESFJ",
            "ESFP",
          ].map((c) => [
            c,
            { image: `assets/r2fail/r/${c}.png`, summary: "s" },
          ]),
        ),
      }),
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "r2-write-failed");
});

test("admin test PUT: save throws non-Error -> generic 500 message", async () => {
  const { bucket } = createJsonBucket({
    "assets/x/test.json": "{}",
  });
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          throw "not-an-error";
        },
      };
    },
  };
  const res = await adminTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/x",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "x" },
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "T",
        thumbnail: "assets/x/images/t.png",
        authorImg: "assets/x/images/a.png",
        questions: Array.from({ length: 12 }, (_, i) => ({
          label: `Q${i}`,
          questionImage: `assets/x/images/q${i}.png`,
          answers: [
            { label: "A", mbtiAxis: "EI", direction: "E" },
            { label: "B", mbtiAxis: "EI", direction: "I" },
          ],
        })),
        results: Object.fromEntries(
          [
            "INTJ",
            "INTP",
            "ENTJ",
            "ENTP",
            "INFJ",
            "INFP",
            "ENFJ",
            "ENFP",
            "ISTJ",
            "ISTP",
            "ESTJ",
            "ESTP",
            "ISFJ",
            "ISFP",
            "ESFJ",
            "ESFP",
          ].map((c) => [c, { image: `assets/x/r/${c}.png`, summary: "s" }]),
        ),
      }),
    }),
  );
  assert.equal(res.status, 500);
  const j = await res.json();
  assert.equal(j.error, "Failed to save test.");
});
