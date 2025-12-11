const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

function withCacheHeaders(headers, { etag, maxAge = 60 } = {}) {
  const h = new Headers(headers);
  h.set(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 10}`,
  );
  if (etag) h.set("ETag", etag);
  return h;
}

function normalizeR2KeyFromIndexPath(rawPath) {
  const str = String(rawPath || "").trim();
  if (!str) return "";
  // index.json은 보통 "test-summer/test.json" 형태로 내려오므로 "assets/"를 보정한다.
  const clean = str.replace(/^\.?\/+/, "");
  return clean.startsWith("assets/") ? clean : `assets/${clean}`;
}

export async function onRequestGet(context) {
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) {
    return new Response(
      JSON.stringify({ error: "R2 binding MBTI_BUCKET is missing." }),
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const id = context.params?.id ? String(context.params.id) : "";
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing test id." }), {
      status: 400,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
    });
  }

  const indexObj = await bucket.get("assets/index.json");
  if (!indexObj) {
    return new Response(
      JSON.stringify({ error: "index.json not found in R2." }),
      {
        status: 404,
        headers: withCacheHeaders(JSON_HEADERS, { maxAge: 5 }),
      },
    );
  }

  let index;
  try {
    index = JSON.parse(await indexObj.text());
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "index.json is invalid JSON." }),
      {
        status: 500,
        headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
      },
    );
  }

  const tests = Array.isArray(index?.tests) ? index.tests : [];
  const meta = tests.find((t) => t?.id === id);
  if (!meta) {
    return new Response(JSON.stringify({ error: "Test not found: " + id }), {
      status: 404,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }),
    });
  }

  const key = normalizeR2KeyFromIndexPath(meta.path);
  if (!key) {
    return new Response(
      JSON.stringify({ error: "Test meta has empty path: " + id }),
      {
        status: 500,
        headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
      },
    );
  }

  const obj = await bucket.get(key);
  if (!obj) {
    return new Response(
      JSON.stringify({ error: "Test JSON not found in R2.", key }),
      {
        status: 404,
        headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }),
      },
    );
  }

  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (ifNoneMatch && obj.etag && ifNoneMatch === obj.etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag: obj.etag, maxAge: 120 }),
    });
  }

  const text = await obj.text();
  return new Response(text, {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, { etag: obj.etag, maxAge: 120 }),
  });
}
