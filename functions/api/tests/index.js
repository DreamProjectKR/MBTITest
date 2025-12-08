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

export async function onRequestGet({ env }) {
  try {
    const data = await readJsonFromR2(env.MBTI_BUCKET, 'assets/index.json');
    if (!data) return jsonResponse({ error: 'not found' }, 404);
    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ error: 'internal_error', detail: String(err) }, 500);
  }
}
