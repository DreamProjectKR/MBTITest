import type { MbtiEnv, PagesContext } from "../../_types.ts";

import {
  formatIndexDate,
  normalizeAssetKey,
  normalizeAssetPath,
} from "../../domain/tests/assetKeys.ts";
import {
  normalizeQuestions,
  normalizeResults,
  validateTestPayload,
} from "../../domain/tests/validation.ts";
import { upsertTestMetadata } from "../../infrastructure/repositories/d1/testMetadataRepository.ts";
import {
  deleteTestBody,
  readTestBody,
  writeTestBody,
} from "../../infrastructure/repositories/r2/testBodyRepository.ts";
import { invalidatePublicTestCaches } from "../cache/invalidateTestCaches.ts";

type SaveTestPayload = {
  title?: unknown;
  description?: unknown;
  author?: unknown;
  authorImg?: unknown;
  thumbnail?: unknown;
  tags?: unknown;
  isPublished?: unknown;
  path?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  questions?: unknown;
  results?: unknown;
};

export class SaveTestValidationError extends Error {}

/** I/O: validate, persist, and invalidate caches for admin test save. */
export async function saveTestWorkflow(
  context: PagesContext<MbtiEnv, { id?: string }>,
  testId: string,
  payload: SaveTestPayload,
): Promise<{ ok: true }> {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) throw new Error("R2 binding MBTI_BUCKET is missing.");
  const db = context.env.MBTI_DB;
  if (!db) throw new Error("D1 binding MBTI_DB is missing.");

  const title = String(payload.title ?? "");
  const thumbnail = normalizeAssetPath(payload.thumbnail);
  const authorImg = normalizeAssetPath(payload.authorImg);
  const isPublished = Boolean(payload.isPublished) ? 1 : 0;
  const questions = normalizeQuestions(payload.questions);
  const results = normalizeResults(payload.results);

  const validationError = validateTestPayload({
    id: testId,
    title,
    thumbnail,
    authorImg,
    questions,
    results,
  });
  if (validationError) {
    throw new SaveTestValidationError(validationError);
  }

  const previousBody = await readTestBody(bucket, testId);
  const slimBody = { questions, results };
  await writeTestBody(bucket, testId, slimBody);

  try {
    const now = formatIndexDate();
    const nowTs = new Date().toISOString();
    await upsertTestMetadata(db, {
      testId,
      title,
      descriptionJson: JSON.stringify(payload.description ?? null),
      author: String(payload.author ?? ""),
      authorImg,
      thumbnail,
      sourcePath: normalizeAssetKey(
        String(payload.path ?? `${testId}/test.json`),
      ),
      tagsJson: JSON.stringify(Array.isArray(payload.tags) ? payload.tags : []),
      questionCount: questions.length,
      isPublished,
      createdAt: String(payload.createdAt ?? now),
      updatedAt: String(payload.updatedAt ?? now),
      createdTs: nowTs,
      updatedTs: nowTs,
    });
  } catch (error) {
    if (previousBody == null) {
      await deleteTestBody(bucket, testId);
    } else {
      await writeTestBody(bucket, testId, previousBody);
    }
    throw error;
  }

  invalidatePublicTestCaches(context, testId);
  return { ok: true };
}
