/**
 * API: `GET /api/tests/:id/meta`
 *
 * Returns intro/SEO metadata only (no questions/results).
 */

import type { PagesContext } from "../../types/bindings.d.ts";
import { decodeDescriptionText, decodeTagsText } from "../../utils/codecs.js";
import { requireDb } from "../../utils/bindings.js";
import { JSON_HEADERS, errorResponse, jsonResponse, withCacheHeaders } from "../../utils/http.js";

export async function onRequestGet(context: PagesContext<{ id?: string }>) {
  const db = requireDb(context);
  if (db instanceof Response) {
    return jsonResponse({ error: "D1 binding MBTI_DB is missing." }, { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) });
  }

  const id = context.params?.id ? String(context.params.id) : "";
  if (!id) {
    return errorResponse("Missing test id.", 400);
  }

  const rowRes = await db
    .prepare(
      `SELECT id, title, type, description_text, tags_text, author, author_img, thumbnail, created_at, updated_at
       FROM tests
       WHERE id = ?`,
    )
    .bind(id)
    .first();

  if (!rowRes) return errorResponse("Test not found: " + id, 404);

  type TestRow = {
    id: string;
    title: string | null;
    type: string | null;
    description_text: string | null;
    tags_text: string | null;
    author: string | null;
    author_img: string | null;
    thumbnail: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  const row = rowRes as TestRow;
  const payload = {
    id: row.id,
    title: row.title ?? "",
    type: row.type ?? "generic",
    description: decodeDescriptionText(row.description_text ?? ""),
    tags: decodeTagsText(row.tags_text ?? ""),
    author: row.author ?? "",
    authorImg: row.author_img ?? "",
    thumbnail: row.thumbnail ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    path: `${String(row.id || "")}/test.json`,
  };

  const etagBase = payload.updatedAt || "";
  const etag = etagBase ? `"d1-test-meta-${id}-${etagBase}"` : "";
  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (etag && ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 60 }),
    });
  }

  return jsonResponse(payload, { status: 200, headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 60 }) });
}


