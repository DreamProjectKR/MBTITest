import type { HeadersInit } from "../../_types";

export const JSON_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/json; charset=utf-8",
};

export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  ...JSON_HEADERS,
  "Cache-Control": "no-store",
};

/** Returns the default Cache (Cache API) when available in the Cloudflare runtime. */
export function getDefaultCache(): Cache | null {
  const cachesApi = globalThis.caches as { default?: Cache } | undefined;
  return cachesApi?.default ?? null;
}

/** Builds a GET request suitable as Cache API key for the given URL (origin + pathname, no query). */
export function cacheKeyForGet(url: URL): Request {
  const keyUrl = new URL(url.origin + url.pathname);
  return new Request(keyUrl.toString(), { method: "GET" });
}

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
  const parts = [`public`, `max-age=${maxAge}`];
  if (typeof sMaxAge === "number" && Number.isFinite(sMaxAge)) {
    parts.push(`s-maxage=${Math.max(0, Math.floor(sMaxAge))}`);
  }
  parts.push(`stale-while-revalidate=${swr}`);
  const sie =
    typeof sMaxAge === "number" && Number.isFinite(sMaxAge) ?
      sMaxAge
    : maxAge * 5;
  parts.push(`stale-if-error=${Math.max(0, Math.floor(sie))}`);
  h.set("Cache-Control", parts.join(", "));
  h.set("Vary", "Accept-Encoding");
  if (etag) h.set("ETag", etag);
  return h;
}

export function jsonResponse(
  payload: unknown,
  init?: { status?: number; headers?: HeadersInit },
): Response {
  const status = init?.status ?? 200;
  const headers = init?.headers ?? JSON_HEADERS;
  return new Response(JSON.stringify(payload), { status, headers });
}

export function noStoreJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: NO_STORE_HEADERS,
  });
}
