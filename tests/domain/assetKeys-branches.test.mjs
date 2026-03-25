import assert from "node:assert/strict";
import test from "node:test";

import {
  formatIndexDate,
  getImagesPrefix,
  getTestKey,
  normalizeAssetKey,
  normalizeR2KeyFromIndexPath,
} from "../../worker/domain/tests/assetKeys.ts";

test("normalizeAssetKey returns empty for empty or all-dot segments", () => {
  assert.equal(normalizeAssetKey(""), "");
  assert.equal(normalizeAssetKey("   "), "");
});

test("getTestKey strips unsafe characters from test id", () => {
  assert.ok(getTestKey("a!b").includes("ab"));
});

test("getImagesPrefix builds prefix for sanitized id", () => {
  assert.match(getImagesPrefix("tid"), /assets\/tid\/images\//);
});

test("normalizeR2KeyFromIndexPath adds assets prefix when missing", () => {
  assert.equal(
    normalizeR2KeyFromIndexPath("foo/bar.json"),
    "assets/foo/bar.json",
  );
});

test("formatIndexDate with explicit date is deterministic", () => {
  assert.equal(
    formatIndexDate(new Date("2024-06-01T00:00:00.000Z")),
    "2024-06-01",
  );
});
