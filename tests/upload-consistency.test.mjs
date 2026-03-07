import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPut as testImagePut } from "../worker/api/admin/tests/[id]/images.ts";
import { onRequestPut as resultImagePut } from "../worker/api/admin/tests/[id]/results/[mbti]/image.ts";

function createContext(url, env, params = {}) {
  return {
    request: new Request(url, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: new Uint8Array([1, 2, 3, 4]),
    }),
    env,
    params,
    waitUntil() {},
  };
}

test("result image upload validates test.json before writing image", async () => {
  const bucketCalls = [];
  const batchCalls = [];
  const env = {
    MBTI_BUCKET: {
      async get() {
        return null;
      },
      async list() {
        return { objects: [] };
      },
      async put(key) {
        bucketCalls.push({ type: "put", key });
      },
      async delete(key) {
        bucketCalls.push({ type: "delete", key });
      },
    },
    MBTI_DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            return null;
          },
          async all() {
            return { results: [] };
          },
        };
      },
      async batch(statements) {
        batchCalls.push(statements);
        return [];
      },
    },
  };

  const response = await resultImagePut(
    createContext(
      "https://example.com/api/admin/tests/draft-test/results/ENFP/image",
      env,
      { id: "draft-test", mbti: "ENFP" },
    ),
  );
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.match(body.error, /Test JSON not found/);
  assert.deepEqual(bucketCalls, []);
  assert.equal(batchCalls.length, 0);
});

test("result image upload restores original test.json when metadata write fails", async () => {
  const originalTest = {
    questions: [],
    results: {
      ENFP: {
        image: "assets/draft-test/images/ENFP-old.png",
        summary: "old summary",
      },
    },
  };
  const putCalls = [];
  const deleteCalls = [];
  const textDecoder = new TextDecoder();
  const env = {
    MBTI_BUCKET: {
      async get(key) {
        if (key === "assets/draft-test/test.json") {
          return {
            body: {},
            async text() {
              return JSON.stringify(originalTest);
            },
          };
        }
        return null;
      },
      async list() {
        return { objects: [] };
      },
      async put(key, value) {
        putCalls.push({ key, value: textDecoder.decode(value) });
      },
      async delete(key) {
        deleteCalls.push(key);
      },
    },
    MBTI_DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            return null;
          },
          async all() {
            return { results: [] };
          },
        };
      },
      async batch() {
        throw new Error("metadata failed");
      },
    },
  };

  const response = await resultImagePut(
    createContext(
      "https://example.com/api/admin/tests/draft-test/results/ENFP/image",
      env,
      { id: "draft-test", mbti: "ENFP" },
    ),
  );
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.match(body.error, /metadata failed/);
  assert.deepEqual(
    putCalls.map((call) => call.key),
    [
      "assets/draft-test/images/ENFP.png",
      "assets/draft-test/test.json",
      "assets/draft-test/test.json",
    ],
  );
  assert.deepEqual(deleteCalls, ["assets/draft-test/images/ENFP.png"]);
  assert.deepEqual(JSON.parse(putCalls.at(-1).value), originalTest);
});

test("generic image upload deletes the object on metadata failure", async () => {
  const putCalls = [];
  const deleteCalls = [];
  const env = {
    MBTI_BUCKET: {
      async get() {
        return null;
      },
      async list() {
        return { objects: [] };
      },
      async put(key) {
        putCalls.push(key);
      },
      async delete(key) {
        deleteCalls.push(key);
      },
    },
    MBTI_DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            return null;
          },
          async all() {
            throw new Error("image meta failed");
          },
        };
      },
      async batch() {
        return [];
      },
    },
  };

  const response = await testImagePut(
    createContext(
      "https://example.com/api/admin/tests/draft-test/images",
      env,
      {
        id: "draft-test",
      },
    ),
  );
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.match(body.error, /image meta failed/);
  assert.equal(putCalls.length, 1);
  assert.equal(deleteCalls.length, 1);
  assert.equal(deleteCalls[0], putCalls[0]);
});
