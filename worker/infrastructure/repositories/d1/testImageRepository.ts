import type { D1Database } from "../../../_types.ts";

import { formatIndexDate } from "../../../domain/tests/assetKeys.ts";

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

const UPSERT_TEST_IMAGE_SQL = `
  INSERT INTO test_images (test_id, image_key, image_type, image_name, content_type, size_bytes, uploaded_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  ON CONFLICT(test_id, image_name) DO UPDATE SET
    image_key = excluded.image_key,
    image_type = excluded.image_type,
    content_type = excluded.content_type,
    size_bytes = excluded.size_bytes,
    uploaded_at = excluded.uploaded_at
`;

export async function upsertTestImageMetadata(
  db: D1Database,
  input: TestImageMetaInput,
): Promise<void> {
  const uploadedAt = input.uploadedAt || new Date().toISOString();
  await db
    .prepare(UPSERT_TEST_IMAGE_SQL)
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

export async function upsertTestImageMetadataAndTouch(
  db: D1Database,
  input: TestImageMetaInput,
  testId: string,
): Promise<void> {
  const uploadedAt = input.uploadedAt || new Date().toISOString();
  const now = formatIndexDate();
  const upsert = db
    .prepare(UPSERT_TEST_IMAGE_SQL)
    .bind(
      input.testId,
      input.imageKey,
      input.imageType,
      input.imageName,
      input.contentType || null,
      Number.isFinite(input.sizeBytes) ? Number(input.sizeBytes) : null,
      uploadedAt,
    );
  const touch = db
    .prepare("UPDATE tests SET updated_at = ?1 WHERE test_id = ?2")
    .bind(now, testId);
  await db.batch([upsert, touch]);
}

export async function listTestImageMetadata(
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
