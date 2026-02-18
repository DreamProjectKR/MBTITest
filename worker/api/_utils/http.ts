import type { HeadersInit } from "../../_types";

/** Shared headers (immutable). */
export const JSON_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/json; charset=utf-8",
};

export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  ...JSON_HEADERS,
  "Cache-Control": "no-store",
};

/** Access Cache API (edge); null when unavailable. */
export function getDefaultCache(): Cache | null {
  const cachesApi = globalThis.caches as { default?: Cache } | undefined;
  return cachesApi?.default ?? null;
}

/** Pure: build cache key Request for GET by URL. */
export function cacheKeyForGet(url: URL): Request {
  const keyUrl = new URL(url.origin + url.pathname);
  return new Request(keyUrl.toString(), { method: "GET" });
}

/** Pure: build Headers with Cache-Control and optional ETag. */
export function withCacheHeaders(
  headers: HeadersInit,
  opts?: {
    etag?: string;
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
  },
): Headers {
  const { etag, maxAge = 60, sMaxAge, staleWhileRevalidate } = opts ?? {};
  const swr =
    (
      typeof staleWhileRevalidate === "number" &&
      Number.isFinite(staleWhileRevalidate)
    ) ?
      Math.max(0, Math.floor(staleWhileRevalidate))
    : maxAge * 10;
  const h = new Headers(headers);
  const sie =
    typeof sMaxAge === "number" && Number.isFinite(sMaxAge) ?
      sMaxAge
    : maxAge * 5;
  const parts = [
    "public",
    `max-age=${maxAge}`,
    ...(typeof sMaxAge === "number" && Number.isFinite(sMaxAge) ?
      [`s-maxage=${Math.max(0, Math.floor(sMaxAge))}`]
    : []),
    `stale-while-revalidate=${swr}`,
    `stale-if-error=${Math.max(0, Math.floor(sie))}`,
  ];
  h.set("Cache-Control", parts.join(", "));
  h.set("Vary", "Accept-Encoding");
  if (etag) h.set("ETag", etag);
  return h;
}

/** Pure: JSON Response with status and headers. */
export function jsonResponse(
  payload: unknown,
  init?: { status?: number; headers?: HeadersInit },
): Response {
  const status = init?.status ?? 200;
  const headers = init?.headers ?? JSON_HEADERS;
  return new Response(JSON.stringify(payload), { status, headers });
}

/** Pure: JSON Response with no-store. */
export function noStoreJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: NO_STORE_HEADERS,
  });
}
