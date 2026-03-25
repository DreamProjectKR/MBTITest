import { noStoreJsonResponse } from "./http.ts";

/** Compute POST JSON: 12 answers + overhead. */
export const MAX_COMPUTE_JSON_BYTES = 32 * 1024;

/** Admin image upload (single file). */
export const MAX_IMAGE_UPLOAD_BYTES = 6 * 1024 * 1024;

export function getContentLength(request: Request): number | null {
  const cl = request.headers.get("content-length");
  if (cl == null) return null;
  const n = Number.parseInt(cl, 10);
  return Number.isFinite(n) ? n : null;
}

export function payloadTooLargeResponse(): Response {
  return noStoreJsonResponse({ error: "Payload too large." }, 413);
}
