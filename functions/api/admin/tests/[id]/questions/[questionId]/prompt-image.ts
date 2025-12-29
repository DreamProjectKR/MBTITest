import type { PagesContext } from "../../../../../types/bindings.d.ts";
import { requireBucket, requireDb } from "../../../../../utils/bindings.js";
import { errorResponse, jsonResponse, methodNotAllowed } from "../../../../../utils/http.js";
import { extensionFromMime, readUploadBytes } from "../../../../../utils/upload.js";

export async function onRequestPut(
  context: PagesContext<{ id?: string; questionId?: string }>,
) {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = requireBucket(context);
  if (bucket instanceof Response) return bucket;
  const db = requireDb(context);
  if (db instanceof Response) return db;

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  const questionId = context.params?.questionId
    ? String(context.params.questionId).trim()
    : "";
  if (!testId) return errorResponse("Missing test id.", 400);
  if (!questionId) return errorResponse("Missing question id.", 400);

  let upload;
  try {
    upload = await readUploadBytes(context);
  } catch {
    return errorResponse("Unable to parse uploaded file.", 400);
  }
  if (!upload) return errorResponse("File upload required.", 400);

  const extension = extensionFromMime(upload.contentType);
  const safeQuestionId = questionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const key = `assets/${testId}/images/questions/${safeQuestionId}.${extension}`;

  try {
    await bucket.put(key, upload.bytes, {
      httpMetadata: {
        contentType: upload.contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to upload image.",
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
    return errorResponse("Question not found in D1. Save the test first.", 404);
  }

  await db.prepare(`UPDATE tests SET updated_at = ? WHERE id = ?`).bind(now, testId).run();

  return jsonResponse({
    ok: true,
    questionId,
    path: key,
    url: `/assets/${key.replace(/^assets\/?/i, "")}`,
  });
}
