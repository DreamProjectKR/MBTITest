import assert from "node:assert/strict";
import test from "node:test";

import { getTieredCacheCf } from "../../worker/router.ts";

test("getTieredCacheCf assets with empty path segment uses assets tag only", () => {
  const cf = getTieredCacheCf("assets", { path: "" });
  assert.ok(cf);
  assert.deepEqual(cf.cacheTags, ["assets"]);
});

test("getTieredCacheCf unknown route returns null", () => {
  assert.equal(getTieredCacheCf("nope", {}), null);
});
