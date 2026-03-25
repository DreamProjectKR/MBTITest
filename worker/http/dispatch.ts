import type { ExecutionContext, MbtiEnv, PagesContext } from "../_types.ts";

import { type RouteParams, getRouteDescriptor, matchRoute } from "./routes.ts";

const ORIGIN_REQUEST_HEADER = "X-Mbti-Origin-Request";

const NO_STORE_JSON = {
  status: 500 as const,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
};

function createContext(
  request: Request,
  env: MbtiEnv,
  ctx: ExecutionContext,
  params?: RouteParams,
): PagesContext<MbtiEnv> {
  return {
    request,
    env,
    params,
    waitUntil(promise: Promise<unknown>) {
      ctx.waitUntil(promise);
    },
  };
}

function notFoundResponse(): Response {
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function tryTieredCache(
  request: Request,
  env: MbtiEnv,
  route: string,
  params: RouteParams,
): Promise<Response | null> {
  if (request.method !== "GET" || !env.SELF) return null;
  const descriptor = getRouteDescriptor(route);
  if (!descriptor) return null;
  const cfOptions = descriptor.tieredCache(params);
  if (!cfOptions) return null;

  const originHeaders = new Headers(request.headers);
  originHeaders.set(ORIGIN_REQUEST_HEADER, "1");
  const originRequest = new Request(request.url, {
    method: "GET",
    headers: originHeaders,
  });
  const response = await env.SELF.fetch(originRequest, {
    cf: cfOptions,
  } as RequestInit);
  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();
  const isApiJson = route === "api/tests" || route === "api/tests/:id";
  if (!isApiJson || contentType.includes("application/json")) {
    return new Response(response.body, response);
  }
  return null;
}

function resolveHandler(
  route: string,
  method: string,
): ((context: PagesContext<MbtiEnv>) => Promise<Response>) | null {
  const descriptor = getRouteDescriptor(route);
  if (!descriptor) return null;
  if (method === "GET") return descriptor.methods.GET ?? null;
  if (method === "POST") return descriptor.methods.POST ?? null;
  if (method === "PUT") return descriptor.methods.PUT ?? null;
  return null;
}

export async function dispatchWorkerRequest(
  request: Request,
  env: MbtiEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { route, params } = matchRoute(url.pathname);

    if (request.headers.get(ORIGIN_REQUEST_HEADER) === "1") {
      const context = createContext(request, env, ctx, params);
      const handler = resolveHandler(route, request.method);
      if (handler) return await handler(context);
      if (env.ASSETS) return await env.ASSETS.fetch(request);
      return notFoundResponse();
    }

    const cached = await tryTieredCache(request, env, route, params);
    if (cached) return cached;

    const context = createContext(request, env, ctx, params);
    const handler = resolveHandler(route, request.method);
    if (handler) return await handler(context);
    if (env.ASSETS) return await env.ASSETS.fetch(request);
    return notFoundResponse();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    if (err instanceof Error && err.stack) {
      console.error("[worker]", message, err.stack);
    } else {
      console.error("[worker]", message);
    }
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      NO_STORE_JSON,
    );
  }
}

export { matchRoute as parsePath };
