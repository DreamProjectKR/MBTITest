export type TestRow = {
  test_id?: unknown;
  title?: unknown;
  description_json?: unknown;
  author?: unknown;
  author_img_path?: unknown;
  thumbnail_path?: unknown;
  tags_json?: unknown;
  source_path?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  is_published?: unknown;
};

/** Pure: parse JSON string to array or null. */
export function parseJsonArray(value: unknown): unknown[] | null {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Pure: determine public visibility from D1 row. */
export function isPublishedRow(row: TestRow | null): boolean {
  return Boolean(row?.is_published);
}

/** Pure: build ETag from D1 row and R2 response. */
export function buildTestDetailEtag(
  row: TestRow | null,
  resolvedBodyEtag: string | null,
): string {
  const d1Updated = row?.updated_at ? String(row.updated_at) : "";
  const r2Etag = resolvedBodyEtag ? String(resolvedBodyEtag) : "";
  return `"${r2Etag}|${d1Updated}"`;
}

/** Pure: merge D1 row + parsed JSON body into API payload. */
export function mergeTestDetailPayload(
  row: TestRow,
  bodyJson: unknown,
): Record<string, unknown> {
  const description =
    parseJsonArray(row?.description_json)?.filter(Boolean) ?? null;
  const tags = (() => {
    const parsed = parseJsonArray(row?.tags_json);
    return parsed ?
        parsed.filter((x): x is string => typeof x === "string")
      : [];
  })();
  return {
    id: String(row.test_id ?? ""),
    title: row.title ? String(row.title) : "",
    description,
    author: row.author ? String(row.author) : "",
    authorImg: row.author_img_path ? String(row.author_img_path) : "",
    thumbnail: row.thumbnail_path ? String(row.thumbnail_path) : "",
    tags,
    path: row.source_path ? String(row.source_path) : "",
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
    isPublished: isPublishedRow(row),
    ...(bodyJson && typeof bodyJson === "object" ?
      (bodyJson as Record<string, unknown>)
    : {}),
  };
}
