import type { D1Database, R2Bucket } from "../../../_types";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export const JSON_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": JSON_CONTENT_TYPE,
};

export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": JSON_CONTENT_TYPE,
  "Cache-Control": "no-store",
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

export async function readTest(
  bucket: R2Bucket,
  testId: string,
): Promise<unknown | null> {
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

export async function writeTest(
  bucket: R2Bucket,
  testId: string,
  test: unknown,
): Promise<void> {
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
  await db
    .prepare("UPDATE tests SET updated_at = ?1 WHERE test_id = ?2")
    .bind(now, testId)
    .all();
}

export type TestImageMetaInput = {
  testId: string;
  imageKey: string;
  imageType: string;
  imageName: string;
  contentType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
};

export type TestImageMetaRow = {
  id?: number;
  test_id?: string;
  image_key?: string;
  image_type?: string;
  image_name?: string;
  content_type?: string;
  size_bytes?: number;
  uploaded_at?: string;
};

export async function upsertTestImageMeta(
  db: D1Database,
  input: TestImageMetaInput,
): Promise<void> {
  const uploadedAt = input.uploadedAt || new Date().toISOString();
  await db
    .prepare(
      `
      INSERT INTO test_images (test_id, image_key, image_type, image_name, content_type, size_bytes, uploaded_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(test_id, image_name) DO UPDATE SET
        image_key = excluded.image_key,
        image_type = excluded.image_type,
        content_type = excluded.content_type,
        size_bytes = excluded.size_bytes,
        uploaded_at = excluded.uploaded_at
      `,
    )
    .bind(
      input.testId,
      input.imageKey,
      input.imageType,
      input.imageName,
      input.contentType || null,
      Number.isFinite(input.sizeBytes) ? Number(input.sizeBytes) : null,
      uploadedAt,
    )
    .all();
}

export async function listTestImageMeta(
  db: D1Database,
  testId: string,
): Promise<TestImageMetaRow[]> {
  const rows = await db
    .prepare(
      `
      SELECT id, test_id, image_key, image_type, image_name, content_type, size_bytes, uploaded_at
      FROM test_images
      WHERE test_id = ?1
      ORDER BY image_name ASC
      `,
    )
    .bind(testId)
    .all<TestImageMetaRow>();
  return Array.isArray(rows.results) ? rows.results : [];
}
