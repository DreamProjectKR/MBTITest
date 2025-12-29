import type { PagesContext } from "../../../../../types/bindings.d.ts";
import { getImagesPrefix } from "../../../../utils/store.js";
import { requireBucket, requireDb } from "../../../../../utils/bindings.js";
import { errorResponse, jsonResponse, methodNotAllowed } from "../../../../../utils/http.js";
import { extensionFromMime, readUploadBytes } from "../../../../../utils/upload.js";

export async function onRequestPut(
  context: PagesContext<{ id?: string; mbti?: string }>,
) {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = requireBucket(context);
  if (bucket instanceof Response) return bucket;
  const db = requireDb(context);
  if (db instanceof Response) return db;

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return errorResponse("Missing test id.", 400);
  const codeRaw = context.params?.mbti
    ? String(context.params.mbti).trim().toUpperCase()
    : "";
  if (!codeRaw) return errorResponse("Invalid outcome code.", 400);

  let upload;
  try {
    upload = await readUploadBytes(context);
  } catch {
    return errorResponse("Unable to parse uploaded file.", 400);
  }

  if (!upload) return errorResponse("File upload required.", 400);

  const extension = extensionFromMime(upload.contentType);
  const fileName = `${codeRaw}.${extension}`;
  const key = `${getImagesPrefix(testId)}${fileName}`;

  try {
    await bucket.put(key, upload.bytes, {
      httpMetadata: {
        contentType: upload.contentType,
        // Result images are effectively static; cache aggressively.
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to upload image.",
      500,
    );
  }

  try {
    const now = new Date().toISOString();
    // Ensure row exists, then update image.
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO results (test_id, result_id, result_image, result_text, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(testId, codeRaw, key, "", now, now),
      db
        .prepare(
          `UPDATE results
           SET result_image = ?, updated_at = ?
           WHERE test_id = ? AND result_id = ?`,
        )
        .bind(key, now, testId, codeRaw),
      db.prepare(`UPDATE tests SET updated_at = ? WHERE id = ?`).bind(now, testId),
    ]);

    return jsonResponse({
      ok: true,
      code: codeRaw,
      path: key,
      url: `/assets/${getImagesPrefix(testId).replace(
        /^assets\/?/i,
        "",
      )}${fileName}`,
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Unable to update outcome image.",
      500,
    );
  }
}
