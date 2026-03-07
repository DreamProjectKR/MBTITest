import type { KVNamespace } from "../../../_types.ts";

export function getTestDetailCacheKey(testId: string): string {
  return `test:${testId}`;
}

export async function readTestDetailCache(
  kv: KVNamespace,
  testId: string,
): Promise<{ etag?: string; body?: Record<string, unknown> } | null> {
  const raw = await kv.get(getTestDetailCacheKey(testId));
  if (!raw) return null;
  return JSON.parse(raw) as { etag?: string; body?: Record<string, unknown> };
}

export async function writeTestDetailCache(
  kv: KVNamespace,
  testId: string,
  value: { etag?: string; body?: Record<string, unknown> },
): Promise<void> {
  await kv.put(getTestDetailCacheKey(testId), JSON.stringify(value), {
    expirationTtl: 300,
  });
}

export async function deleteTestDetailCache(
  kv: KVNamespace,
  testId: string,
): Promise<void> {
  await kv.delete(getTestDetailCacheKey(testId));
}
