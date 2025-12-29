/**
 * API: `GET /api/tests/:id/meta`
 *
 * Returns intro/SEO metadata only (no questions/results).
 */

import { decodeDescriptionText, decodeTagsText } from "../../utils/codecs.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

function withCacheHeaders(
  headers: HeadersInit,
  { etag, maxAge = 60 }: { etag?: string; maxAge?: number } = {},
): Headers {
  const h = new Headers(headers);
  h.set(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 10}`,
  );
  if (etag) h.set("ETag", etag);
  return h;
}

export async function onRequestGet(context: any) {
  const db = context.env.MBTI_DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 binding MBTI_DB is missing." }), {
      status: 500,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
    });
  }

  const id = context.params?.id ? String(context.params.id) : "";
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing test id." }), {
      status: 400,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
    });
  }

  const rowRes = await db
    .prepare(
      `SELECT id, title, type, description_text, tags_text, author, author_img, thumbnail, created_at, updated_at
       FROM tests
       WHERE id = ?`,
    )
    .bind(id)
    .first();

  if (!rowRes) {
    return new Response(JSON.stringify({ error: "Test not found: " + id }), {
      status: 404,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }),
    });
  }

  const payload = {
    id: rowRes.id,
    title: rowRes.title ?? "",
    type: rowRes.type ?? "generic",
    description: decodeDescriptionText(rowRes.description_text ?? ""),
    tags: decodeTagsText(rowRes.tags_text ?? ""),
    author: rowRes.author ?? "",
    authorImg: rowRes.author_img ?? "",
    thumbnail: rowRes.thumbnail ?? "",
    createdAt: rowRes.created_at ?? "",
    updatedAt: rowRes.updated_at ?? "",
    path: `${String(rowRes.id || "")}/test.json`,
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

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 60 }),
  });
}


