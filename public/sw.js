/**
 * Service Worker: serves preloaded testquiz/testresult images from Cache API
 * (mbti-assets) when available, so intro preload is reused after navigation.
 */
const CACHE_NAME = "mbti-assets";

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  const isAsset =
    path.startsWith("/cdn-cgi/image/") || path.startsWith("/assets/");
  if (!isAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request);
      }),
    ),
  );
});
