/**
 * API: `GET /api/tests`
 *
 * Reads the test index from D1 (`mbti_db.tests`) and returns it in the same shape
 * as the legacy `assets/index.json` response: `{ tests: [...] }`.
 */
import type { MbtiEnv, PagesContext } from "../../_types";

import {
  JSON_HEADERS,
  cacheKeyForGet,
  getDefaultCache,
  jsonResponse,
  setServerTiming,
  withCacheHeaders,
} from "../_utils/http";

type TestRow = {
  test_id?: unknown;
  title?: unknown;
  thumbnail_path?: unknown;
  tags_json?: unknown;
  source_path?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  is_published?: unknown;
};

type TestMeta = {
  id: string;
  title: string;
  thumbnail: string;
  tags: string[];
  path: string;
  createdAt: string;
  updatedAt: string;
  is_published: boolean;
};

/** Pure: parse tags_json string to string[]. */
function safeJsonArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ?
        parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** Pure: map D1 row to TestMeta. */
function rowToTestMeta(r: TestRow): TestMeta {
  const tags = safeJsonArray(
    typeof r?.tags_json === "string" ? r.tags_json : "",
  );
  return {
    id: String(r?.test_id ?? ""),
    title: String(r?.title ?? ""),
    thumbnail: r?.thumbnail_path ? String(r.thumbnail_path) : "",
    tags,
    path: r?.source_path ? String(r.source_path) : "",
    createdAt: r?.created_at ? String(r.created_at) : "",
    updatedAt: r?.updated_at ? String(r.updated_at) : "",
    is_published: Boolean(r?.is_published),
  };
}

/** Pure: compute ETag for tests index from list. */
function computeIndexEtag(tests: TestMeta[]): string {
  const maxUpdated = tests.reduce(
    (acc, t) => (t.updatedAt > acc ? t.updatedAt : acc),
    "",
  );
  return `"${tests.length}-${maxUpdated}"`;
}

const CACHE_TAG_API_TESTS = "api,api-tests";

export async function onRequestGet(
  context: PagesContext<MbtiEnv>,
): Promise<Response> {
  const startedAt = performance.now();
  let d1Ms = 0;
  let cacheMs = 0;
  const db = context.env.MBTI_DB;
  if (!db) {
    return jsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const cache = getDefaultCache();
  const url = new URL(context.request.url);
  const cacheKey = cacheKeyForGet(url);
  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (cache) {
    const cacheStart = performance.now();
    const cached = await cache.match(cacheKey);
    cacheMs = performance.now() - cacheStart;
    if (cached) {
      const headers = new Headers(cached.headers);
      const cachedEtag = headers.get("ETag");
      headers.set("X-MBTI-Edge-Cache", "HIT");
      setServerTiming(headers, [
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
  const rows = await db
    .prepare(
      "SELECT test_id, title, thumbnail_path, tags_json, source_path, created_at, updated_at, is_published FROM tests ORDER BY updated_at DESC, test_id ASC",
    )
    .all<TestRow>();
  d1Ms = performance.now() - d1Start;

  const tests: TestMeta[] = (rows?.results ?? []).map(rowToTestMeta);
  const etag = computeIndexEtag(tests);
  if (ifNoneMatch && ifNoneMatch === etag) {
    const headers = withCacheHeaders(JSON_HEADERS, {
      etag,
      maxAge: 30,
      sMaxAge: 300,
      staleWhileRevalidate: 600,
    });
    headers.set("Cache-Tag", CACHE_TAG_API_TESTS);
    headers.set("X-MBTI-Edge-Cache", "MISS");
    setServerTiming(headers, [
      { name: "cache", dur: cacheMs, desc: "MISS" },
      { name: "d1", dur: d1Ms },
      { name: "total", dur: performance.now() - startedAt },
    ]);
    return new Response(null, { status: 304, headers });
  }

  const response = jsonResponse(
    { tests },
    {
      status: 200,
      headers: withCacheHeaders(JSON_HEADERS, {
        etag,
        maxAge: 30,
        sMaxAge: 300,
        staleWhileRevalidate: 600,
      }),
    },
  );
  response.headers.set("Cache-Tag", CACHE_TAG_API_TESTS);
  response.headers.set("X-MBTI-Edge-Cache", "MISS");
  setServerTiming(response.headers, [
    { name: "cache", dur: cacheMs, desc: "MISS" },
    { name: "d1", dur: d1Ms },
    { name: "total", dur: performance.now() - startedAt },
  ]);
  if (cache) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
