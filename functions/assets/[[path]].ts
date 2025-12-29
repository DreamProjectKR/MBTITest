/**
 * Asset proxy: `GET /assets/*` (Cloudflare Pages Function)
 *
 * Why this exists:
 * - In production we want the browser to request assets from `https://dreamp.org/...` (same origin),
 *   so images don't hit CORS issues.
 * - R2 is accessed server-side via the Pages R2 binding (`MBTI_BUCKET`).
 *
 * The frontend uses relative paths like `assets/...`, and `public/scripts/config.js` turns them into
 * `/assets/...` URLs by default (same-origin).
 */

/**
 * Pages Functions "multipath segments" (double brackets) returns an array of segments.
 * Example: `/assets/images/mainLogo.png` -> `["images","mainLogo.png"]`
 * @returns {string}
 */
import type { PagesContext } from "../api/types/bindings.d.ts";

type AssetParams = { path?: string[] | string };

function getPathParam(params: AssetParams): string {
  const v = params?.path;
  if (Array.isArray(v)) return v.join("/");
  return v ? String(v) : "";
}

/**
 * Guess a Content-Type by file extension when R2 metadata is missing.
 * @param {string} key
 * @returns {string}
 */
function guessContentType(key: string): string {
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
 * Cache-Control policy for proxied objects.
 * - JSON: short TTL (can be updated)
 * - Other static assets: long TTL + immutable with SWR/SIE for resilience
 * @param {string} key
 * @returns {string}
 */
function cacheControlForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".json"))
    return "public, max-age=60, s-maxage=60, must-revalidate, stale-while-revalidate=600, stale-if-error=600";
  return "public, max-age=31536000, s-maxage=86400, immutable, stale-while-revalidate=86400, stale-if-error=86400";
}

/**
 * Cloudflare Pages Function entrypoint for `GET /assets/*`.
 */
export async function onRequestGet(context: PagesContext<AssetParams>) {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return new Response("MBTI_BUCKET binding missing.", { status: 500 });

  // Edge cache (Cloudflare Cache API). Pages Functions responses can otherwise behave "dynamic".
  const cache = (caches as CacheStorage & { default?: Cache }).default;
  const url = new URL(context.request.url);
  // Normalize cache key: avoid header-driven fragmentation.
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
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("X-MBTI-Edge-Cache", "HIT");
      return new Response(cached.body, { status: cached.status, headers });
    }
  }

  const tail = getPathParam(context.params).replace(/^\/+/, "");
  if (!tail) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Canonical key: always serve from `assets/...` to keep a single R2 lookup per request.
  // If callers accidentally include `assets/` in the URL, keep it stable.
  const key = tail.startsWith("assets/") ? tail : `assets/${tail}`;
  const obj = await bucket.get(key);

  if (!obj) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

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
  headers.set("ETag", obj.etag || "");
  const defaultCacheControl = cacheControlForKey(key);
  const cacheControl = obj.httpMetadata?.cacheControl || defaultCacheControl;
  headers.set("Cache-Control", cacheControl);
  headers.set("Content-Type", obj.httpMetadata?.contentType || guessContentType(key));
  headers.set("X-MBTI-Assets-Proxy", "1");
  headers.set("X-MBTI-R2-Key", key);
  headers.set("X-MBTI-Edge-Cache", "MISS");

  // Respect object metadata if present (lets operators control caching per-object).
  if (obj.httpMetadata?.cacheControl)
    headers.set("Cache-Control", obj.httpMetadata.cacheControl);

  const response = new Response(obj.body, { status: 200, headers });

  // Store in edge cache only when cacheable.
  const respCacheControl = (
    response.headers.get("cache-control") || ""
  ).toLowerCase();
  const shouldCache =
    !bypassCache &&
    cache &&
    response.status === 200 &&
    respCacheControl.includes("public") &&
    !respCacheControl.includes("no-store");

  if (shouldCache) {
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}
