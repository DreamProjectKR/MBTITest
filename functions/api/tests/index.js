/**
 * API: `GET /api/tests`
 *
 * Reads the test index from D1 (`mbti_db.tests`) and returns it in the same shape
 * as the legacy `assets/index.json` response: `{ tests: [...] }`.
 */
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

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
  const db = context.env.mbti_db;
  if (!db) {
    return new Response(
      JSON.stringify({ error: "D1 binding mbti_db is missing." }),
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const rows = await db
    .prepare(
      "SELECT test_id, title, thumbnail_path, tags_json, source_path, created_at, updated_at FROM tests ORDER BY updated_at DESC, test_id ASC",
    )
    .all();

  const tests = (rows?.results || []).map((r) => {
    const tags = (() => {
      const raw = r?.tags_json;
      if (!raw) return [];
      try {
        const parsed = JSON.parse(String(raw));
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    })();

    return {
      id: String(r.test_id),
      title: String(r.title || ""),
      thumbnail: r.thumbnail_path ? String(r.thumbnail_path) : "",
      tags,
      path: r.source_path ? String(r.source_path) : "",
      createdAt: r.created_at ? String(r.created_at) : "",
      updatedAt: r.updated_at ? String(r.updated_at) : "",
    };
  });

  const etag = (() => {
    const maxUpdated = tests.reduce((acc, t) => {
      const v = t?.updatedAt || "";
      return v > acc ? v : acc;
    }, "");
    return `"${tests.length}-${maxUpdated}"`;
  })();

  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 60 }),
    });
  }

  return new Response(JSON.stringify({ tests }), {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 60 }),
  });
}
