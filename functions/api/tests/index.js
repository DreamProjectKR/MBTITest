/**
 * API: `GET /api/tests`
 *
 * Reads `assets/index.json` from the bound R2 bucket and returns it verbatim.
 * Designed to be cache-friendly (ETag + Cache-Control).
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
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) {
    return new Response(
      JSON.stringify({ error: "R2 binding MBTI_BUCKET is missing." }),
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const key = "assets/index.json";
  const obj = await bucket.get(key);
  if (!obj) {
    // Keep response shape compatible with existing frontend code.
    return new Response(JSON.stringify({ tests: [] }), {
      status: 200,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 5 }),
    });
  }

  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (ifNoneMatch && obj.etag && ifNoneMatch === obj.etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag: obj.etag, maxAge: 60 }),
    });
  }

  const text = await obj.text();
  return new Response(text, {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, { etag: obj.etag, maxAge: 60 }),
  });
}
