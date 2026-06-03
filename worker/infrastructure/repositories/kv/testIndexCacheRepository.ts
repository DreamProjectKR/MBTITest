import type { KVNamespace } from "../../../_types.ts";

export const TEST_INDEX_CACHE_KEY = "tests:index";

export async function readTestIndexCache(
  kv: KVNamespace,
): Promise<{ etag?: string; body?: { tests: unknown[] } } | null> {
  const raw = await kv.get(TEST_INDEX_CACHE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as { etag?: string; body?: { tests: unknown[] } };
}

export async function writeTestIndexCache(
  kv: KVNamespace,
  value: { etag?: string; body?: { tests: unknown[] } },
): Promise<void> {
  await kv.put(TEST_INDEX_CACHE_KEY, JSON.stringify(value), {
    expirationTtl: 300,
  });
}

export async function deleteTestIndexCache(kv: KVNamespace): Promise<void> {
  await kv.delete(TEST_INDEX_CACHE_KEY);
}
