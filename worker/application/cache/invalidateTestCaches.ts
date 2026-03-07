import type { MbtiEnv, PagesContext } from "../../_types.ts";

import { getDefaultCache } from "../../api/_utils/http.ts";
import {
  deleteTestDetailCache,
  getTestDetailCacheKey,
} from "../../infrastructure/repositories/kv/testDetailCacheRepository.ts";

type CacheContext = Pick<
  PagesContext<MbtiEnv>,
  "env" | "request" | "waitUntil"
>;

/** I/O: invalidate KV + Cache API entries for public test reads. */
export function invalidatePublicTestCaches(
  context: CacheContext,
  testId: string,
): void {
  const kv = context.env.MBTI_KV;
  if (kv) {
    context.waitUntil(deleteTestDetailCache(kv, testId));
  }

  const cache = getDefaultCache();
  if (!cache) return;
  const origin = new URL(context.request.url).origin;
  context.waitUntil(
    cache.delete(new Request(`${origin}/api/tests`, { method: "GET" })),
  );
  context.waitUntil(
    cache.delete(
      new Request(`${origin}/api/tests/${testId}`, { method: "GET" }),
    ),
  );
}

export { getTestDetailCacheKey };
