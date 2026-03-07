/**
 * API: `GET /api/tests`
 *
 * Reads the test index from D1 (`mbti_db.tests`) and returns it in the same shape
 * as the legacy `assets/index.json` response: `{ tests: [...] }`.
 */
import type { HeadersInit, MbtiEnv, PagesContext } from "../../_types.ts";

import { listAdminTestsQuery } from "../../application/queries/listAdminTests.ts";
import { listPublishedTestsQuery } from "../../application/queries/listPublishedTests.ts";
import {
  JSON_HEADERS,
  cacheKeyForGet,
  getDefaultCache,
  jsonResponse,
  noStoreJsonResponse,
  setServerTiming,
  withCacheHeaders,
} from "../_utils/http.ts";

const CACHE_TAG_API_TESTS = "api,api-tests";

type ListTestsOptions = {
  publishedOnly: boolean;
  useCache: boolean;
  headersFactory?: (etag: string) => Headers;
  responseHeaders?: HeadersInit;
};

export async function listTests(
  context: PagesContext<MbtiEnv>,
  options: ListTestsOptions,
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

  const cache = options.useCache ? getDefaultCache() : null;
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
  const data =
    options.publishedOnly ?
      await listPublishedTestsQuery(db)
    : await listAdminTestsQuery(db);
  d1Ms = performance.now() - d1Start;

  const { tests, etag } = data;
  if (ifNoneMatch && ifNoneMatch === etag) {
    const headers =
      options.useCache ?
        (options.headersFactory?.(etag) ??
        withCacheHeaders(JSON_HEADERS, {
          etag,
          maxAge: 30,
          sMaxAge: 300,
          staleWhileRevalidate: 600,
        }))
      : new Headers({
          ...JSON_HEADERS,
          "Cache-Control": "no-store",
          ETag: etag,
        });
    if (options.useCache) {
      headers.set("Cache-Tag", CACHE_TAG_API_TESTS);
      headers.set("X-MBTI-Edge-Cache", "MISS");
    } else {
      headers.set("X-MBTI-Edge-Cache", "BYPASS");
    }
    setServerTiming(headers, [
      {
        name: "cache",
        dur: cacheMs,
        desc: options.useCache ? "MISS" : "BYPASS",
      },
      { name: "d1", dur: d1Ms },
      { name: "total", dur: performance.now() - startedAt },
    ]);
    return new Response(null, { status: 304, headers });
  }

  const response =
    options.useCache ?
      jsonResponse(
        { tests },
        {
          status: 200,
          headers:
            options.headersFactory?.(etag) ??
            withCacheHeaders(JSON_HEADERS, {
              etag,
              maxAge: 30,
              sMaxAge: 300,
              staleWhileRevalidate: 600,
            }),
        },
      )
    : noStoreJsonResponse({ tests });

  if (options.useCache) {
    response.headers.set("Cache-Tag", CACHE_TAG_API_TESTS);
    response.headers.set("X-MBTI-Edge-Cache", "MISS");
  } else {
    response.headers.set("X-MBTI-Edge-Cache", "BYPASS");
  }
  if (options.responseHeaders) {
    const extra = new Headers(options.responseHeaders);
    extra.forEach((value, key) => response.headers.set(key, value));
  }
  setServerTiming(response.headers, [
    { name: "cache", dur: cacheMs, desc: options.useCache ? "MISS" : "BYPASS" },
    { name: "d1", dur: d1Ms },
    { name: "total", dur: performance.now() - startedAt },
  ]);
  if (cache) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export async function onRequestGet(
  context: PagesContext<MbtiEnv>,
): Promise<Response> {
  return listTests(context, { publishedOnly: true, useCache: true });
}
