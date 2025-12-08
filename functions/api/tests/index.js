const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });

async function readJsonFromR2(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  const text = await obj.text();
  return JSON.parse(text);
}

async function fetchPublicJson(base, path) {
  if (!base) return null;
  const url = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export async function onRequestGet({ env }) {
  try {
    const data =
      (await readJsonFromR2(env.MBTI_BUCKET, 'assets/index.json')) ||
      (await fetchPublicJson(env.ASSETS_BASE, 'assets/index.json'));
    if (!data) return jsonResponse({ error: 'not found' }, 404);
    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ error: 'internal_error', detail: String(err) }, 500);
  }
}
