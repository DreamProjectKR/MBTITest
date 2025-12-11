function getPathParam(params) {
  const v = params?.path;
  // Pages Functions "multipath segments" param is a string that may include slashes.
  return v ? String(v) : "";
}

function guessContentType(key) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (lower.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function cacheControlForKey(key) {
  const lower = key.toLowerCase();
  // json은 자주 갱신될 수 있어 짧게, 나머지는 길게 캐시(immutable)
  if (lower.endsWith(".json")) return "public, max-age=60";
  return "public, max-age=31536000, immutable";
}

export async function onRequestGet(context) {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return new Response("MBTI_BUCKET binding missing.", { status: 500 });

  const tail = getPathParam(context.params).replace(/^\/+/, "");
  if (!tail) return new Response("Not Found", { status: 404 });

  const candidateKeys = [
    // Most common: keys stored under "assets/..."
    `assets/${tail}`,
    // Fallback: keys stored without "assets/" prefix
    tail,
    // Legacy: some setups store under "assets/data/..."
    `assets/data/${tail}`,
  ];

  let obj = null;
  let key = "";
  for (const candidate of candidateKeys) {
    // eslint-disable-next-line no-await-in-loop
    const hit = await bucket.get(candidate);
    if (hit) {
      obj = hit;
      key = candidate;
      break;
    }
  }
  if (!obj) return new Response("Not Found", { status: 404 });

  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (ifNoneMatch && obj.etag && ifNoneMatch === obj.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: obj.etag,
        "Cache-Control": cacheControlForKey(key),
      },
    });
  }

  const headers = new Headers();
  headers.set("ETag", obj.etag || "");
  headers.set("Cache-Control", cacheControlForKey(key));
  headers.set(
    "Content-Type",
    obj.httpMetadata?.contentType || guessContentType(key),
  );
  headers.set("X-MBTI-R2-Key", key);

  // R2의 httpMetadata/cacheControl이 있다면 존중
  if (obj.httpMetadata?.cacheControl)
    headers.set("Cache-Control", obj.httpMetadata.cacheControl);

  return new Response(obj.body, { status: 200, headers });
}
