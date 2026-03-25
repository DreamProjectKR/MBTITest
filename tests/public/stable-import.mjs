import { basename } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Stable `v` query per test file so Node/V8 test coverage aggregates on one
 * module URL per file (random `?v=` splits the same source into many buckets).
 *
 * @param {string} importMetaUrl
 */
export function stableImportV(importMetaUrl) {
  return basename(fileURLToPath(importMetaUrl));
}

/**
 * @param {string} relativePath
 * @param {string} importMetaUrl
 */
export function scriptHrefWithStableV(relativePath, importMetaUrl) {
  const u = new URL(relativePath, importMetaUrl);
  u.searchParams.set("v", stableImportV(importMetaUrl));
  return u.href;
}
