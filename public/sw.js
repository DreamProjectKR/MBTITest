/**
 * Service Worker: stale-while-revalidate for same-origin assets.
 * - Fast cached response on repeat visits
 * - Background refresh to keep cache fresh
 * - Versioned cache cleanup on activate
 */
const CACHE_VERSION = "v2";
const CACHE_PREFIX = "mbti-assets";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

function isHandledAssetRequest(requestUrl, request) {
  if (request.method !== "GET") return false;
  if (requestUrl.origin !== self.location.origin) return false;
  if (request.headers.has("range")) return false;
  return (
    requestUrl.pathname.startsWith("/cdn-cgi/image/") ||
    requestUrl.pathname.startsWith("/assets/")
  );
}

function isStorableResponse(response) {
  if (!response) return false;
  if (!(response.status === 200 || response.status === 206)) return false;
  const cacheControl = String(
    response.headers.get("Cache-Control") || "",
  ).toLowerCase();
  return !cacheControl.includes("no-store");
}

async function updateCache(cache, request) {
  try {
    const response = await fetch(request);
    if (isStorableResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return null;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          const isOldAssetCache =
            key.startsWith(`${CACHE_PREFIX}-`) && key !== CACHE_NAME;
          const isLegacyCache = key === CACHE_PREFIX;
          return isOldAssetCache || isLegacyCache ?
              caches.delete(key)
            : Promise.resolve(false);
        }),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (!isHandledAssetRequest(requestUrl, event.request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) {
        event.waitUntil(updateCache(cache, event.request));
        return cached;
      }
      const network = await updateCache(cache, event.request);
      if (network) return network;
      return new Response("Service Unavailable", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    })(),
  );
});
