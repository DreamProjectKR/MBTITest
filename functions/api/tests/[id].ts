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
import type { MbtiEnv, PagesContext } from "../../../_types";

import {
  JSON_HEADERS,
  cacheKeyForGet,
  getDefaultCache,
  jsonResponse,
  withCacheHeaders,
} from "../_utils/http";

type Params = { id?: string };

type TestRow = {
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
};

function normalizeR2KeyFromIndexPath(rawPath: string): string {
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

export async function onRequestGet(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) {
    return jsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }
  const db = context.env.mbti_db;
  if (!db) {
    return jsonResponse(
      { error: "D1 binding mbti_db is missing." },
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
  const kv = context.env.MBTI_KV;
  const kvKey = `test:${id}`;
  if (kv) {
    try {
      const cachedRaw = await kv.get(kvKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as {
          etag?: string;
          body?: Record<string, unknown>;
        };
        const cachedEtag = cached?.etag ? String(cached.etag) : "";
        if (ifNoneMatch && cachedEtag && ifNoneMatch === cachedEtag) {
          return new Response(null, {
            status: 304,
            headers: withCacheHeaders(JSON_HEADERS, {
              etag: cachedEtag,
              maxAge: 60,
              sMaxAge: 300,
              staleWhileRevalidate: 1800,
            }),
          });
        }
        if (cached?.body && typeof cached.body === "object") {
          return jsonResponse(cached.body, {
            status: 200,
            headers: withCacheHeaders(JSON_HEADERS, {
              etag: cachedEtag || undefined,
              maxAge: 60,
              sMaxAge: 300,
              staleWhileRevalidate: 1800,
            }),
          });
        }
      }
    } catch {
      // Best effort: continue with D1 + R2 source of truth.
    }
  }

  const row = await db
    .prepare(
      "SELECT test_id, title, description_json, author, author_img_path, thumbnail_path, tags_json, source_path, created_at, updated_at FROM tests WHERE test_id = ?1 LIMIT 1",
    )
    .bind(id)
    .first<TestRow>();

  if (!row?.source_path) {
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

  const obj = await bucket.get(key);
  // Local-dev fallback: if local R2 is empty, fetch from the public R2 URL.
  // This avoids needing to seed local R2 for `/api/tests/:id` to work.
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

  if (!resolvedBodyText) {
    return jsonResponse(
      { error: "Test JSON not found in R2.", key },
      { status: 404, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }) },
    );
  }

  const etag = (() => {
    const d1Updated = row?.updated_at ? String(row.updated_at) : "";
    const r2Etag = resolvedBodyEtag ? String(resolvedBodyEtag) : "";
    return `"${r2Etag}|${d1Updated}"`;
  })();

  const cache = getDefaultCache();
  const url = new URL(context.request.url);
  const cacheKey = cacheKeyForGet(url);

  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, {
        etag,
        maxAge: 60,
        sMaxAge: 300,
        staleWhileRevalidate: 1800,
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

  let bodyJson: unknown = null;
  try {
    bodyJson = JSON.parse(resolvedBodyText) as unknown;
  } catch {
    return jsonResponse(
      { error: "Test JSON is invalid JSON." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const description =
    parseJsonArray(row?.description_json)?.filter(Boolean) ?? null;

  const tags = (() => {
    const parsed = parseJsonArray(row?.tags_json);
    return parsed ?
        parsed.filter((x): x is string => typeof x === "string")
      : [];
  })();

  const merged = {
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
    ...(bodyJson && typeof bodyJson === "object" ?
      (bodyJson as Record<string, unknown>)
    : {}),
  };

  const response = jsonResponse(merged, {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, {
      etag,
      maxAge: 60,
      sMaxAge: 300,
      staleWhileRevalidate: 1800,
    }),
  });
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
