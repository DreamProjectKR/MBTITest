/**
 * Worker API Gateway: handles /api/* and /assets/* only.
 * Routes are configured at the Cloudflare zone level.
 * SOLID: S (routing delegated to router), O (extend via handler imports + route table).
 */
import type { ExecutionContext, MbtiEnv, PagesContext } from "./_types";

import { onRequestPut as adminTestPut } from "./api/admin/tests/[id]";
import { onRequestGet as adminImagesGet } from "./api/admin/tests/[id]/images";
import { onRequestPut as adminImagesPut } from "./api/admin/tests/[id]/images";
import { onRequestPut as adminResultImagePut } from "./api/admin/tests/[id]/results/[mbti]/image";
import { onRequestGet as testsIdGet } from "./api/tests/[id]";
import { onRequestPost as computePost } from "./api/tests/[id]/compute";
import { onRequestGet as testsIndexGet } from "./api/tests/index";
import { handleAssetsGet } from "./assets/handler";
import { getTieredCacheCf, parsePath } from "./router";

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
  params?: Record<string, string>,
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

function isCacheableGetRoute(route: string): boolean {
  return (
    route === "api/tests" || route === "api/tests/:id" || route === "assets"
  );
}

/** Returns cached response from tiered cache or null if not applicable. */
async function tryTieredCache(
  request: Request,
  env: MbtiEnv,
  route: string,
  params: Record<string, string>,
): Promise<Response | null> {
  const cfOptions = getTieredCacheCf(route, params);
  const self = env.SELF;
  if (
    request.method !== "GET" ||
    !cfOptions ||
    !self ||
    !isCacheableGetRoute(route)
  )
    return null;
  const originHeaders = new Headers(request.headers);
  originHeaders.set(ORIGIN_REQUEST_HEADER, "1");
  const originRequest = new Request(request.url, {
    method: "GET",
    headers: originHeaders,
  });
  const response = await self.fetch(originRequest, {
    cf: cfOptions,
  } as RequestInit);
  const ct = (response.headers.get("content-type") || "").toLowerCase();
  const isApiJson = route === "api/tests" || route === "api/tests/:id";
  if (!isApiJson || ct.includes("application/json"))
    return new Response(response.body, response);
  return null;
}

type RouteHandler = (context: PagesContext<MbtiEnv>) => Promise<Response>;

function routeTable(request: Request): Record<string, RouteHandler> {
  const method = request.method;
  return {
    "api/tests": (ctx) =>
      method === "GET" ? testsIndexGet(ctx) : notFound(ctx),
    "api/tests/:id": (ctx) =>
      method === "GET" ? testsIdGet(ctx) : notFound(ctx),
    "api/tests/:id/compute": (ctx) =>
      method === "POST" ? computePost(ctx) : notFound(ctx),
    "api/admin/tests/:id": (ctx) =>
      method === "PUT" ? adminTestPut(ctx) : notFound(ctx),
    "api/admin/tests/:id/images": (ctx) => {
      if (method === "GET") return adminImagesGet(ctx);
      if (method === "PUT") return adminImagesPut(ctx);
      return notFound(ctx);
    },
    "api/admin/tests/:id/results/:mbti/image": (ctx) =>
      method === "PUT" ? adminResultImagePut(ctx) : notFound(ctx),
    assets: (ctx) => handleAssetsGet(ctx),
  };
}

function notFound(_ctx: PagesContext<MbtiEnv>): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
  );
}

export default {
  async fetch(
    request: Request,
    env: MbtiEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      const url = new URL(request.url);
      const { route, params } = parsePath(url.pathname);

      if (request.headers.get(ORIGIN_REQUEST_HEADER) === "1") {
        const context = createContext(request, env, ctx, params);
        const table = routeTable(request);
        const handler =
          table[route] ??
          (() => {
            const assets = env.ASSETS;
            if (assets) return assets.fetch(request);
            return Promise.resolve(
              new Response(JSON.stringify({ error: "Not Found" }), {
                status: 404,
                headers: { "Content-Type": "application/json; charset=utf-8" },
              }),
            );
          });
        return handler(context);
      }

      const cached = await tryTieredCache(request, env, route, params);
      if (cached) return cached;

      const context = createContext(request, env, ctx, params);
      const table = routeTable(request);
      const handler = table[route];
      if (handler) return handler(context);
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return notFound(context);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Internal server error";
      if (err instanceof Error && err.stack)
        console.error("[worker]", message, err.stack);
      else console.error("[worker]", message);
      return new Response(
        JSON.stringify({ error: "An unexpected error occurred." }),
        NO_STORE_JSON,
      );
    }
  },
};
