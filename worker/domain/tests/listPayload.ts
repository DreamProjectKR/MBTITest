import type { TestRow } from "./mergePayload.ts";

export type TestMeta = {
  id: string;
  title: string;
  thumbnail: string;
  tags: string[];
  path: string;
  createdAt: string;
  updatedAt: string;
  is_published: boolean;
};

/** Pure: parse tags_json string to string[]. */
export function safeJsonArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ?
        parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** Pure: map D1 row to public/admin list item shape. */
export function mapRowToTestMeta(row: TestRow): TestMeta {
  return {
    id: String(row?.test_id ?? ""),
    title: String(row?.title ?? ""),
    thumbnail: row?.thumbnail_path ? String(row.thumbnail_path) : "",
    tags: safeJsonArray(row?.tags_json),
    path: row?.source_path ? String(row.source_path) : "",
    createdAt: row?.created_at ? String(row.created_at) : "",
    updatedAt: row?.updated_at ? String(row.updated_at) : "",
    is_published: Boolean(row?.is_published),
  };
}

/** Pure: compute tests index ETag from mapped list items. */
export function computeTestsIndexEtag(tests: TestMeta[]): string {
  const maxUpdated = tests.reduce(
    (acc, test) => (test.updatedAt > acc ? test.updatedAt : acc),
    "",
  );
  return `"${tests.length}-${maxUpdated}"`;
}
