import type { PagesContext } from "../../../types/bindings.d.ts";
import { getImagesPrefix } from "../../utils/store.js";
import { requireBucket } from "../../../utils/bindings.js";
import { errorResponse, jsonResponse, methodNotAllowed } from "../../../utils/http.js";

export async function onRequestGet(context: PagesContext<{ id?: string }>) {
  if (context.request.method !== "GET") return methodNotAllowed();
  const bucket = requireBucket(context);
  if (bucket instanceof Response) return bucket;

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return errorResponse("Missing test id.", 400);

  try {
    const prefix = getImagesPrefix(testId);
    const listing = await bucket.list({ prefix });
    const objects = Array.isArray(listing.objects) ? listing.objects : [];
    const items = objects.map((obj) => {
      const key = obj?.key ?? "";
      const path = key.replace(/^assets\/?/i, "");
      return {
        key,
        path,
        url: `/assets/${path}`,
        size: obj?.size ?? 0,
        etag: obj?.etag ?? "",
        lastModified: obj?.uploaded ?? null,
      };
    });
    return jsonResponse({ items });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to list images.",
      500,
    );
  }
}
