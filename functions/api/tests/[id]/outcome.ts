/**
 * API: `GET /api/tests/:id/outcome?code=...`
 *
 * Returns a single outcome payload for the result screen (share/direct access).
 */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

function withCacheHeaders(
  headers: HeadersInit,
  { etag, maxAge = 120 }: { etag?: string; maxAge?: number } = {},
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
  const url = new URL(context.request.url);
  const code =
    (url.searchParams.get("code") || url.searchParams.get("result") || "").trim();
  if (!id || !code) {
    return new Response(JSON.stringify({ error: "Missing test id or result code." }), {
      status: 400,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
    });
  }

  const testRow = await db
    .prepare(`SELECT id, title, type, updated_at FROM tests WHERE id = ?`)
    .bind(id)
    .first();
  if (!testRow) {
    return new Response(JSON.stringify({ error: "Test not found: " + id }), {
      status: 404,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }),
    });
  }

  const outRow = await db
    .prepare(
      `SELECT result, result_image, summary, updated_at
       FROM results
       WHERE test_id = ? AND result = ?`,
    )
    .bind(id, code)
    .first();

  if (!outRow) {
    return new Response(JSON.stringify({ error: "Outcome not found.", code }), {
      status: 404,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }),
    });
  }

  const payload = {
    id: testRow.id,
    title: testRow.title ?? "",
    type: testRow.type ?? "generic",
    outcome: {
      code: outRow.result,
      title: "",
      image: outRow.result_image ?? "",
      summary: outRow.summary ?? "",
      meta: null,
    },
  };

  const etagBase = outRow.updated_at ?? testRow.updated_at ?? "";
  const etag = etagBase ? `"d1-test-outcome-${id}-${code}-${etagBase}"` : "";
  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (etag && ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 300 }),
    });
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 300 }),
  });
}
