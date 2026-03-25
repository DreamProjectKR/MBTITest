import assert from "node:assert/strict";
import test from "node:test";

import {
  testExists,
  touchTestUpdatedAt,
  upsertTestMetadata,
} from "../../worker/infrastructure/repositories/d1/testMetadataRepository.ts";

test("testExists false when no row", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return null;
        },
      };
    },
  };
  assert.equal(await testExists(db, "nope"), false);
});

test("testExists true when row", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return { test_id: "x" };
        },
      };
    },
  };
  assert.equal(await testExists(db, "x"), true);
});

test("touchTestUpdatedAt runs UPDATE", async () => {
  const binds = [];
  const db = {
    prepare(q) {
      return {
        bind(...args) {
          binds.push({ q, args });
          return this;
        },
        async all() {},
      };
    },
  };
  await touchTestUpdatedAt(db, "tid", new Date("2026-06-15T12:00:00Z"));
  assert.equal(binds.length, 1);
  assert.match(binds[0].q, /UPDATE tests SET updated_at/);
  assert.equal(binds[0].args[1], "tid");
});

test("upsertTestMetadata binds all fields", async () => {
  const binds = [];
  const db = {
    prepare() {
      return {
        bind(...args) {
          binds.push(args);
          return this;
        },
        async all() {},
      };
    },
  };
  await upsertTestMetadata(db, {
    testId: "a",
    title: "T",
    descriptionJson: "[]",
    author: "au",
    authorImg: "ai",
    thumbnail: "th",
    sourcePath: "a/test.json",
    tagsJson: "[]",
    questionCount: 12,
    isPublished: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02",
    createdTs: "1700000000",
    updatedTs: "1700000001",
  });
  assert.equal(binds[0][0], "a");
  assert.equal(binds[0].length, 14);
});
