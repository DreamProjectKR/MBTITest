/**
 * Asset proxy: `GET /assets/*` (Worker)
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
} from "../_types.ts";

import { getDefaultCache, setServerTiming } from "../api/_utils/http.ts";

type Params = PagesParams & { path?: string | string[] };

// --- Pure helpers (no I/O) ---

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
    return "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400, stale-if-error=86400";
  }
  const isUiImage =
    lower.startsWith("assets/images/") ||
    lower.startsWith("images/") ||
    lower.startsWith("assets/data/images/");
  if (isUiImage) {
    return "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400, stale-if-error=86400";
  }
  return "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=86400";
}

function buildCacheTagHeader(key: string): string {
  const clean = String(key || "").replace(/^\/+/, "");
  const m = clean.match(/^assets\/(test-[^/]+)\//i);
  const tags = m?.[1] ? ["assets", "test", m[1]] : ["assets"];
  return tags.join(",");
}

/** Pure: normalize incoming `/assets/*` tail path to key-safe segments. */
function normalizeAssetTail(rawTail: string): string {
  const raw = String(rawTail || "").trim();
  const noLeading = raw.replace(/^\/+/, "").replace(/^assets\/+/i, "");
  const segments = noLeading
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== "." && segment !== "..");
  return segments.join("/");
}

/** Pure: build canonical + backward-compatible candidate keys. */
function buildAssetLookupKeys(tail: string): string[] {
  const normalized = normalizeAssetTail(tail);
  if (!normalized) return [];
  const canonical = `assets/${normalized}`;
  const keys = [canonical];
  // Legacy fallback: previous datasets stored content under `assets/data/*`.
  if (!normalized.startsWith("data/")) {
    keys.push(`assets/data/${normalized}`);
  }
  // Legacy fallback: some older objects may exist without the `assets/` prefix.
  if (normalized !== canonical) keys.push(normalized);
  return [...new Set(keys)];
}

// --- I/O: remote fetch fallback ---

async function tryFetchRemote(
  candidates: string[],
  publicBase: string,
  isVersioned: boolean,
): Promise<Response | null> {
  const base = publicBase.replace(/\/+$/, "");
  if (!base) return null;

  for (const candidate of candidates) {
    const remoteUrl = `${base}/${candidate.replace(/^\/+/, "")}`;
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
  headers.set("Vary", "Accept-Encoding");
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

// --- Handler: cache → R2 → optional remote fallback ---

export async function handleAssetsGet(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  const startedAt = performance.now();
  let cacheMs = 0;
  let r2Ms = 0;
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
    const cacheStart = performance.now();
    const cached = await cache.match(cacheKey);
    cacheMs = performance.now() - cacheStart;
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("X-MBTI-Edge-Cache", "HIT");
      setServerTiming(headers, [
        { name: "cache", dur: cacheMs, desc: "HIT" },
        { name: "total", dur: performance.now() - startedAt },
      ]);
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

  const candidateKeys = buildAssetLookupKeys(tail);
  if (!candidateKeys.length) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let obj: R2Object | null = null;
  let key = "";
  const r2Start = performance.now();
  for (const candidate of candidateKeys) {
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
  r2Ms = performance.now() - r2Start;

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
      if (remote) {
        const headers = new Headers(remote.headers);
        headers.set("X-MBTI-Edge-Cache", "MISS");
        setServerTiming(headers, [
          { name: "cache", dur: cacheMs, desc: "MISS" },
          { name: "r2", dur: r2Ms, desc: "REMOTE" },
          { name: "total", dur: performance.now() - startedAt },
        ]);
        return new Response(remote.body, { status: remote.status, headers });
      }
    }
    return new Response("Not Found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (ifNoneMatch && obj.etag && ifNoneMatch === obj.etag) {
    const headers = new Headers({
      ETag: obj.etag,
      "Cache-Control": cacheControlForKey(key, isVersioned),
      "Cache-Tag": buildCacheTagHeader(key),
      Vary: "Accept-Encoding",
      "X-MBTI-Edge-Cache": "MISS",
    });
    setServerTiming(headers, [
      { name: "cache", dur: cacheMs, desc: "MISS" },
      { name: "r2", dur: r2Ms },
      { name: "total", dur: performance.now() - startedAt },
    ]);
    return new Response(null, { status: 304, headers });
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
  setServerTiming(response.headers, [
    { name: "cache", dur: cacheMs, desc: "MISS" },
    { name: "r2", dur: r2Ms },
    { name: "total", dur: performance.now() - startedAt },
  ]);
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
