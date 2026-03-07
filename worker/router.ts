import { getRouteDescriptor, matchRoute } from "./http/routes.ts";

export type RouteMatch = { route: string; params: Record<string, string> };

export function parsePath(pathname: string): RouteMatch {
  return matchRoute(pathname);
}

export type CfCacheOptions = {
  cacheTtl: number;
  cacheEverything: true;
  cacheTags: string[];
};

/** Pure: route + params → Tiered Cache options or null. */
export function getTieredCacheCf(
  route: string,
  params: Record<string, string>,
): CfCacheOptions | null {
  return getRouteDescriptor(route)?.tieredCache(params) ?? null;
}
