import type { KVNamespace } from "../../_types.ts";

import { noStoreJsonResponse } from "./http.ts";

/** Fixed-window counter per IP; tunable via docs. */
export const RATE_COMPUTE_PER_WINDOW = 10;
export const RATE_COMPUTE_WINDOW_SEC = 60;

export const RATE_IMAGE_PUT_PER_WINDOW = 30;
export const RATE_IMAGE_PUT_WINDOW_SEC = 60;

function clientIdFromRequest(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * Returns 429 JSON if over limit; null if allowed or KV missing (fail-open for local dev).
 */
export async function rateLimitOr429(
  kv: KVNamespace | undefined,
  request: Request,
  options: {
    routeKey: string;
    limit: number;
    windowSec: number;
  },
): Promise<Response | null> {
  if (!kv) return null;

  const windowSec = Math.max(1, options.windowSec);
  const limit = Math.max(1, options.limit);
  const client = clientIdFromRequest(request);
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const key = `ratelimit:v1:${options.routeKey}:${client}:${bucket}`;

  const raw = await kv.get(key);
  const count = raw ? Number.parseInt(raw, 10) || 0 : 0;
  if (count >= limit) {
    return noStoreJsonResponse({ error: "Too many requests." }, 429);
  }

  await kv.put(key, String(count + 1), {
    expirationTtl: windowSec * 2 + 10,
  });
  return null;
}
