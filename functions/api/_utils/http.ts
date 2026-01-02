import type { HeadersInit } from "../../_types";

export const JSON_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/json; charset=utf-8",
};

export function withCacheHeaders(
  headers: HeadersInit,
  opts?: { etag?: string; maxAge?: number },
): Headers {
  const { etag, maxAge = 60 } = opts ?? {};
  const h = new Headers(headers);
  h.set(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 10}`,
  );
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


