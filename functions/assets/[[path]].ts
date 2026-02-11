/**
 * Asset proxy: `GET /assets/*` (Cloudflare Pages Function)
 *
 * Goals:
 * - Same-origin asset URLs to avoid CORS issues
 * - Strong caching via Cache API + ETag handling
 * - Optional local-dev fallback to public R2 URL when local R2 is empty
 */
import type {
  MbtiEnv,
  PagesContext,
  PagesParams,
  R2Object,
  R2Range,
} from "../_types";

import { getDefaultCache } from "../api/_utils/http";

type Params = PagesParams & { path?: string | string[] };

/**
 * Parses Range header (bytes=start-end, bytes=start-, bytes=-suffix) into R2Range.
 * Returns null if invalid or missing.
 */
function parseRangeHeader(header: string | null): R2Range | null {
  if (!header || !header.toLowerCase().startsWith("bytes=")) return null;
  const value = header.slice(6).trim();
  const dash = value.indexOf("-");
  if (dash < 0) return null;
  const startStr = value.slice(0, dash).trim();
  const endStr = value.slice(dash + 1).trim();
  if (startStr === "" && endStr === "") return null;
  if (endStr === "") {
    const offset = parseInt(startStr, 10);
    if (!Number.isFinite(offset) || offset < 0) return null;
    return { offset };
  }
  if (startStr === "") {
    const suffix = parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { suffix };
  }
  const offset = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  if (
    !Number.isFinite(offset) ||
    !Number.isFinite(end) ||
    offset < 0 ||
    end < offset
  )
    return null;
  return { offset, length: end - offset + 1 };
}

function getPathParam(params: Params | undefined): string {
  const v = params?.path;
  if (Array.isArray(v)) return v.join("/");
  return v ? String(v) : "";
}

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

function cacheControlForKey(key: string, isVersioned: boolean): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".json"))
    return "public, max-age=60, s-maxage=60, must-revalidate, stale-while-revalidate=600, stale-if-error=600";
  if (isVersioned) {
    // Cache-busted URLs (e.g. `?v=updatedAt`) are safe to cache aggressively.
    return "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400, stale-if-error=86400";
  }
  const isUiImage =
    lower.startsWith("assets/images/") ||
    lower.startsWith("images/") ||
    lower.startsWith("assets/data/images/");
  if (isUiImage) {
    // Static UI assets (rarely overwritten). Cache aggressively.
    return "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400, stale-if-error=86400";
  }
  // Test images may be overwritten during authoring (same key). Keep cache shorter.
  return "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=86400";
}

function buildCacheTagHeader(key: string): string {
  const tags = ["assets"];
  const clean = String(key || "").replace(/^\/+/, "");
  const m = clean.match(/^assets\/(test-[^/]+)\//i);
  if (m?.[1]) tags.push("test", m[1]);
  return tags.join(",");
}

function toggleFirstCharCase(s: string): string {
  if (!s) return s;
  const first = s[0];
  const code = first.charCodeAt(0);
  if (code >= 65 && code <= 90)
    return String.fromCharCode(code + 32) + s.slice(1);
  if (code >= 97 && code <= 122)
    return String.fromCharCode(code - 32) + s.slice(1);
  return s;
}

function addCaseFallbackCandidates(keys: string[], tail: string): void {
  const t = String(tail || "").replace(/^\/+/, "");
  if (!t) return;
  const lower = t.toLowerCase();
  const isStatic =
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".woff2");
  if (!isStatic) return;

  const parts = t.split("/");
  const filename = parts.pop() || "";
  if (!filename) return;

  const toggled = toggleFirstCharCase(filename);
  if (!toggled || toggled === filename) return;

  const toggledTail = [...parts, toggled].join("/");
  keys.push(`assets/${toggledTail}`);
  keys.push(toggledTail);
}

async function tryFetchRemote(
  candidates: string[],
  publicBase: string,
  isVersioned: boolean,
): Promise<Response | null> {
  const base = publicBase.replace(/\/+$/, "");
  if (!base) return null;

  for (const candidate of candidates) {
    const remoteUrl = `${base}/${candidate.replace(/^\/+/, "")}`;
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetch(remoteUrl);
    if (resp.ok) {
      const headers = new Headers(resp.headers);
      headers.set("Cache-Control", cacheControlForKey(candidate, isVersioned));
      headers.set("Cache-Tag", buildCacheTagHeader(candidate));
      headers.set("X-MBTI-Assets-Proxy", "1");
      headers.set("X-MBTI-R2-Key", candidate);
      headers.set("X-MBTI-Edge-Cache", "MISS");
      return new Response(resp.body, { status: 200, headers });
    }
  }
  return null;
}

function buildObjectResponse(
  obj: R2Object,
  key: string,
  hit: "HIT" | "MISS",
  isVersioned: boolean,
  range?: {
    offset?: number;
    length?: number;
    suffix?: number;
    total?: number;
  } | null,
): Response {
  const ifNoneMatch = obj.etag ? obj.etag : "";
  const headers = new Headers();
  if (ifNoneMatch) headers.set("ETag", ifNoneMatch);
  headers.set(
    "Cache-Control",
    obj.httpMetadata?.cacheControl || cacheControlForKey(key, isVersioned),
  );
  headers.set("Cache-Tag", buildCacheTagHeader(key));
  headers.set(
    "Content-Type",
    obj.httpMetadata?.contentType || guessContentType(key),
  );
  headers.set("X-MBTI-Assets-Proxy", "1");
  headers.set("X-MBTI-R2-Key", key);
  headers.set("X-MBTI-Edge-Cache", hit);
  if (range && range.offset !== undefined) {
    const total = range.total ?? obj.size ?? "*";
    const end =
      range.length !== undefined ? range.offset + range.length - 1
      : typeof total === "number" ? total - 1
      : "*";
    headers.set("Content-Range", `bytes ${range.offset}-${end}/${total}`);
    return new Response(obj.body, { status: 206, headers });
  }
  if (range && range.suffix !== undefined) {
    const total = range.total ?? obj.size ?? "*";
    const start = typeof total === "number" ? total - range.suffix : 0;
    headers.set(
      "Content-Range",
      `bytes ${start}-${typeof total === "number" ? total - 1 : "*"}/${total}`,
    );
    return new Response(obj.body, { status: 206, headers });
  }
  return new Response(obj.body, { status: 200, headers });
}

export async function onRequestGet(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return new Response("MBTI_BUCKET binding missing.", { status: 500 });

  const cache = getDefaultCache();
  const url = new URL(context.request.url);
  const isVersioned = url.searchParams.has("v");
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const r2RangeEarly = parseRangeHeader(context.request.headers.get("range"));

  const requestCacheControl = (
    context.request.headers.get("cache-control") || ""
  ).toLowerCase();
  const bypassCache =
    Boolean(r2RangeEarly) ||
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

  const candidateKeys = [`assets/${tail}`, tail, `assets/data/${tail}`];
  addCaseFallbackCandidates(candidateKeys, tail);

  let obj: R2Object | null = null;
  let key = "";
  for (const candidate of candidateKeys) {
    // eslint-disable-next-line no-await-in-loop
    const hit = await bucket.get(
      candidate,
      r2RangeEarly ? { range: r2RangeEarly } : undefined,
    );
    if (hit) {
      obj = hit;
      key = candidate;
      break;
    }
  }

  if (!obj) {
    const hostname = url.hostname;
    const isLocalhost = hostname === "127.0.0.1" || hostname === "localhost";
    const publicBase =
      context.env.R2_PUBLIC_BASE_URL ?
        String(context.env.R2_PUBLIC_BASE_URL)
      : "";
    if (isLocalhost && publicBase) {
      const remote = await tryFetchRemote(
        candidateKeys,
        publicBase,
        isVersioned,
      );
      if (remote) return remote;
    }
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
        "Cache-Control": cacheControlForKey(key, isVersioned),
        "Cache-Tag": buildCacheTagHeader(key),
      },
    });
  }

  const rangeForResponse =
    (
      r2RangeEarly &&
      (r2RangeEarly.offset !== undefined || r2RangeEarly.suffix !== undefined)
    ) ?
      {
        offset: r2RangeEarly.offset,
        length: r2RangeEarly.length,
        suffix: r2RangeEarly.suffix,
        total: obj.size,
      }
    : null;
  const response = buildObjectResponse(
    obj,
    key,
    "MISS",
    isVersioned,
    rangeForResponse,
  );
  const respCacheControl = (
    response.headers.get("cache-control") || ""
  ).toLowerCase();
  const shouldCache =
    !bypassCache &&
    Boolean(cache) &&
    (response.status === 200 || response.status === 206) &&
    respCacheControl.includes("public") &&
    !respCacheControl.includes("no-store");

  if (shouldCache && cache) {
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}
