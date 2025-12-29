import type { PagesContext } from "../../../types/bindings.d.ts";
import { getImagesPrefix } from "../../utils/store.js";
import { requireBucket, requireDb } from "../../../utils/bindings.js";
import { errorResponse, jsonResponse, methodNotAllowed } from "../../../utils/http.js";
import { extensionFromMime, readUploadBytes } from "../../../utils/upload.js";

export async function onRequestPut(context: PagesContext<{ id?: string }>) {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = requireBucket(context);
  if (bucket instanceof Response) return bucket;
  const db = requireDb(context);
  if (db instanceof Response) return db;

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return errorResponse("Missing test id.", 400);

  let upload;
  try {
    upload = await readUploadBytes(context);
  } catch {
    return errorResponse("Unable to parse uploaded file.", 400);
  }
  if (!upload) return errorResponse("File upload required.", 400);

  const extension = extensionFromMime(upload.contentType);
  const key = `${getImagesPrefix(testId)}author.${extension}`;

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
  await db
    .prepare(`UPDATE tests SET author_img = ?, updated_at = ? WHERE id = ?`)
    .bind(key, now, testId)
    .run();

  return jsonResponse({
    ok: true,
    path: key,
    url: `/assets/${key.replace(/^assets\/?/i, "")}`,
  });
}
