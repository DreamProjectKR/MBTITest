/**
 * API: `GET /api/tests/:id/outcome?code=...`
 *
 * Returns a single outcome payload for the result screen (share/direct access).
 */

import type { PagesContext } from "../../types/bindings.d.ts";
import { requireDb } from "../../utils/bindings.js";
import { JSON_HEADERS, errorResponse, jsonResponse, withCacheHeaders } from "../../utils/http.js";

type TestRow = { id: string; title: string | null; type: string | null; updated_at: string | null };
type ResultRow = {
  result_id: string;
  result_image: string | null;
  result_text: string | null;
  updated_at: string | null;
};

export async function onRequestGet(context: PagesContext<{ id?: string }>) {
  const db = requireDb(context);
  if (db instanceof Response) {
    return jsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const id = context.params?.id ? String(context.params.id) : "";
  const url = new URL(context.request.url);
  const code =
    (url.searchParams.get("code") || url.searchParams.get("result") || "").trim();
  if (!id || !code) return errorResponse("Missing test id or result code.", 400);

  const testRow = await db
    .prepare(`SELECT id, title, type, updated_at FROM tests WHERE id = ?`)
    .bind(id)
    .first();
  if (!testRow) return errorResponse("Test not found: " + id, 404);

  const outRow = await db
    .prepare(
      `SELECT result_id, result_image, result_text, updated_at
       FROM results
       WHERE test_id = ? AND result_id = ?`,
    )
    .bind(id, code)
    .first();

  if (!outRow) return jsonResponse({ error: "Outcome not found.", code }, { status: 404 });

  const test = testRow as TestRow;
  const out = outRow as ResultRow;
  const payload = {
    id: test.id,
    title: test.title ?? "",
    type: test.type ?? "generic",
    outcome: {
      code: out.result_id,
      title: "",
      image: out.result_image ?? "",
      summary: out.result_text ?? "",
      meta: null,
    },
  };

  const etagBase = out.updated_at ?? test.updated_at ?? "";
  const etag = etagBase ? `"d1-test-outcome-${id}-${code}-${etagBase}"` : "";
  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (etag && ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 300 }),
    });
  }

  return jsonResponse(payload, { status: 200, headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 300 }) });
}
