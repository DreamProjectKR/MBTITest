/**
 * Worker API Gateway: handles /api/* and /assets/* only.
 * Routes are configured at the Cloudflare zone level.
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

const ORIGIN_REQUEST_HEADER = "X-Mbti-Origin-Request";

const NO_STORE_JSON = {
  status: 500 as const,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
};

type CfCacheOptions = {
  cacheTtl: number;
  cacheEverything: true;
  cacheTags: string[];
};

function getTieredCacheCf(
  route: string,
  params: Record<string, string>,
): CfCacheOptions | null {
  if (route === "api/tests") {
    return {
      cacheTtl: 300,
      cacheEverything: true,
      cacheTags: ["api", "api-tests"],
    };
  }
  if (route === "api/tests/:id" && params.id) {
    return {
      cacheTtl: 600,
      cacheEverything: true,
      cacheTags: ["api", "api-tests", `test-${params.id}`],
    };
  }
  if (route === "assets") {
    const tags = ["assets"];
    const pathSeg = params.path?.split("/")[0];
    if (pathSeg) tags.push(`test-${pathSeg}`);
    return { cacheTtl: 86400, cacheEverything: true, cacheTags: tags };
  }
  return null;
}

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

function parsePath(pathname: string): {
  route: string;
  params: Record<string, string>;
} {
  const segments = pathname.replace(/^\/+|\/+$/g, "").split("/");
  // /api/tests -> route: api/tests, params: {}
  // /api/tests/test-summer -> route: api/tests/:id, params: { id: test-summer }
  // /api/tests/test-summer/compute -> route: api/tests/:id/compute
  // /api/admin/tests/test-summer -> route: api/admin/tests/:id
  // /api/admin/tests/test-summer/images -> route: api/admin/tests/:id/images
  // /api/admin/tests/test-summer/results/ENFP/image -> route: api/admin/tests/:id/results/:mbti/image
  // /assets/foo/bar.jpg -> route: assets, params: { path: foo/bar.jpg }
  if (segments[0] === "api") {
    if (segments[1] === "tests") {
      if (segments.length === 2) {
        return { route: "api/tests", params: {} };
      }
      const id = segments[2];
      if (id && segments.length === 3) {
        return { route: "api/tests/:id", params: { id } };
      }
      if (id && segments[3] === "compute" && segments.length === 4) {
        return { route: "api/tests/:id/compute", params: { id } };
      }
    }
    if (segments[1] === "admin" && segments[2] === "tests") {
      const id = segments[3];
      if (id && segments.length === 4) {
        return { route: "api/admin/tests/:id", params: { id } };
      }
      if (id && segments[4] === "images" && segments.length === 5) {
        return { route: "api/admin/tests/:id/images", params: { id } };
      }
      if (
        id &&
        segments[4] === "results" &&
        segments[6] === "image" &&
        segments.length === 7
      ) {
        return {
          route: "api/admin/tests/:id/results/:mbti/image",
          params: { id, mbti: segments[5] },
        };
      }
    }
  }
  if (segments[0] === "assets") {
    const path = segments.slice(1).join("/");
    return { route: "assets", params: { path } };
  }
  return { route: "unknown", params: {} };
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

      // Origin path: subrequest from fetch(self, cf); handle normally so Tiered Cache is filled.
      if (request.headers.get(ORIGIN_REQUEST_HEADER) === "1") {
        const context = createContext(request, env, ctx, params);
        if (route === "assets") return await handleAssetsGet(context);
        if (route === "api/tests" && request.method === "GET")
          return await testsIndexGet(context);
        if (route === "api/tests/:id" && request.method === "GET")
          return await testsIdGet(context);
        if (route === "api/tests/:id/compute" && request.method === "POST")
          return await computePost(context);
        if (route === "api/admin/tests/:id" && request.method === "PUT")
          return await adminTestPut(context);
        if (route === "api/admin/tests/:id/images") {
          if (request.method === "GET") return await adminImagesGet(context);
          if (request.method === "PUT") return await adminImagesPut(context);
        }
        if (
          route === "api/admin/tests/:id/results/:mbti/image" &&
          request.method === "PUT"
        )
          return await adminResultImagePut(context);
        const assets = env.ASSETS;
        if (assets) return await assets.fetch(request);
        return new Response(JSON.stringify({ error: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }

      // Edge path: cacheable GET → invoke self via SELF binding (so we hit this Worker, not Pages origin) to populate Tiered Cache.
      const cfOptions = getTieredCacheCf(route, params);
      const self = env.SELF;
      if (
        request.method === "GET" &&
        cfOptions &&
        self &&
        (route === "api/tests" ||
          route === "api/tests/:id" ||
          route === "assets")
      ) {
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
        const safeToReturn = !isApiJson || ct.includes("application/json");
        if (safeToReturn) {
          return new Response(response.body, response);
        }
        // SELF returned HTML (e.g. hit origin); fall through to handle directly.
      }

      const context = createContext(request, env, ctx, params);

      if (route === "assets") {
        return await handleAssetsGet(context);
      }

      if (route === "api/tests") {
        if (request.method === "GET") return await testsIndexGet(context);
      }

      if (route === "api/tests/:id") {
        if (request.method === "GET") return await testsIdGet(context);
      }

      if (route === "api/tests/:id/compute") {
        if (request.method === "POST") return await computePost(context);
      }

      if (route === "api/admin/tests/:id") {
        if (request.method === "PUT") return await adminTestPut(context);
      }

      if (route === "api/admin/tests/:id/images") {
        if (request.method === "GET") return await adminImagesGet(context);
        if (request.method === "PUT") return await adminImagesPut(context);
      }

      if (route === "api/admin/tests/:id/results/:mbti/image") {
        if (request.method === "PUT") return await adminResultImagePut(context);
      }

      // Fallback: serve static assets (local dev only; production routes limit to /api, /assets)
      const assets = env.ASSETS;
      if (assets) {
        return await assets.fetch(request);
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
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
  },
};
