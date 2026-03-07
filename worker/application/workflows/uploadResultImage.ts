import type { MbtiEnv, PagesContext } from "../../_types.ts";

import {
  getImagesPrefix,
  normalizeAssetKey,
} from "../../domain/tests/assetKeys.ts";
import { upsertTestImageMetadataAndTouch } from "../../infrastructure/repositories/d1/testImageRepository.ts";
import {
  deleteAsset,
  putAsset,
} from "../../infrastructure/repositories/r2/assetRepository.ts";
import {
  readTestBody,
  writeTestBody,
} from "../../infrastructure/repositories/r2/testBodyRepository.ts";
import { invalidatePublicTestCaches } from "../cache/invalidateTestCaches.ts";

function mergeResultImageIntoTest(
  test: { results?: Record<string, unknown> },
  mbti: string,
  imagePath: string,
): Record<string, unknown> {
  const previousResults =
    test.results && typeof test.results === "object" ? test.results : {};
  const existing =
    previousResults[mbti] && typeof previousResults[mbti] === "object" ?
      (previousResults[mbti] as Record<string, unknown>)
    : {};
  const results = {
    ...previousResults,
    [mbti]: { ...existing, image: imagePath },
  };
  return { ...test, results };
}

type UploadResultImageInput = {
  testId: string;
  mbti: string;
  extension: string;
  contentType: string;
  buffer: ArrayBuffer;
};

/** I/O: upload result image, mutate test body, write metadata, and compensate on failure. */
export async function uploadResultImageWorkflow(
  context: PagesContext<MbtiEnv, { id?: string; mbti?: string }>,
  input: UploadResultImageInput,
): Promise<{ ok: true; mbti: string; path: string; url: string }> {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) throw new Error("R2 binding MBTI_BUCKET is missing.");
  const db = context.env.MBTI_DB;
  if (!db) throw new Error("D1 binding MBTI_DB is missing.");

  const key = normalizeAssetKey(
    `${getImagesPrefix(input.testId)}${input.mbti}.${input.extension}`,
  );
  const currentBody = await readTestBody(bucket, input.testId);
  if (!currentBody || typeof currentBody !== "object") {
    throw new Error("Test JSON not found while updating image.");
  }
  const updatedBody = mergeResultImageIntoTest(
    currentBody as { results?: Record<string, unknown> },
    input.mbti,
    key,
  );
  const bytes = new Uint8Array(input.buffer);
  let imageWritten = false;
  let bodyWritten = false;

  try {
    await putAsset(bucket, key, bytes, input.contentType);
    imageWritten = true;
    await writeTestBody(bucket, input.testId, updatedBody);
    bodyWritten = true;
    await upsertTestImageMetadataAndTouch(
      db,
      {
        testId: input.testId,
        imageKey: key,
        imageType: "result",
        imageName: input.mbti,
        contentType: input.contentType,
        sizeBytes: input.buffer.byteLength,
      },
      input.testId,
    );
  } catch (error) {
    if (bodyWritten) {
      try {
        await writeTestBody(bucket, input.testId, currentBody);
      } catch {
        // Best effort rollback for body writes.
      }
    }
    if (imageWritten) {
      try {
        await deleteAsset(bucket, key);
      } catch {
        // Best effort cleanup for asset writes.
      }
    }
    throw error;
  }

  invalidatePublicTestCaches(context, input.testId);
  return {
    ok: true,
    mbti: input.mbti,
    path: key,
    url: `/assets/${key.replace(/^assets\/?/i, "")}`,
  };
}
