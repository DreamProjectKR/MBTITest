/**
 * API: `GET /api/tests/:id`
 *
 * Reads the test index row from D1 (`mbti_db.tests`) by `id`,
 * then fetches that test's JSON from R2 (`assets/<path>`) and returns it.
 *
 * Cache behavior:
 * - Supports ETag / If-None-Match
 * - Uses conservative TTLs because content may change
 */
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

/**
 * Add caching headers to a response.
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
 * Convert an index.json `path` field into an R2 key.
 * Examples:
 * - `test-summer/test.json` -> `assets/test-summer/test.json`
 * - `assets/test-summer/test.json` -> `assets/test-summer/test.json`
 * @param {string} rawPath
 * @returns {string}
 */
function normalizeR2KeyFromIndexPath(rawPath) {
  const str = String(rawPath || "").trim();
  if (!str) return "";
  // index.json은 보통 "test-summer/test.json" 형태로 내려오므로 "assets/"를 보정한다.
  const clean = str.replace(/^\.?\/+/, "");
  return clean.startsWith("assets/") ? clean : `assets/${clean}`;
}

/**
 * Cloudflare Pages Function entrypoint for `GET /api/tests/:id`.
 * @param {{ request: Request, env: any, params?: { id?: string } }} context
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) {
    return new Response(
      JSON.stringify({ error: "R2 binding MBTI_BUCKET is missing." }),
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }
  const db = context.env.mbti_db;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 binding mbti_db is missing." }), {
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

  const row = await db
    .prepare(
      "SELECT test_id, title, description_json, author, author_img_path, thumbnail_path, tags_json, source_path, created_at, updated_at FROM tests WHERE test_id = ?1 LIMIT 1",
    )
    .bind(id)
    .first();

  if (!row?.source_path) {
    return new Response(JSON.stringify({ error: "Test not found: " + id }), {
      status: 404,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }),
    });
  }

  const key = normalizeR2KeyFromIndexPath(String(row.source_path));
  if (!key) {
    return new Response(
      JSON.stringify({ error: "Test meta has empty path: " + id }),
      {
        status: 500,
        headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
      },
    );
  }

  const obj = await bucket.get(key);
  if (!obj) {
    return new Response(
      JSON.stringify({ error: "Test JSON not found in R2.", key }),
      {
        status: 404,
        headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }),
      },
    );
  }

  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (ifNoneMatch && obj.etag && ifNoneMatch === obj.etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag: obj.etag, maxAge: 120 }),
    });
  }

  let bodyJson = null;
  try {
    bodyJson = JSON.parse(await obj.text());
  } catch (e) {
    return new Response(JSON.stringify({ error: "Test JSON is invalid JSON." }), {
      status: 500,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
    });
  }

  const description = (() => {
    const raw = row?.description_json;
    if (!raw) return null;
    try {
      return JSON.parse(String(raw));
    } catch (e) {
      return null;
    }
  })();

  const tags = (() => {
    const raw = row?.tags_json;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(String(raw));
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  })();

  const merged = {
    // meta (D1)
    id: String(row.test_id),
    title: row.title ? String(row.title) : "",
    description,
    author: row.author ? String(row.author) : "",
    authorImg: row.author_img_path ? String(row.author_img_path) : "",
    thumbnail: row.thumbnail_path ? String(row.thumbnail_path) : "",
    tags,
    path: row.source_path ? String(row.source_path) : "",
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
    // body (R2)
    ...(bodyJson && typeof bodyJson === "object" ? bodyJson : {}),
  };

  return new Response(JSON.stringify(merged), {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, { etag: obj.etag, maxAge: 120 }),
  });
}
