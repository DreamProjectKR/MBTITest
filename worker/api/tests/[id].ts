/**
 * API: `GET /api/tests/:id`
 *
 * Reads the test index row from D1 (`mbti_db.tests`) by `id`,
 * then fetches that test's JSON from R2 (`assets/<path>`) and returns it.
 *
 * Cache behavior:
 * - Supports ETag / If-None-Match
 * - KV + Cache API; strengthened s-maxage / swr
 */
import type { MbtiEnv, PagesContext } from "../../_types";

import {
  JSON_HEADERS,
  cacheKeyForGet,
  getDefaultCache,
  jsonResponse,
  noStoreJsonResponse,
  setServerTiming,
  withCacheHeaders,
} from "../_utils/http";

type Params = { id?: string };

export type TestRow = {
  test_id?: unknown;
  title?: unknown;
  description_json?: unknown;
  author?: unknown;
  author_img_path?: unknown;
  thumbnail_path?: unknown;
  tags_json?: unknown;
  source_path?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  is_published?: unknown;
};

export function normalizeR2KeyFromIndexPath(rawPath: string): string {
  const str = String(rawPath || "").trim();
  if (!str) return "";
  const clean = str.replace(/^\.?\/+/, "");
  return clean.startsWith("assets/") ? clean : `assets/${clean}`;
}

function parseJsonArray(value: unknown): unknown[] | null {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cacheTagForTest(id: string): string {
  return `api,api-tests,test-${id}`;
}

export function isPublishedRow(row: TestRow | null): boolean {
  return Boolean(row?.is_published);
}

export function buildEtag(
  row: TestRow | null,
  resolvedBodyEtag: string | null,
): string {
  const d1Updated = row?.updated_at ? String(row.updated_at) : "";
  const r2Etag = resolvedBodyEtag ? String(resolvedBodyEtag) : "";
  return `"${r2Etag}|${d1Updated}"`;
}

export function buildMergedPayload(
  row: TestRow,
  bodyJson: unknown,
): Record<string, unknown> {
  const description =
    parseJsonArray(row?.description_json)?.filter(Boolean) ?? null;
  const tags = (() => {
    const parsed = parseJsonArray(row?.tags_json);
    return parsed ?
        parsed.filter((x): x is string => typeof x === "string")
      : [];
  })();
  return {
    id: String(row.test_id ?? ""),
    title: row.title ? String(row.title) : "",
    description,
    author: row.author ? String(row.author) : "",
    authorImg: row.author_img_path ? String(row.author_img_path) : "",
    thumbnail: row.thumbnail_path ? String(row.thumbnail_path) : "",
    tags,
    path: row.source_path ? String(row.source_path) : "",
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
    isPublished: isPublishedRow(row),
    ...(bodyJson && typeof bodyJson === "object" ?
      (bodyJson as Record<string, unknown>)
    : {}),
  };
}

type LoadTestDetailOptions = {
  enforcePublished: boolean;
  useCache: boolean;
};

export async function loadTestDetail(
  context: PagesContext<MbtiEnv, Params>,
  options: LoadTestDetailOptions,
): Promise<Response> {
  const startedAt = performance.now();
  let kvMs = 0;
  let cacheMs = 0;
  let d1Ms = 0;
  let r2Ms = 0;
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) {
    return jsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }
  const db = context.env.MBTI_DB;
  if (!db) {
    return jsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const id = context.params?.id ? String(context.params.id) : "";
  if (!id) {
    return jsonResponse(
      { error: "Missing test id." },
      { status: 400, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }
  const ifNoneMatch = context.request.headers.get("if-none-match");
  const cache = options.useCache ? getDefaultCache() : null;
  const url = new URL(context.request.url);
  const cacheKey = cacheKeyForGet(url);

  const kv = options.useCache ? context.env.MBTI_KV : undefined;
  const kvKey = `test:${id}`;
  if (kv) {
    try {
      const kvStart = performance.now();
      const cachedRaw = await kv.get(kvKey);
      kvMs = performance.now() - kvStart;
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as {
          etag?: string;
          body?: Record<string, unknown>;
        };
        const cachedEtag = cached?.etag ? String(cached.etag) : "";
        if (ifNoneMatch && cachedEtag && ifNoneMatch === cachedEtag) {
          const headers = withCacheHeaders(JSON_HEADERS, {
            etag: cachedEtag,
            maxAge: 60,
            sMaxAge: 600,
            staleWhileRevalidate: 3600,
          });
          headers.set("Cache-Tag", cacheTagForTest(id));
          headers.set("X-MBTI-Edge-Cache", "BYPASS");
          setServerTiming(headers, [
            { name: "kv", dur: kvMs, desc: "HIT" },
            { name: "cache", dur: cacheMs, desc: "BYPASS" },
            { name: "total", dur: performance.now() - startedAt },
          ]);
          return new Response(null, { status: 304, headers });
        }
        if (cached?.body && typeof cached.body === "object") {
          const headers = withCacheHeaders(JSON_HEADERS, {
            etag: cachedEtag || undefined,
            maxAge: 60,
            sMaxAge: 600,
            staleWhileRevalidate: 3600,
          });
          headers.set("Cache-Tag", cacheTagForTest(id));
          headers.set("X-MBTI-Edge-Cache", "BYPASS");
          setServerTiming(headers, [
            { name: "kv", dur: kvMs, desc: "HIT" },
            { name: "cache", dur: cacheMs, desc: "BYPASS" },
            { name: "total", dur: performance.now() - startedAt },
          ]);
          return jsonResponse(cached.body, { status: 200, headers });
        }
      }
    } catch {
      // Best effort: continue with D1 + R2 source of truth.
    }
  }

  if (cache) {
    const cacheStart = performance.now();
    const cached = await cache.match(cacheKey);
    cacheMs = performance.now() - cacheStart;
    if (cached) {
      const headers = new Headers(cached.headers);
      const cachedEtag = headers.get("ETag");
      headers.set("X-MBTI-Edge-Cache", "HIT");
      setServerTiming(headers, [
        { name: "kv", dur: kvMs, desc: kvMs > 0 ? "MISS" : "BYPASS" },
        { name: "cache", dur: cacheMs, desc: "HIT" },
        { name: "total", dur: performance.now() - startedAt },
      ]);
      if (ifNoneMatch && cachedEtag && ifNoneMatch === cachedEtag) {
        return new Response(null, { status: 304, headers });
      }
      return new Response(cached.body, { status: cached.status, headers });
    }
  }

  const d1Start = performance.now();
  const row = await db
    .prepare(
      "SELECT test_id, title, description_json, author, author_img_path, thumbnail_path, tags_json, source_path, created_at, updated_at, is_published FROM tests WHERE test_id = ?1 LIMIT 1",
    )
    .bind(id)
    .first<TestRow>();
  d1Ms = performance.now() - d1Start;

  if (!row?.source_path) {
    return jsonResponse(
      { error: "Test not found: " + id },
      { status: 404, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }) },
    );
  }
  if (options.enforcePublished && !isPublishedRow(row)) {
    return jsonResponse(
      { error: "Test not found: " + id },
      { status: 404, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }) },
    );
  }

  const key = normalizeR2KeyFromIndexPath(String(row.source_path));
  if (!key) {
    return jsonResponse(
      { error: "Test meta has empty path: " + id },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const r2Start = performance.now();
  const obj = await bucket.get(key);
  const requestHost = new URL(context.request.url).hostname;
  const isLocalhost =
    requestHost === "localhost" || requestHost === "127.0.0.1";
  const publicBase =
    context.env.R2_PUBLIC_BASE_URL ?
      String(context.env.R2_PUBLIC_BASE_URL).replace(/\/+$/, "")
    : "";

  let resolvedBodyText: string | null = null;
  let resolvedBodyEtag: string | null = null;

  if (obj) {
    resolvedBodyText = await obj.text();
    resolvedBodyEtag = obj.etag ? String(obj.etag) : null;
  } else if (isLocalhost && publicBase) {
    const remoteUrl = `${publicBase}/${key.replace(/^\/+/, "")}`;
    const resp = await fetch(remoteUrl);
    if (resp.ok) {
      resolvedBodyText = await resp.text();
      resolvedBodyEtag = resp.headers.get("etag");
    }
  }
  r2Ms = performance.now() - r2Start;

  if (!resolvedBodyText) {
    return jsonResponse(
      { error: "Test JSON not found in R2.", key },
      { status: 404, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }) },
    );
  }

  const etag = buildEtag(row, resolvedBodyEtag);
  if (ifNoneMatch && ifNoneMatch === etag) {
    const headers =
      options.useCache ?
        withCacheHeaders(JSON_HEADERS, {
          etag,
          maxAge: 60,
          sMaxAge: 600,
          staleWhileRevalidate: 3600,
        })
      : new Headers({
          ...JSON_HEADERS,
          "Cache-Control": "no-store",
          ETag: etag,
        });
    if (options.useCache) {
      headers.set("Cache-Tag", cacheTagForTest(id));
      headers.set("X-MBTI-Edge-Cache", "MISS");
    } else {
      headers.set("X-MBTI-Edge-Cache", "BYPASS");
    }
    setServerTiming(headers, [
      {
        name: "kv",
        dur: kvMs,
        desc:
          options.useCache ?
            kvMs > 0 ?
              "MISS"
            : "BYPASS"
          : "BYPASS",
      },
      {
        name: "cache",
        dur: cacheMs,
        desc: options.useCache ? "MISS" : "BYPASS",
      },
      { name: "d1", dur: d1Ms },
      { name: "r2", dur: r2Ms },
      { name: "total", dur: performance.now() - startedAt },
    ]);
    return new Response(null, { status: 304, headers });
  }

  let bodyJson: unknown = null;
  try {
    bodyJson = JSON.parse(resolvedBodyText) as unknown;
  } catch {
    return jsonResponse(
      { error: "Test JSON is invalid JSON." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const merged = buildMergedPayload(row, bodyJson);
  const response =
    options.useCache ?
      jsonResponse(merged, {
        status: 200,
        headers: withCacheHeaders(JSON_HEADERS, {
          etag,
          maxAge: 60,
          sMaxAge: 600,
          staleWhileRevalidate: 3600,
        }),
      })
    : noStoreJsonResponse(merged);

  if (options.useCache) {
    response.headers.set("Cache-Tag", cacheTagForTest(id));
    response.headers.set("X-MBTI-Edge-Cache", "MISS");
  } else {
    response.headers.set("X-MBTI-Edge-Cache", "BYPASS");
  }
  setServerTiming(response.headers, [
    {
      name: "kv",
      dur: kvMs,
      desc:
        options.useCache ?
          kvMs > 0 ?
            "MISS"
          : "BYPASS"
        : "BYPASS",
    },
    {
      name: "cache",
      dur: cacheMs,
      desc: options.useCache ? "MISS" : "BYPASS",
    },
    { name: "d1", dur: d1Ms },
    { name: "r2", dur: r2Ms },
    { name: "total", dur: performance.now() - startedAt },
  ]);
  if (kv) {
    context.waitUntil(
      kv.put(kvKey, JSON.stringify({ etag, body: merged }), {
        expirationTtl: 300,
      }),
    );
  }
  if (cache) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export async function onRequestGet(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  return loadTestDetail(context, { enforcePublished: true, useCache: true });
}
