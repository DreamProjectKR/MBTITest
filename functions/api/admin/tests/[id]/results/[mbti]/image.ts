import type { MbtiEnv, PagesContext } from "../../../../../../_types";
import {
  JSON_HEADERS,
  getImagesPrefix,
  readTest,
  upsertTestImageMeta,
  writeTest,
} from "../../../../utils/store.js";

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

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function methodNotAllowed(): Response {
  return json({ error: "Method not allowed." }, 405);
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function extensionFromMime(mimeType = ""): string {
  const type = String(mimeType || "").toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "png";
}

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

function formatIndexDate(date: Date = new Date()): string {
  return new Date(date).toISOString().split("T")[0] ?? "";
}

export async function onRequestPut(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return json({ error: "R2 binding MBTI_BUCKET is missing." }, 500);
  const db = context.env.mbti_db;
  if (!db) return json({ error: "D1 binding mbti_db is missing." }, 500);

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return badRequest("Missing test id.");

  const mbtiRaw = context.params?.mbti
    ? String(context.params.mbti).trim().toUpperCase()
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
  const key = `${getImagesPrefix(testId)}${fileName}`;

  try {
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: upload.contentType },
    });
    await upsertTestImageMeta(db, {
      testId,
      imageKey: key,
      imageType: "result",
      imageName: mbtiRaw,
      contentType: upload.contentType,
      sizeBytes: upload.buffer.byteLength,
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Failed to upload image." },
      500,
    );
  }

  // Update R2 test.json (slim body) to include result image path.
  const testJson = await readTest(bucket, testId);
  if (!testJson || typeof testJson !== "object") {
    return json({ error: "Test JSON not found while updating image." }, 404);
  }

  const t = testJson as { results?: Record<string, unknown> };
  const results =
    t.results && typeof t.results === "object"
      ? (t.results as Record<string, unknown>)
      : {};
  const existing =
    results[mbtiRaw] && typeof results[mbtiRaw] === "object"
      ? (results[mbtiRaw] as Record<string, unknown>)
      : {};
  results[mbtiRaw] = {
    ...existing,
    image: `${getImagesPrefix(testId)}${fileName}`,
  };
  t.results = results;

  await writeTest(bucket, testId, t);

  // Touch updated_at in D1 so listing order reflects recent edits.
  const now = formatIndexDate();
  await db
    .prepare("UPDATE tests SET updated_at = ?1 WHERE test_id = ?2")
    .bind(now, testId)
    .all();
  if (context.env.MBTI_KV) {
    context.waitUntil(context.env.MBTI_KV.delete(`test:${testId}`));
  }

  return json({
    ok: true,
    mbti: mbtiRaw,
    path: `${getImagesPrefix(testId)}${fileName}`,
    url: `/assets/${getImagesPrefix(testId).replace(/^assets\/?/i, "")}${fileName}`,
  });
}
