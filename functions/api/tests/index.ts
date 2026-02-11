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

export async function onRequestGet(
  context: PagesContext<MbtiEnv>,
): Promise<Response> {
  const db = context.env.mbti_db;
  if (!db) {
    return jsonResponse(
      { error: "D1 binding mbti_db is missing." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const rows = await db
    .prepare(
      "SELECT test_id, title, thumbnail_path, tags_json, source_path, created_at, updated_at, is_published FROM tests ORDER BY updated_at DESC, test_id ASC",
    )
    .all<TestRow>();

  const tests: TestMeta[] = (rows?.results ?? []).map((r) => {
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
  });

  const etag = (() => {
    const maxUpdated = tests.reduce(
      (acc, t) => (t.updatedAt > acc ? t.updatedAt : acc),
      "",
    );
    return `"${tests.length}-${maxUpdated}"`;
  })();

  const cache = getDefaultCache();
  const url = new URL(context.request.url);
  const cacheKey = cacheKeyForGet(url);

  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, {
        etag,
        maxAge: 30,
        sMaxAge: 60,
        staleWhileRevalidate: 300,
      }),
    });
  }

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      return new Response(cached.body, { status: cached.status, headers });
    }
  }

  const response = jsonResponse(
    { tests },
    {
      status: 200,
      headers: withCacheHeaders(JSON_HEADERS, {
        etag,
        maxAge: 30,
        sMaxAge: 60,
        staleWhileRevalidate: 300,
      }),
    },
  );
  if (cache) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
