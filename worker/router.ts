/**
 * Pure routing: pathname → route + params.
 * Single responsibility: parse path only; no I/O, no env.
 */
export type RouteMatch = { route: string; params: Record<string, string> };

export function parsePath(pathname: string): RouteMatch {
  const segments = pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (segments[0] === "api") {
    if (segments[1] === "tests") {
      if (segments.length === 2) return { route: "api/tests", params: {} };
      const id = segments[2];
      if (id && segments.length === 3)
        return { route: "api/tests/:id", params: { id } };
      if (id && segments[3] === "compute" && segments.length === 4)
        return { route: "api/tests/:id/compute", params: { id } };
    }
    if (segments[1] === "admin" && segments[2] === "tests") {
      const id = segments[3];
      if (id && segments.length === 4)
        return { route: "api/admin/tests/:id", params: { id } };
      if (id && segments[4] === "images" && segments.length === 5)
        return { route: "api/admin/tests/:id/images", params: { id } };
      if (
        id &&
        segments[4] === "results" &&
        segments[6] === "image" &&
        segments.length === 7
      )
        return {
          route: "api/admin/tests/:id/results/:mbti/image",
          params: { id, mbti: segments[5] },
        };
    }
  }
  if (segments[0] === "assets") {
    const path = segments.slice(1).join("/");
    return { route: "assets", params: { path } };
  }
  return { route: "unknown", params: {} };
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
  if (route === "api/tests")
    return {
      cacheTtl: 300,
      cacheEverything: true,
      cacheTags: ["api", "api-tests"],
    };
  if (route === "api/tests/:id" && params.id)
    return {
      cacheTtl: 600,
      cacheEverything: true,
      cacheTags: ["api", "api-tests", `test-${params.id}`],
    };
  if (route === "assets") {
    const pathSeg = params.path?.split("/")[0];
    const tags = pathSeg ? ["assets", `test-${pathSeg}`] : ["assets"];
    return { cacheTtl: 86400, cacheEverything: true, cacheTags: tags };
  }
  return null;
}
