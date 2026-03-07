import type { D1Database, R2Bucket } from "../../../_types.ts";

import {
  formatIndexDate,
  getImagesPrefix,
  getTestKey,
  normalizeAssetKey,
} from "../../../domain/tests/assetKeys.ts";
import {
  type TestImageMetaInput,
  type TestImageMetaRow,
  listTestImageMetadata,
  upsertTestImageMetadata,
  upsertTestImageMetadataAndTouch,
} from "../../../infrastructure/repositories/d1/testImageRepository.ts";
import { touchTestUpdatedAt as touchTestMetadataUpdatedAt } from "../../../infrastructure/repositories/d1/testMetadataRepository.ts";
import {
  readTestBody,
  writeTestBody,
} from "../../../infrastructure/repositories/r2/testBodyRepository.ts";
import { JSON_HEADERS, NO_STORE_HEADERS } from "../../_utils/http.ts";

export { JSON_HEADERS, NO_STORE_HEADERS };
export { formatIndexDate, getImagesPrefix, getTestKey, normalizeAssetKey };
export type { TestImageMetaInput, TestImageMetaRow };

/** I/O: read test JSON from R2. */
export async function readTest(
  bucket: R2Bucket,
  testId: string,
): Promise<unknown | null> {
  return readTestBody(bucket, testId);
}

/** I/O: write test JSON to R2. */
export async function writeTest(
  bucket: R2Bucket,
  testId: string,
  test: unknown,
): Promise<void> {
  return writeTestBody(bucket, testId, test);
}

/** I/O: update tests.updated_at in D1. */
export async function touchTestUpdatedAt(
  db: D1Database,
  testId: string,
  date: Date = new Date(),
): Promise<void> {
  return touchTestMetadataUpdatedAt(db, testId, date);
}

export async function upsertTestImageMeta(
  db: D1Database,
  input: TestImageMetaInput,
): Promise<void> {
  return upsertTestImageMetadata(db, input);
}

export async function upsertTestImageMetaAndTouchBatch(
  db: D1Database,
  input: TestImageMetaInput,
  testId: string,
): Promise<void> {
  return upsertTestImageMetadataAndTouch(db, input, testId);
}

export async function listTestImageMeta(
  db: D1Database,
  testId: string,
): Promise<TestImageMetaRow[]> {
  return listTestImageMetadata(db, testId);
}
