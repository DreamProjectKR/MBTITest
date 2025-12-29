/**
 * API: `GET /api/tests`
 *
 * D1-backed list endpoint.
 * Returns the same top-level shape as the legacy index.json:
 *   { tests: [{ id, title, thumbnail, tags, createdAt, updatedAt }] }
 *
 * Images remain in R2; we store only their object keys (usually `assets/...`) in D1.
 */
import type { PagesContext } from "../types/bindings.d.ts";
import { decodeTagsText } from "../utils/codecs.js";
import { requireDb } from "../utils/bindings.js";
import { JSON_HEADERS, jsonResponse, withCacheHeaders } from "../utils/http.js";

export async function onRequestGet(context: PagesContext) {
  const db = requireDb(context);
  if (db instanceof Response) {
    return jsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
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
  type TestRow = {
    id: string;
    title: string | null;
    thumbnail: string | null;
    tags_text: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  const typedRows = rows as TestRow[];
  const tests = typedRows.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    thumbnail: r.thumbnail ?? "",
    tags: decodeTagsText(r.tags_text ?? ""),
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
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

  return jsonResponse({ tests }, { status: 200, headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 30 }) });
}
