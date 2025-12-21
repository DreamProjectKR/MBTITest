/**
 * Asset proxy: `GET /assets/*`
 *
 * Why this exists:
 * - In production we want browsers to load images/JSON from `https://dreamp.org/assets/...` (same-origin)
 *   to avoid CORS headaches with the R2 public endpoint.
 * - This Pages Function reads objects from the bound R2 bucket (`MBTI_BUCKET`) and streams them back.
 *
 * Notes:
 * - We keep JSON TTL short (content changes), but cache images aggressively.
 * - We also use `caches.default` to improve TTFB for repeated requests.
 */

/**
 * Pages Functions "multipath segments" (double brackets) returns an array of segments.
 * Example: `/assets/images/mainLogo.png` -> `["images","mainLogo.png"]`
 * @param {any} params
 * @returns {string}
 */
function getPathParam(params) {
  const v = params?.path;
  if (Array.isArray(v)) return v.join("/");
  return v ? String(v) : "";
}

/**
 * Guess Content-Type by file extension when R2 metadata is missing.
 * @param {string} key
 * @returns {string}
 */
function guessContentType(key) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (lower.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

/**
 * Cache policy:
 * - JSON: short TTL (updates)
 * - Everything else: long TTL + immutable
 * @param {string} key
 * @returns {string}
 */
function cacheControlForKey(key) {
  const lower = key.toLowerCase();
  // JSON changes more often: short TTL but allow SWR/SIE so the edge stays fast.
  if (lower.endsWith(".json"))
    return "public, max-age=60, stale-while-revalidate=600, stale-if-error=600";
  // Images/fonts/etc: cache hard + immutable, with SWR/SIE for resilience.
  return "public, max-age=31536000, immutable, stale-while-revalidate=86400, stale-if-error=86400";
}

/**
 * Pages Function entrypoint.
 * @param {{ request: Request, env: any, params?: any, waitUntil: (p: Promise<any>) => void }} context
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return new Response("MBTI_BUCKET binding missing.", { status: 500 });

  const cache = caches?.default;
  const url = new URL(context.request.url);
  // Stable cache key: avoid header-driven cache fragmentation.
  const cacheKey = new Request(url.toString(), { method: "GET" });

  const requestCacheControl = (
    context.request.headers.get("cache-control") || ""
  ).toLowerCase();
  const bypassCache =
    requestCacheControl.includes("no-cache") ||
    requestCacheControl.includes("no-store") ||
    context.request.headers.has("pragma");

  if (!bypassCache && cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const tail = getPathParam(context.params).replace(/^\/+/, "");
  if (!tail) return new Response("Not Found", { status: 404 });

  // Support a few historical key layouts in the bucket.
  const candidateKeys = [`assets/${tail}`, tail, `assets/data/${tail}`];

  let obj = null;
  let key = "";
  for (const candidate of candidateKeys) {
    // eslint-disable-next-line no-await-in-loop
    const hit = await bucket.get(candidate);
    if (hit) {
      obj = hit;
      key = candidate;
      break;
    }
  }

  if (!obj)
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });

  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (ifNoneMatch && obj.etag && ifNoneMatch === obj.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: obj.etag,
        "Cache-Control": cacheControlForKey(key),
      },
    });
  }

  const headers = new Headers();
  if (obj.etag) headers.set("ETag", obj.etag);
  headers.set("Cache-Control", cacheControlForKey(key));
  headers.set(
    "Content-Type",
    obj.httpMetadata?.contentType || guessContentType(key),
  );
  if (obj.httpMetadata?.cacheControl)
    headers.set("Cache-Control", obj.httpMetadata.cacheControl);
  headers.set("X-MBTI-Assets-Proxy", "1");
  headers.set("X-MBTI-R2-Key", key);

  const response = new Response(obj.body, { status: 200, headers });

  // Cache only if response is explicitly cacheable.
  const respCacheControl = (
    response.headers.get("cache-control") || ""
  ).toLowerCase();
  const shouldCache =
    !bypassCache &&
    cache &&
    response.status === 200 &&
    respCacheControl.includes("public") &&
    !respCacheControl.includes("no-store");

  if (shouldCache) context.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
}
