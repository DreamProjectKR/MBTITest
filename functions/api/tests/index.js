/**
 * API: `GET /api/tests`
 *
 * D1-backed list endpoint.
 * Returns the same top-level shape as the legacy index.json:
 *   { tests: [{ id, title, thumbnail, tags, createdAt, updatedAt }] }
 *
 * Images remain in R2; we store only their object keys (usually `assets/...`) in D1.
 */
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

import { decodeTagsText } from "../utils/codecs.js";

/**
 * Add caching headers to a response.
 * - `maxAge` is small because test metadata can change.
 * - `stale-while-revalidate` allows edge to serve slightly stale content while refreshing.
 * @param {Record<string, string> | Headers} headers
 * @param {{ etag?: string, maxAge?: number }} [opts]
 * @returns {Headers}
 */
function withCacheHeaders(headers, { etag, maxAge = 60 } = {}) {
  const h = new Headers(headers);
  h.set(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 10}`,
  );
  if (etag) h.set("ETag", etag);
  return h;
}

/**
 * Cloudflare Pages Function entrypoint for `GET /api/tests`.
 * @param {{ request: Request, env: any }} context
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const db = context.env.MBTI_DB;
  if (!db) {
    return new Response(
      JSON.stringify({ error: "D1 binding MBTI_DB is missing." }),
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const res = await db
    .prepare(
      `SELECT id, title, thumbnail, tags_text, created_at, updated_at
       FROM tests
       ORDER BY updated_at DESC`,
    )
    .all();

  const rows = Array.isArray(res?.results) ? res.results : [];
  const tests = rows.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    thumbnail: r.thumbnail ?? "",
    tags: decodeTagsText(r.tags_text ?? ""),
    // Keep legacy-ish date strings if present (YYYY-MM-DD...); consumers treat as opaque.
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
    // Keep path for legacy compatibility; not used by new clients.
    path: `${String(r.id || "")}/test.json`,
  }));

  // NOTE: We don't have per-row etags; use a coarse etag from the newest updated_at.
  const etagBase = tests[0]?.updatedAt || "";
  const etag = etagBase ? `"d1-tests-${etagBase}"` : "";
  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (etag && ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 30 }),
    });
  }

  return new Response(JSON.stringify({ tests }), {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 30 }),
  });
}
