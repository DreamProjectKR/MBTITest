/** Pure: keep only key-safe path segment characters. */
function sanitizePathSegment(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Pure: normalize path to `assets/...` canonical format. */
export function normalizeAssetKey(path: string): string {
  const raw = String(path || "").trim();
  const withoutLeading = raw.replace(/^\.?\/+/, "").replace(/^assets\/+/i, "");
  const segments = withoutLeading
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== "." && segment !== "..");
  return segments.length ? `assets/${segments.join("/")}` : "";
}

/** Pure: canonical stored asset path from unknown input. */
export function normalizeAssetPath(value: unknown): string {
  return normalizeAssetKey(String(value || ""));
}

/** Pure: R2 key for test JSON body. */
export function getTestKey(testId: string): string {
  const safeId = sanitizePathSegment(testId);
  return normalizeAssetKey(`${safeId}/test.json`);
}

/** Pure: R2 key prefix for test images. */
export function getImagesPrefix(testId: string): string {
  const safeId = sanitizePathSegment(testId);
  return `${normalizeAssetKey(`${safeId}/images`)}/`;
}

/** Pure: normalize source_path from D1 to canonical R2 key. */
export function normalizeR2KeyFromIndexPath(rawPath: string): string {
  const str = String(rawPath || "").trim();
  if (!str) return "";
  const clean = str.replace(/^\.?\/+/, "");
  return clean.startsWith("assets/") ? clean : `assets/${clean}`;
}

/**
 * YYYY-MM-DD from Date. Pure when given a date; when called with no args uses
 * current time (impure, but required for D1 updated_at).
 */
export function formatIndexDate(date: Date = new Date()): string {
  return new Date(date).toISOString().split("T")[0] ?? "";
}
