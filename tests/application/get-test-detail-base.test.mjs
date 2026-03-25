import assert from "node:assert/strict";
import test from "node:test";

import { getTestDetailBaseQuery } from "../../worker/application/queries/getTestDetailBase.ts";

test("getTestDetailBaseQuery: not_found when no row", async () => {
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
  const r = await getTestDetailBaseQuery(
    db,
    {},
    "id",
    "https://x/",
    undefined,
    { enforcePublished: true },
  );
  assert.equal(r.kind, "not_found");
});

test("getTestDetailBaseQuery: forbidden_draft when unpublished", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return {
            test_id: "d",
            source_path: "d/test.json",
            is_published: 0,
          };
        },
      };
    },
  };
  const r = await getTestDetailBaseQuery(db, {}, "d", "https://x/", undefined, {
    enforcePublished: true,
  });
  assert.equal(r.kind, "forbidden_draft");
});

test("getTestDetailBaseQuery: invalid_path when key normalizes empty", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first() {
          return {
            test_id: "x",
            source_path: "   ",
            is_published: 1,
          };
        },
      };
    },
  };
  const r = await getTestDetailBaseQuery(db, {}, "x", "https://x/", undefined, {
    enforcePublished: true,
  });
  assert.equal(r.kind, "invalid_path");
});
