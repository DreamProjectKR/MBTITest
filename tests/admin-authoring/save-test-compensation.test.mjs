import assert from "node:assert/strict";
import test from "node:test";

import { saveTestWorkflow } from "../../worker/application/workflows/saveTest.ts";
import {
  createContext,
  installDefaultCacheStub,
} from "../shared/worker-harness.mjs";

installDefaultCacheStub();

function validPayload() {
  const questions = Array.from({ length: 12 }, (_, i) => ({
    id: `q${i + 1}`,
    label: `Q${i + 1}`,
    questionImage: `assets/c/img/Q${i + 1}.png`,
    answers: [
      { id: "a", label: "A", mbtiAxis: "EI", direction: "E" },
      { id: "b", label: "B", mbtiAxis: "EI", direction: "I" },
    ],
  }));
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
    ].map((c) => [c, { image: `assets/c/img/${c}.png`, summary: "s" }]),
  );
  return {
    title: "T",
    description: ["d"],
    author: "a",
    authorImg: "assets/c/img/author.png",
    thumbnail: "assets/c/img/thumbnail.png",
    tags: [],
    isPublished: true,
    path: "c/test.json",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    questions,
    results,
  };
}

test("saveTestWorkflow: D1 failure deletes new test body when no previous body", async () => {
  const store = new Map();
  const bucket = {
    async get(key) {
      return store.has(key) ?
          {
            async text() {
              return store.get(key);
            },
          }
        : null;
    },
    async put(key, value) {
      const text =
        value instanceof Uint8Array ? new TextDecoder().decode(value) : value;
      store.set(key, text);
    },
    async delete(key) {
      store.delete(key);
    },
  };
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          throw new Error("d1 upsert failed");
        },
      };
    },
  };
  await assert.rejects(
    () =>
      saveTestWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_BUCKET: bucket, MBTI_DB: db },
          params: { id: "newtest" },
        }),
        "newtest",
        validPayload(),
      ),
    /d1 upsert failed/,
  );
  assert.equal(store.size, 0);
});

test("saveTestWorkflow: D1 failure restores previous body when it existed", async () => {
  const prev = JSON.stringify({ questions: [], results: {} });
  const store = new Map([["assets/oldtest/test.json", prev]]);
  const bucket = {
    async get(key) {
      return store.has(key) ?
          {
            async text() {
              return store.get(key);
            },
          }
        : null;
    },
    async put(key, value) {
      const text =
        value instanceof Uint8Array ? new TextDecoder().decode(value) : value;
      store.set(key, text);
    },
    async delete(key) {
      store.delete(key);
    },
  };
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          throw new Error("d1 upsert failed");
        },
      };
    },
  };
  await assert.rejects(
    () =>
      saveTestWorkflow(
        createContext({
          url: "https://x",
          env: { MBTI_BUCKET: bucket, MBTI_DB: db },
          params: { id: "oldtest" },
        }),
        "oldtest",
        validPayload(),
      ),
    /d1 upsert failed/,
  );
  assert.deepEqual(
    JSON.parse(store.get("assets/oldtest/test.json")),
    JSON.parse(prev),
  );
});
