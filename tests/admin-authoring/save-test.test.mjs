import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPut as saveTestPut } from "../../worker/api/admin/tests/[id].ts";
import {
  createContext,
  createJsonBucket,
  createSaveDb,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

function buildValidPayload(overrides = {}) {
  const questions = Array.from({ length: 12 }, (_, index) => {
    const no = index + 1;
    return {
      id: `q${no}`,
      label: `Question ${no}`,
      questionImage: `assets/test-valid/images/Q${no}.png`,
      answers: [
        {
          id: `q${no}_a`,
          label: "Answer A",
          mbtiAxis: "EI",
          direction: "E",
        },
        {
          id: `q${no}_b`,
          label: "Answer B",
          mbtiAxis: "EI",
          direction: "I",
        },
      ],
    };
  });

  const results = Object.fromEntries(
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
    ].map((code) => [
      code,
      {
        image: `assets/test-valid/images/${code}.png`,
        summary: `${code} summary`,
      },
    ]),
  );

  return {
    id: "test-valid",
    title: "Valid Test",
    description: ["one", "two"],
    author: "Dream",
    authorImg: "assets/test-valid/images/author.png",
    thumbnail: "assets/test-valid/images/thumbnail.png",
    tags: ["tag-a", "tag-b"],
    isPublished: true,
    path: "test-valid/test.json",
    createdAt: "2026-03-07",
    updatedAt: "2026-03-07",
    questions,
    results,
    ...overrides,
  };
}

test("PUT /api/admin/tests/:id returns 400 for invalid payload", async () => {
  installDefaultCacheStub();
  const { bucket } = createJsonBucket();
  const { db } = createSaveDb();
  const response = await saveTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/test-valid",
      method: "PUT",
      env: { MBTI_BUCKET: bucket, MBTI_DB: db },
      params: { id: "test-valid" },
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildValidPayload({ title: "" })),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /title/i);
});

test("PUT /api/admin/tests/:id persists publish transition and invalidates caches", async () => {
  const cacheCalls = installDefaultCacheStub();
  const { bucket, objects } = createJsonBucket();
  const { db, calls } = createSaveDb();
  const kvDeletes = [];
  const response = await saveTestPut(
    createContext({
      url: "https://example.com/api/admin/tests/test-valid",
      method: "PUT",
      env: {
        MBTI_BUCKET: bucket,
        MBTI_DB: db,
        MBTI_KV: {
          async get() {
            return null;
          },
          async put() {},
          async delete(key) {
            kvDeletes.push(key);
          },
        },
      },
      params: { id: "test-valid" },
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildValidPayload({ isPublished: true })),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(objects.has("assets/test-valid/test.json"));
  assert.deepEqual(kvDeletes, ["test:test-valid"]);
  assert.equal(cacheCalls.delete.length, 2);
  const bindCall = calls.find((call) => call.type === "bind");
  assert.equal(bindCall.args[0], "test-valid");
  assert.equal(bindCall.args[9], 1);
});
