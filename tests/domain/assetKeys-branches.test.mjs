import assert from "node:assert/strict";
import test from "node:test";

import {
  formatIndexDate,
  getImagesPrefix,
  getTestKey,
  normalizeAssetKey,
  normalizeAssetPath,
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

test("normalizeR2KeyFromIndexPath keeps leading assets/ prefix", () => {
  assert.equal(
    normalizeR2KeyFromIndexPath("assets/foo/bar.json"),
    "assets/foo/bar.json",
  );
});

test("normalizeR2KeyFromIndexPath empty string returns empty", () => {
  assert.equal(normalizeR2KeyFromIndexPath(""), "");
});

test("normalizeR2KeyFromIndexPath whitespace-only returns empty", () => {
  assert.equal(normalizeR2KeyFromIndexPath("   "), "");
});

test("normalizeR2KeyFromIndexPath strips leading slash before assets check", () => {
  assert.equal(
    normalizeR2KeyFromIndexPath("/assets/pkg/file.json"),
    "assets/pkg/file.json",
  );
});

test("normalizeAssetPath delegates to normalizeAssetKey", () => {
  assert.equal(normalizeAssetPath("  /assets/x/y  "), "assets/x/y");
});

test("normalizeAssetKey strips path-only segments of dots", () => {
  assert.equal(normalizeAssetKey("assets/../.."), "");
});

test("formatIndexDate with explicit date is deterministic", () => {
  assert.equal(
    formatIndexDate(new Date("2024-06-01T00:00:00.000Z")),
    "2024-06-01",
  );
});

test("formatIndexDate without args returns YYYY-MM-DD", () => {
  assert.match(formatIndexDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test("normalizeAssetKey handles leading ./ before assets", () => {
  assert.equal(
    normalizeAssetKey("./assets/pkg/file.png"),
    "assets/pkg/file.png",
  );
});

test("getTestKey with only unsafe id still yields assets test.json key", () => {
  assert.equal(getTestKey("@@@"), "assets/test.json");
});

test("normalizeR2KeyFromIndexPath: bare assets token gets prefixed", () => {
  assert.equal(normalizeR2KeyFromIndexPath("assets"), "assets/assets");
});

test("normalizeAssetKey: lone assets token becomes canonical doubled segment", () => {
  assert.equal(normalizeAssetKey("assets"), "assets/assets");
});

test("getImagesPrefix with hyphenated sanitized id", () => {
  assert.match(getImagesPrefix("a-b_1"), /^assets\/a-b_1\/images\/$/);
});

test("getImagesPrefix when sanitized id is empty uses assets/images prefix", () => {
  assert.equal(getImagesPrefix("@@@"), "assets/images/");
});

test("normalizeAssetPath stringifies non-string primitives", () => {
  assert.equal(normalizeAssetPath(null), "");
  assert.equal(normalizeAssetPath(undefined), "");
  assert.ok(normalizeAssetPath(123).includes("123"));
});

test("normalizeAssetKey collapses duplicate slashes in path segments", () => {
  assert.equal(
    normalizeAssetKey("assets/foo//bar/baz.png"),
    "assets/foo/bar/baz.png",
  );
});
