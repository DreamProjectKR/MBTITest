import { JSON_HEADERS } from "../../../../utils/store.js";

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function methodNotAllowed() {
  return createJsonResponse({ error: "Method not allowed." }, 405);
}

function badRequest(message: string) {
  return createJsonResponse({ error: message }, 400);
}

function extensionFromMime(mimeType = "") {
  const type = mimeType.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "png";
}

async function extractUpload(context: any) {
  const contentType = context.request.headers.get("content-type") || "";
  const isMultipart = contentType
    .toLowerCase()
    .startsWith("multipart/form-data");
  if (isMultipart) {
    const formData = await context.request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return null;
    const buffer = await file.arrayBuffer();
    return { buffer, contentType: file.type || contentType };
  }
  const buffer = await context.request.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return null;
  return { buffer, contentType: contentType || "image/png" };
}

export async function onRequestPut(context: any) {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return createJsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      500,
    );
  const db = context.env.MBTI_DB;
  if (!db)
    return createJsonResponse({ error: "D1 binding MBTI_DB is missing." }, 500);

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  const questionId = context.params?.questionId
    ? String(context.params.questionId).trim()
    : "";
  if (!testId) return badRequest("Missing test id.");
  if (!questionId) return badRequest("Missing question id.");

  let upload;
  try {
    upload = await extractUpload(context);
  } catch (err) {
    return badRequest("Unable to parse uploaded file.");
  }
  if (!upload) return badRequest("File upload required.");

  const bytes = new Uint8Array(upload.buffer);
  const extension = extensionFromMime(upload.contentType);
  const safeQuestionId = questionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const key = `assets/${testId}/images/questions/${safeQuestionId}.${extension}`;

  try {
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: upload.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return createJsonResponse(
      { error: err instanceof Error ? err.message : "Failed to upload image." },
      500,
    );
  }

  const now = new Date().toISOString();
  const res = await db
    .prepare(
      `UPDATE questions SET question_image = ?, updated_at = ?
       WHERE test_id = ? AND question_id = ?`,
    )
    .bind(key, now, testId, questionId)
    .run();

  // If nothing updated, question doesn't exist yet (must save test first).
  if (!res?.success || (typeof res.changes === "number" && res.changes === 0)) {
    return createJsonResponse(
      { error: "Question not found in D1. Save the test first." },
      404,
    );
  }

  await db.prepare(`UPDATE tests SET updated_at = ? WHERE id = ?`).bind(now, testId).run();

  return createJsonResponse({
    ok: true,
    questionId,
    path: key,
    url: `/assets/${key.replace(/^assets\/?/i, "")}`,
  });
}


