import type { MbtiEnv, PagesContext } from "../_types.ts";

import {
  onRequestGet as adminTestGet,
  onRequestPut as adminTestPut,
} from "../api/admin/tests/[id].ts";
import { onRequestGet as adminImagesGet } from "../api/admin/tests/[id]/images.ts";
import { onRequestPut as adminImagesPut } from "../api/admin/tests/[id]/images.ts";
import { onRequestPut as adminResultImagePut } from "../api/admin/tests/[id]/results/[mbti]/image.ts";
import { onRequestGet as adminTestsIndexGet } from "../api/admin/tests/index.ts";
import { onRequestGet as testsIdGet } from "../api/tests/[id].ts";
import { onRequestPost as computePost } from "../api/tests/[id]/compute.ts";
import { onRequestGet as testsIndexGet } from "../api/tests/index.ts";
import { handleAssetsGet } from "../assets/handler.ts";

export type RouteParams = Record<string, string>;
export type RouteHandler = (
  context: PagesContext<MbtiEnv>,
) => Promise<Response>;
export type RouteMatch = { route: string; params: RouteParams };
export type CfCacheOptions = {
  cacheTtl: number;
  cacheEverything: true;
  cacheTags: string[];
};

type HttpMethod = "GET" | "POST" | "PUT";

export type RouteDescriptor = {
  route: string;
  match: (segments: string[]) => RouteParams | null;
  methods: Partial<Record<HttpMethod, RouteHandler>>;
  tieredCache: (params: RouteParams) => CfCacheOptions | null;
};

function splitPath(pathname: string): string[] {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  return trimmed ? trimmed.split("/") : [];
}

function staticMatch(
  expected: string[],
): (segments: string[]) => RouteParams | null {
  return (segments) => {
    if (segments.length !== expected.length) return null;
    for (let i = 0; i < expected.length; i += 1) {
      if (segments[i] !== expected[i]) return null;
    }
    return {};
  };
}

export const routeDescriptors: RouteDescriptor[] = [
  {
    route: "api/tests",
    match: staticMatch(["api", "tests"]),
    methods: { GET: testsIndexGet },
    tieredCache: () => ({
      cacheTtl: 300,
      cacheEverything: true,
      cacheTags: ["api", "api-tests"],
    }),
  },
  {
    route: "api/tests/:id",
    match: (segments) =>
      (
        segments.length === 3 &&
        segments[0] === "api" &&
        segments[1] === "tests" &&
        segments[2]
      ) ?
        { id: segments[2] }
      : null,
    methods: { GET: testsIdGet },
    tieredCache: (params) =>
      params.id ?
        {
          cacheTtl: 600,
          cacheEverything: true,
          cacheTags: ["api", "api-tests", `test-${params.id}`],
        }
      : null,
  },
  {
    route: "api/tests/:id/compute",
    match: (segments) =>
      (
        segments.length === 4 &&
        segments[0] === "api" &&
        segments[1] === "tests" &&
        segments[2] &&
        segments[3] === "compute"
      ) ?
        { id: segments[2] }
      : null,
    methods: { POST: computePost },
    tieredCache: () => null,
  },
  {
    route: "api/admin/tests",
    match: staticMatch(["api", "admin", "tests"]),
    methods: { GET: adminTestsIndexGet },
    tieredCache: () => null,
  },
  {
    route: "api/admin/tests/:id",
    match: (segments) =>
      (
        segments.length === 4 &&
        segments[0] === "api" &&
        segments[1] === "admin" &&
        segments[2] === "tests" &&
        segments[3]
      ) ?
        { id: segments[3] }
      : null,
    methods: { GET: adminTestGet, PUT: adminTestPut },
    tieredCache: () => null,
  },
  {
    route: "api/admin/tests/:id/images",
    match: (segments) =>
      (
        segments.length === 5 &&
        segments[0] === "api" &&
        segments[1] === "admin" &&
        segments[2] === "tests" &&
        segments[3] &&
        segments[4] === "images"
      ) ?
        { id: segments[3] }
      : null,
    methods: { GET: adminImagesGet, PUT: adminImagesPut },
    tieredCache: () => null,
  },
  {
    route: "api/admin/tests/:id/results/:mbti/image",
    match: (segments) =>
      (
        segments.length === 7 &&
        segments[0] === "api" &&
        segments[1] === "admin" &&
        segments[2] === "tests" &&
        segments[3] &&
        segments[4] === "results" &&
        segments[5] &&
        segments[6] === "image"
      ) ?
        { id: segments[3], mbti: segments[5] }
      : null,
    methods: { PUT: adminResultImagePut },
    tieredCache: () => null,
  },
  {
    route: "assets",
    match: (segments) =>
      segments[0] === "assets" ? { path: segments.slice(1).join("/") } : null,
    methods: { GET: handleAssetsGet },
    tieredCache: (params) => {
      const pathSeg = params.path?.split("/")[0];
      const tags = pathSeg ? ["assets", `test-${pathSeg}`] : ["assets"];
      return { cacheTtl: 86400, cacheEverything: true, cacheTags: tags };
    },
  },
];

export function matchRoute(pathname: string): RouteMatch {
  const segments = splitPath(pathname);
  for (const descriptor of routeDescriptors) {
    const params = descriptor.match(segments);
    if (params) {
      return { route: descriptor.route, params };
    }
  }
  return { route: "unknown", params: {} };
}

export function getRouteDescriptor(route: string): RouteDescriptor | null {
  return (
    routeDescriptors.find((descriptor) => descriptor.route === route) ?? null
  );
}
