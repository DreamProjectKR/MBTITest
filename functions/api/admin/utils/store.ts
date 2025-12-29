const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const INDEX_KEY = "assets/index.json";

export const JSON_HEADERS = {
  "Content-Type": JSON_CONTENT_TYPE,
};

export function getTestKey(testId: string): string {
  return `assets/${testId}/test.json`;
}

export function getImagesPrefix(testId: string): string {
  return `assets/${testId}/images/`;
}

export function formatIndexDate(date = new Date()) {
  return new Date(date).toISOString().split("T")[0];
}

export async function readIndex(bucket: any): Promise<any> {
  const obj = await bucket.get(INDEX_KEY);
  if (!obj) {
    return { tests: [] };
  }
  const text = await obj.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error("index.json is not valid JSON.");
  }
}

export async function writeIndex(bucket: any, payload: any): Promise<void> {
  await bucket.put(INDEX_KEY, JSON.stringify(payload, null, 2), {
    httpMetadata: { contentType: JSON_CONTENT_TYPE },
  });
}

export function buildIndexWithMeta(index: any, meta: any): any {
  const tests = Array.isArray(index?.tests) ? [...index.tests] : [];
  const existingIndex = tests.findIndex((entry) => entry?.id === meta.id);
  if (existingIndex === -1) {
    tests.push(meta);
  } else {
    tests[existingIndex] = meta;
  }
  return { ...index, tests };
}

export function createMetaFromTest(test: any, existingMeta: any): any {
  const now = formatIndexDate();
  return {
    id: test.id,
    title: test.title || existingMeta?.title || "제목 없는 테스트",
    thumbnail: test.thumbnail || existingMeta?.thumbnail || "",
    tags: Array.isArray(test.tags)
      ? [...test.tags]
      : Array.isArray(existingMeta?.tags)
      ? [...existingMeta.tags]
      : [],
    path: `${test.id}/test.json`,
    createdAt: existingMeta?.createdAt || now,
    updatedAt: now,
  };
}

export async function readTest(bucket: any, testId: string): Promise<any | null> {
  const key = getTestKey(testId);
  const obj = await bucket.get(key);
  if (!obj) return null;
  const text = await obj.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Test JSON at ${key} is not valid JSON.`);
  }
}

export async function writeTest(bucket: any, testId: string, test: any): Promise<void> {
  const key = getTestKey(testId);
  await bucket.put(key, JSON.stringify(test, null, 2), {
    httpMetadata: { contentType: JSON_CONTENT_TYPE },
  });
}

