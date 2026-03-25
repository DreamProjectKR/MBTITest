import assert from "node:assert/strict";
import test from "node:test";

import { listTestMetadata } from "../../worker/infrastructure/repositories/d1/testMetadataRepository.ts";

test("listTestMetadata: non-array results becomes empty list", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async all() {
          return { results: "not-array" };
        },
      };
    },
  };
  const published = await listTestMetadata(db, { publishedOnly: true });
  assert.deepEqual(published, []);
});
