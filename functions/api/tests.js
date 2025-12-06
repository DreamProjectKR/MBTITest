const MBTI_CODES = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];

const INDEX_KEY = 'assets/data/index.json';
const DATA_PREFIX = 'assets/data';

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { headers: buildCorsHeaders(request) });
  }

  if (!env.MBTI_BUCKET) {
    return jsonResponse(
      { error: 'R2 버킷 바인딩(MBTI_BUCKET)이 설정되지 않았습니다.' },
      request,
      500,
    );
  }

  try {
    if (method === 'GET') {
      return await handleGet({ request, env });
    }
    if (method === 'POST') {
      return await handlePost({ request, env });
    }
    return jsonResponse({ error: 'Method Not Allowed' }, request, 405);
  } catch (error) {
    console.error('[api/tests] unexpected error', error);
    return jsonResponse({ error: '서버 오류가 발생했습니다.' }, request, 500);
  }
}

async function handleGet({ request, env }) {
  const bucket = env.MBTI_BUCKET;
  const index = await readIndex(bucket);
  const assetBaseUrl = buildAssetBaseUrl(env);

  const tests = await Promise.all(
    (index.tests ?? []).map(async (meta) => {
      const key = `${DATA_PREFIX}/${meta.path}`;
      const object = await bucket.get(key);
      if (!object) {
        console.warn(`[api/tests] missing test file for ${meta.id} at ${key}`);
        return null;
      }
      const testJson = JSON.parse(await object.text());
      return normalizeTest(
        { ...testJson, path: meta.path },
        {
          testPath: meta.path,
          assetBaseUrl,
        },
      );
    }),
  );

  const filtered = tests.filter(Boolean);
  return jsonResponse(
    {
      tests: filtered,
      forumHighlights: index.forumHighlights ?? [],
      assetBaseUrl,
    },
    request,
  );
}

async function handlePost({ request, env }) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse(
      { error: 'multipart/form-data 요청이어야 합니다.' },
      request,
      400,
    );
  }

  const formData = await request.formData();
  const bucket = env.MBTI_BUCKET;
  const assetBaseUrl = buildAssetBaseUrl(env);

  const title = (formData.get('title') || '').toString().trim();
  const description = (formData.get('description') || '').toString().trim();
  const heroAnimation = (formData.get('heroAnimation') || 'pan')
    .toString()
    .trim();
  const rawTags = formData.get('tags');
  const rawQuestions = formData.get('questions');
  const rawResults = formData.get('results');
  const providedId = (formData.get('testId') || '').toString().trim();

  if (!title) {
    return jsonResponse({ error: 'title 필드는 필수입니다.' }, request, 400);
  }

  const testId = ensureTestId(providedId || title);
  const testDir = `${DATA_PREFIX}/${testId}`;
  const imageDir = `${testDir}/images`;

  const tags = parseJsonSafely(rawTags, []);
  const questions = parseJsonSafely(rawQuestions, []);
  const incomingResults = parseJsonSafely(rawResults, {});

  if (!Array.isArray(questions) || !questions.length) {
    return jsonResponse(
      { error: 'questions 배열이 비어 있습니다.' },
      request,
      400,
    );
  }

  const uploadThumbnail = formData.get('thumbnail');
  let thumbnailPath = incomingResults.thumbnail || '';
  if (uploadThumbnail && uploadThumbnail.name) {
    thumbnailPath = await putImage({
      bucket,
      file: uploadThumbnail,
      key: `${imageDir}/thumbnail${inferExt(uploadThumbnail)}`,
      returnPath: `images/thumbnail${inferExt(uploadThumbnail)}`,
      allowEmpty: false,
    });
  }

  const results = {};
  for (const code of MBTI_CODES) {
    const summary = (
      incomingResults?.[code]?.summary ??
      incomingResults?.[code] ??
      ''
    ).toString();
    const file = formData.get(`resultImage_${code}`);
    let imagePath = incomingResults?.[code]?.image ?? '';
    if (file && file.name) {
      imagePath = await putImage({
        bucket,
        file,
        key: `${imageDir}/${code}${inferExt(file)}`,
        returnPath: `images/${code}${inferExt(file)}`,
        allowEmpty: false,
      });
    }

    if (summary || imagePath) {
      results[code] = {
        summary,
        image: imagePath,
      };
    }
  }

  const testJson = {
    id: testId,
    title,
    description,
    tags,
    heroAnimation,
    thumbnail: thumbnailPath,
    questions,
    results,
  };

  await bucket.put(`${testDir}/test.json`, JSON.stringify(testJson, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  await upsertIndex(bucket, {
    id: testId,
    title,
    path: `${testId}/test.json`,
  });

  const normalized = normalizeTest(
    { ...testJson, path: `${testId}/test.json` },
    { testPath: `${testId}/test.json`, assetBaseUrl },
  );

  return jsonResponse({ test: normalized }, request, 201);
}

async function readIndex(bucket) {
  const obj = await bucket.get(INDEX_KEY);
  if (!obj) {
    return { tests: [] };
  }
  return JSON.parse(await obj.text());
}

async function upsertIndex(bucket, entry) {
  const index = await readIndex(bucket);
  const nextTests = Array.isArray(index.tests) ? [...index.tests] : [];
  const existingIndex = nextTests.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    nextTests[existingIndex] = { ...nextTests[existingIndex], ...entry };
  } else {
    nextTests.push(entry);
  }
  const nextIndex = { ...index, tests: nextTests };
  await bucket.put(INDEX_KEY, JSON.stringify(nextIndex, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

function normalizeTest(test, { testPath, assetBaseUrl }) {
  const testDir = testPath?.includes('/')
    ? testPath.substring(0, testPath.lastIndexOf('/'))
    : test.id;
  const base = assetBaseUrl?.replace(/\/$/, '');
  const prefix = base && testDir ? `${base}/${testDir}/` : null;

  const normalized = { ...test, assetBaseUrl };

  if (prefix && normalized.thumbnail?.startsWith('images/')) {
    normalized.thumbnail = `${prefix}${normalized.thumbnail.replace(
      /^images\//,
      '',
    )}`;
  }

  if (prefix && normalized.results) {
    const mapped = {};
    for (const [code, value] of Object.entries(normalized.results)) {
      mapped[code] = {
        ...value,
        image:
          value.image && value.image.startsWith('images/')
            ? `${prefix}${value.image.replace(/^images\//, '')}`
            : value.image,
      };
    }
    normalized.results = mapped;
  }

  return normalized;
}

async function putImage({ bucket, file, key, returnPath, allowEmpty }) {
  if (!file && !allowEmpty) {
    throw new Error('파일이 필요합니다.');
  }
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });
  if (returnPath) return returnPath;
  return key.replace(`${DATA_PREFIX}/`, '').replace(/^\/+/, '');
}

function inferExt(file) {
  if (!file?.name) return '.png';
  const name = file.name.toLowerCase();
  if (name.includes('.')) {
    return name.substring(name.lastIndexOf('.'));
  }
  if (file.type) {
    if (file.type === 'image/svg+xml') return '.svg';
    if (file.type === 'image/jpeg') return '.jpg';
    if (file.type === 'image/png') return '.png';
    if (file.type === 'image/webp') return '.webp';
  }
  return '.png';
}

function ensureTestId(raw) {
  const base = slugify(raw || 'new-test');
  return base.startsWith('test-') ? base : `test-${base}`;
}

function slugify(value) {
  return (
    value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\\-\\s_]/g, '')
      .replace(/[\\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'test'
  );
}

function parseJsonSafely(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function buildAssetBaseUrl(env) {
  const base = env.R2_PUBLIC_BASE_URL || '';
  return base ? base.replace(/\/$/, '') : '';
}

function jsonResponse(body, request, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(request),
    },
  });
}

function buildCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Workers 모드 배포 시 fetch 핸들러를 요구하므로 onRequest를 연결해 준다.
export default {
  async fetch(request, env, ctx) {
    return onRequest({ request, env, context: ctx });
  },
};
