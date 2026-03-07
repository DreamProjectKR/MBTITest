import type { MbtiEnv, PagesContext } from "../../../../../_types";

import {
  getDefaultCache,
  noStoreJsonResponse,
} from "../../../../../_utils/http";
import {
  getImagesPrefix,
  normalizeAssetKey,
  readTest,
  upsertTestImageMetaAndTouchBatch,
  writeTest,
} from "../../../../utils/store";

type Params = { id?: string; mbti?: string };

const MBTI_ORDER = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISTP",
  "ESTJ",
  "ESTP",
  "ISFJ",
  "ISFP",
  "ESFJ",
  "ESFP",
] as const;

function methodNotAllowed(): Response {
  return noStoreJsonResponse({ error: "Method not allowed." }, 405);
}

function badRequest(message: string): Response {
  return noStoreJsonResponse({ error: message }, 400);
}

async function rollbackUploadedObject(
  bucket: MbtiEnv["MBTI_BUCKET"],
  key: string,
): Promise<void> {
  if (!bucket || !key) return;
  try {
    await bucket.delete(key);
  } catch {
    // Best effort cleanup for partial uploads.
  }
}

/** Pure: map MIME type to file extension. */
function extensionFromMime(mimeType = ""): string {
  const type = String(mimeType || "").toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "png";
}

/** Pure: return new test object with results[mbti].image set (immutable). */
function mergeResultImageIntoTest(
  test: { results?: Record<string, unknown> },
  mbti: string,
  imagePath: string,
): Record<string, unknown> {
  const prev =
    test.results && typeof test.results === "object" ? test.results : {};
  const existing =
    prev[mbti] && typeof prev[mbti] === "object" ?
      (prev[mbti] as Record<string, unknown>)
    : {};
  const results = { ...prev, [mbti]: { ...existing, image: imagePath } };
  return { ...test, results };
}

/** I/O: parse multipart or body into buffer + contentType. */
async function extractUpload(
  context: PagesContext<MbtiEnv, Params>,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const contentType = context.request.headers.get("content-type") || "";
  const isMultipart = contentType
    .toLowerCase()
    .startsWith("multipart/form-data");
  if (isMultipart) {
    const formData = await context.request.formData();
    const file = formData.get("file");
    if (!file || typeof (file as File).arrayBuffer !== "function") return null;
    const buffer = await (file as File).arrayBuffer();
    return { buffer, contentType: (file as File).type || contentType };
  }

  const buffer = await context.request.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return null;
  return { buffer, contentType: contentType || "image/png" };
}

export async function onRequestPut(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return noStoreJsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      500,
    );
  const db = context.env.MBTI_DB;
  if (!db)
    return noStoreJsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      500,
    );

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return badRequest("Missing test id.");

  const mbtiRaw =
    context.params?.mbti ?
      String(context.params.mbti).trim().toUpperCase()
    : "";
  if (
    !mbtiRaw ||
    !MBTI_ORDER.includes(mbtiRaw as (typeof MBTI_ORDER)[number])
  ) {
    return badRequest("Invalid MBTI code.");
  }

  let upload: { buffer: ArrayBuffer; contentType: string } | null = null;
  try {
    upload = await extractUpload(context);
  } catch {
    return badRequest("Unable to parse uploaded file.");
  }
  if (!upload) return badRequest("File upload required.");

  const bytes = new Uint8Array(upload.buffer);
  const extension = extensionFromMime(upload.contentType);
  const fileName = `${mbtiRaw}.${extension}`;
  const key = normalizeAssetKey(`${getImagesPrefix(testId)}${fileName}`);
  const testJson = await readTest(bucket, testId);
  if (!testJson || typeof testJson !== "object") {
    return noStoreJsonResponse(
      { error: "Test JSON not found while updating image." },
      404,
    );
  }

  const updated = mergeResultImageIntoTest(
    testJson as { results?: Record<string, unknown> },
    mbtiRaw,
    key,
  );
  let wroteImage = false;
  let wroteTestJson = false;

  try {
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: upload.contentType },
    });
    wroteImage = true;
    await writeTest(bucket, testId, updated);
    wroteTestJson = true;
    await upsertTestImageMetaAndTouchBatch(
      db,
      {
        testId,
        imageKey: key,
        imageType: "result",
        imageName: mbtiRaw,
        contentType: upload.contentType,
        sizeBytes: upload.buffer.byteLength,
      },
      testId,
    );
  } catch (err) {
    if (wroteTestJson) {
      try {
        await writeTest(bucket, testId, testJson);
      } catch {
        // Best effort cleanup for partial test.json updates.
      }
    }
    if (wroteImage) {
      await rollbackUploadedObject(bucket, key);
    }
    return noStoreJsonResponse(
      { error: err instanceof Error ? err.message : "Failed to upload image." },
      500,
    );
  }

  if (context.env.MBTI_KV) {
    context.waitUntil(context.env.MBTI_KV.delete(`test:${testId}`));
  }

  const cache = getDefaultCache();
  if (cache) {
    const origin = new URL(context.request.url).origin;
    context.waitUntil(
      cache.delete(new Request(`${origin}/api/tests`, { method: "GET" })),
    );
    context.waitUntil(
      cache.delete(
        new Request(`${origin}/api/tests/${testId}`, { method: "GET" }),
      ),
    );
  }

  return noStoreJsonResponse({
    ok: true,
    mbti: mbtiRaw,
    path: key,
    url: `/assets/${key.replace(/^assets\/?/i, "")}`,
  });
}
