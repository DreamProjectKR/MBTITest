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
import type { MbtiEnv, PagesContext } from "../../_types.ts";

import { getAdminTestDetailQuery } from "../../application/queries/getAdminTestDetail.ts";
import { getPublicTestDetailQuery } from "../../application/queries/getPublicTestDetail.ts";
import {
  readTestDetailCache,
  writeTestDetailCache,
} from "../../infrastructure/repositories/kv/testDetailCacheRepository.ts";
import {
  JSON_HEADERS,
  cacheKeyForGet,
  getDefaultCache,
  jsonResponse,
  noStoreJsonResponse,
  setServerTiming,
  withCacheHeaders,
} from "../_utils/http.ts";

type Params = { id?: string };

function cacheTagForTest(id: string): string {
  return `api,api-tests,test-${id}`;
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
  if (kv) {
    try {
      const kvStart = performance.now();
      const cached = await readTestDetailCache(kv, id);
      kvMs = performance.now() - kvStart;
      if (cached) {
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

  const queryStart = performance.now();
  const detail =
    options.enforcePublished ?
      await getPublicTestDetailQuery(
        db,
        bucket,
        id,
        context.request.url,
        context.env.R2_PUBLIC_BASE_URL,
      )
    : await getAdminTestDetailQuery(
        db,
        bucket,
        id,
        context.request.url,
        context.env.R2_PUBLIC_BASE_URL,
      );
  d1Ms = performance.now() - queryStart;

  if (detail.kind === "not_found" || detail.kind === "forbidden_draft") {
    return jsonResponse(
      { error: "Test not found: " + id },
      { status: 404, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }) },
    );
  }
  if (detail.kind === "invalid_path") {
    return jsonResponse(
      { error: "Test meta has empty path: " + id },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }
  if (detail.kind === "missing_body") {
    return jsonResponse(
      { error: "Test JSON not found in R2.", key: detail.key },
      { status: 404, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }) },
    );
  }
  if (detail.kind === "invalid_body_json") {
    return jsonResponse(
      { error: "Test JSON is invalid JSON." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const etag = detail.etag;
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

  const response =
    options.useCache ?
      jsonResponse(detail.payload, {
        status: 200,
        headers: withCacheHeaders(JSON_HEADERS, {
          etag,
          maxAge: 60,
          sMaxAge: 600,
          staleWhileRevalidate: 3600,
        }),
      })
    : noStoreJsonResponse(detail.payload);

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
      writeTestDetailCache(kv, id, { etag, body: detail.payload }),
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
