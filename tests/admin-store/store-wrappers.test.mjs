import assert from "node:assert/strict";
import test from "node:test";

import {
  listTestImageMeta,
  readTest,
  touchTestUpdatedAt,
  upsertTestImageMeta,
  upsertTestImageMetaAndTouchBatch,
  writeTest,
} from "../../worker/api/admin/utils/store.ts";

test("store.readTest delegates to R2", async () => {
  const bucket = {
    async get() {
      return {
        async text() {
          return '{"z":1}';
        },
      };
    },
  };
  const v = await readTest(bucket, "tid");
  assert.deepEqual(v, { z: 1 });
});

test("store.writeTest writes JSON", async () => {
  const puts = [];
  const bucket = {
    async put(key, value, opts) {
      puts.push({ key, opts });
    },
  };
  await writeTest(bucket, "tid", { a: 2 });
  assert.ok(puts[0].key.includes("tid"));
});

test("store.touchTestUpdatedAt delegates", async () => {
  let called = false;
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          called = true;
        },
      };
    },
  };
  await touchTestUpdatedAt(db, "x", new Date("2026-01-01"));
  assert.equal(called, true);
});

test("store.upsertTestImageMeta delegates", async () => {
  let called = false;
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          called = true;
        },
      };
    },
  };
  await upsertTestImageMeta(db, {
    testId: "t",
    imageKey: "k",
    imageType: "q",
    imageName: "Q1",
  });
  assert.equal(called, true);
});

test("store.upsertTestImageMetaAndTouchBatch uses batch", async () => {
  const batches = [];
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
      };
    },
    async batch(stmts) {
      batches.push(stmts.length);
      return [];
    },
  };
  await upsertTestImageMetaAndTouchBatch(
    db,
    {
      testId: "t",
      imageKey: "k",
      imageType: "misc",
      imageName: "n",
    },
    "t",
  );
  assert.equal(batches[0], 2);
});

test("store.listTestImageMeta delegates", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          return { results: [{ image_key: "assets/t/i.png" }] };
        },
      };
    },
  };
  const rows = await listTestImageMeta(db, "t");
  assert.equal(rows.length, 1);
});
