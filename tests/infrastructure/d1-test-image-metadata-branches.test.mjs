import assert from "node:assert/strict";
import test from "node:test";

import {
  listTestImageMetadata,
  upsertTestImageMetadata,
} from "../../worker/infrastructure/repositories/d1/testImageRepository.ts";

test("upsertTestImageMetadata binds null sizeBytes when non-finite", async () => {
  const binds = [];
  const db = {
    prepare() {
      return {
        bind(...args) {
          binds.push(args);
          return {
            async all() {
              return { success: true };
            },
          };
        },
      };
    },
  };

  await upsertTestImageMetadata(db, {
    testId: "t",
    imageKey: "k",
    imageType: "misc",
    imageName: "n",
    contentType: "image/png",
    sizeBytes: Number.NaN,
  });

  assert.equal(binds[0][5], null);
});

test("listTestImageMetadata returns empty array when results is not an array", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return {
            async all() {
              return { results: null };
            },
          };
        },
      };
    },
  };

  const rows = await listTestImageMetadata(db, "tid");
  assert.deepEqual(rows, []);
});
