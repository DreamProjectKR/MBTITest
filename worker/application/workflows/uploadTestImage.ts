import type { MbtiEnv, PagesContext } from "../../_types.ts";

import {
  getImagesPrefix,
  normalizeAssetKey,
} from "../../domain/tests/assetKeys.ts";
import { upsertTestImageMetadata } from "../../infrastructure/repositories/d1/testImageRepository.ts";
import {
  deleteAsset,
  putAsset,
} from "../../infrastructure/repositories/r2/assetRepository.ts";
import { invalidatePublicTestCaches } from "../cache/invalidateTestCaches.ts";

function inferImageType(baseName: string): string {
  const base = String(baseName || "")
    .trim()
    .toLowerCase();
  if (base === "thumbnail") return "thumbnail";
  if (base === "author") return "author";
  if (/^q\d{1,2}$/i.test(baseName)) return "question";
  if (/^[ei][ns][tf][jp]$/i.test(baseName)) return "result";
  return "misc";
}

type UploadTestImageInput = {
  testId: string;
  baseName: string;
  extension: string;
  contentType: string;
  buffer: ArrayBuffer;
};

/** I/O: upload generic test image, persist metadata, and cleanup on failure. */
export async function uploadTestImageWorkflow(
  context: PagesContext<MbtiEnv, { id?: string }>,
  input: UploadTestImageInput,
): Promise<{ ok: true; key: string; path: string; url: string }> {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) throw new Error("R2 binding MBTI_BUCKET is missing.");
  const db = context.env.MBTI_DB;
  if (!db) throw new Error("D1 binding MBTI_DB is missing.");

  const key = normalizeAssetKey(
    `${getImagesPrefix(input.testId)}${input.baseName}.${input.extension}`,
  );
  const bytes = new Uint8Array(input.buffer);

  try {
    await putAsset(bucket, key, bytes, input.contentType);
    await upsertTestImageMetadata(db, {
      testId: input.testId,
      imageKey: key,
      imageType: inferImageType(input.baseName),
      imageName: input.baseName,
      contentType: input.contentType,
      sizeBytes: input.buffer.byteLength,
    });
  } catch (error) {
    try {
      await deleteAsset(bucket, key);
    } catch {
      // Best effort cleanup for partial uploads.
    }
    throw error;
  }

  invalidatePublicTestCaches(context, input.testId);
  return {
    ok: true,
    key,
    path: key,
    url: `/assets/${key.replace(/^assets\/?/i, "")}`,
  };
}
