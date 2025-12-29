import type { JsonValue } from "../types/bindings.d.ts";

export const JSON_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/json; charset=utf-8",
};

export function jsonResponse(
  payload: JsonValue | Record<string, unknown>,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers || JSON_HEADERS);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", JSON_HEADERS["Content-Type"] ?? "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers,
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, { status });
}

export function methodNotAllowed(): Response {
  return errorResponse("Method not allowed.", 405);
}

export function withCacheHeaders(
  headers: HeadersInit,
  opts: { etag?: string; maxAge?: number } = {},
): Headers {
  const { etag, maxAge = 60 } = opts;
  const h = new Headers(headers);
  h.set("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 10}`);
  if (etag) h.set("ETag", etag);
  return h;
}


