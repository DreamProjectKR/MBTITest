import type { D1Database, R2Bucket } from "../../../_types";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const INDEX_KEY = "assets/index.json";

export const JSON_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": JSON_CONTENT_TYPE,
};

export function getTestKey(testId: string): string {
  return `assets/${testId}/test.json`;
}

export function getImagesPrefix(testId: string): string {
  return `assets/${testId}/images/`;
}

export function formatIndexDate(date: Date = new Date()): string {
  return new Date(date).toISOString().split("T")[0] ?? "";
}

type IndexPayload = { tests: unknown[] };

export async function readIndex(bucket: R2Bucket): Promise<IndexPayload> {
  const obj = await bucket.get(INDEX_KEY);
  if (!obj) return { tests: [] };
  const text = await obj.text();
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as IndexPayload;
    return { tests: [] };
  } catch {
    throw new Error("index.json is not valid JSON.");
  }
}

export async function writeIndex(bucket: R2Bucket, payload: unknown): Promise<void> {
  await bucket.put(
    INDEX_KEY,
    new TextEncoder().encode(JSON.stringify(payload, null, 2)),
    { httpMetadata: { contentType: JSON_CONTENT_TYPE } },
  );
}

export function buildIndexWithMeta(index: unknown, meta: unknown): unknown {
  const tests = Array.isArray((index as { tests?: unknown[] } | null)?.tests)
    ? [...((index as { tests: unknown[] }).tests)]
    : [];
  const m = meta as { id?: unknown };
  const existingIndex = tests.findIndex((entry) => (entry as { id?: unknown } | null)?.id === m?.id);
  if (existingIndex === -1) tests.push(meta);
  else tests[existingIndex] = meta;
  return { ...(index as object), tests };
}

export function createMetaFromTest(
  test: { id: string; title?: string; thumbnail?: string; tags?: unknown[] },
  existingMeta?: {
    title?: string;
    thumbnail?: string;
    tags?: unknown[];
    createdAt?: string;
  },
): {
  id: string;
  title: string;
  thumbnail: string;
  tags: string[];
  path: string;
  createdAt: string;
  updatedAt: string;
} {
  const now = formatIndexDate();
  const tags = Array.isArray(test.tags)
    ? test.tags.filter((t): t is string => typeof t === "string")
    : Array.isArray(existingMeta?.tags)
      ? existingMeta.tags.filter((t): t is string => typeof t === "string")
      : [];
  return {
    id: test.id,
    title: test.title || existingMeta?.title || "제목 없는 테스트",
    thumbnail: test.thumbnail || existingMeta?.thumbnail || "",
    tags,
    path: `${test.id}/test.json`,
    createdAt: existingMeta?.createdAt || now,
    updatedAt: now,
  };
}

export async function readTest(bucket: R2Bucket, testId: string): Promise<unknown | null> {
  const key = getTestKey(testId);
  const obj = await bucket.get(key);
  if (!obj) return null;
  const text = await obj.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Test JSON at ${key} is not valid JSON.`);
  }
}

export async function writeTest(bucket: R2Bucket, testId: string, test: unknown): Promise<void> {
  const key = getTestKey(testId);
  await bucket.put(
    key,
    new TextEncoder().encode(JSON.stringify(test, null, 2)),
    { httpMetadata: { contentType: JSON_CONTENT_TYPE } },
  );
}

export async function touchTestUpdatedAt(
  db: D1Database,
  testId: string,
  date: Date = new Date(),
): Promise<void> {
  const now = formatIndexDate(date);
  await db.prepare("UPDATE tests SET updated_at = ?1 WHERE test_id = ?2").bind(now, testId).all();
}


