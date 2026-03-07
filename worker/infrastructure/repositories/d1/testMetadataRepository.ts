import type { D1Database } from "../../../_types.ts";
import type { TestRow } from "../../../domain/tests/mergePayload.ts";

import { formatIndexDate } from "../../../domain/tests/assetKeys.ts";

export type UpsertTestMetadataInput = {
  testId: string;
  title: string;
  descriptionJson: string;
  author: string;
  authorImg: string;
  thumbnail: string;
  sourcePath: string;
  tagsJson: string;
  questionCount: number;
  isPublished: number;
  createdAt: string;
  updatedAt: string;
  createdTs: string;
  updatedTs: string;
};

export async function listTestMetadata(
  db: D1Database,
  options: { publishedOnly: boolean },
): Promise<TestRow[]> {
  const query =
    options.publishedOnly ?
      "SELECT test_id, title, thumbnail_path, tags_json, source_path, created_at, updated_at, is_published FROM tests WHERE is_published = 1 ORDER BY updated_at DESC, test_id ASC"
    : "SELECT test_id, title, thumbnail_path, tags_json, source_path, created_at, updated_at, is_published FROM tests ORDER BY updated_at DESC, test_id ASC";
  const rows = await db.prepare(query).all<TestRow>();
  return Array.isArray(rows.results) ? rows.results : [];
}

export async function getTestMetadataById(
  db: D1Database,
  testId: string,
): Promise<TestRow | null> {
  return db
    .prepare(
      "SELECT test_id, title, description_json, author, author_img_path, thumbnail_path, tags_json, source_path, created_at, updated_at, is_published FROM tests WHERE test_id = ?1 LIMIT 1",
    )
    .bind(testId)
    .first<TestRow>();
}

export async function testExists(
  db: D1Database,
  testId: string,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT test_id FROM tests WHERE test_id = ?1 LIMIT 1")
    .bind(testId)
    .first<{ test_id?: unknown }>();
  return Boolean(row?.test_id);
}

export async function upsertTestMetadata(
  db: D1Database,
  input: UpsertTestMetadataInput,
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO tests (test_id, title, description_json, author, author_img_path, thumbnail_path, source_path, tags_json, question_count, is_published, created_at, updated_at, created_ts, updated_ts)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
      ON CONFLICT(test_id) DO UPDATE SET
        title = excluded.title,
        description_json = excluded.description_json,
        author = excluded.author,
        author_img_path = excluded.author_img_path,
        thumbnail_path = excluded.thumbnail_path,
        source_path = excluded.source_path,
        tags_json = excluded.tags_json,
        question_count = excluded.question_count,
        is_published = excluded.is_published,
        created_at = COALESCE(tests.created_at, excluded.created_at),
        updated_at = excluded.updated_at,
        created_ts = COALESCE(tests.created_ts, excluded.created_ts),
        updated_ts = excluded.updated_ts
      `,
    )
    .bind(
      input.testId,
      input.title,
      input.descriptionJson,
      input.author,
      input.authorImg,
      input.thumbnail,
      input.sourcePath,
      input.tagsJson,
      input.questionCount,
      input.isPublished,
      input.createdAt,
      input.updatedAt,
      input.createdTs,
      input.updatedTs,
    )
    .all();
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
