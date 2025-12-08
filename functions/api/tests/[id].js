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

export async function onRequestGet({ params, env }) {
  const { id } = params || {};
  if (!id) return jsonResponse({ error: 'missing id' }, 400);

  try {
    // 우선 index에서 경로를 찾고, 없으면 기본 패턴으로 조회
    const index = await readJsonFromR2(env.ASSETS, 'assets/index.json');
    const entry = Array.isArray(index?.tests)
      ? index.tests.find((t) => t.id === id)
      : null;

    const explicitPath = entry?.path
      ? String(entry.path).replace(/^\.?\/?/, '')
      : null;
    const key = explicitPath
      ? `assets/${explicitPath}`
      : `assets/${id}/test.json`;

    const data = await readJsonFromR2(env.ASSETS, key);
    if (!data) return jsonResponse({ error: 'not found' }, 404);
    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ error: 'internal_error', detail: String(err) }, 500);
  }
}
