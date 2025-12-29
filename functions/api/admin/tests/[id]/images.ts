import { JSON_HEADERS, getImagesPrefix } from "../../utils/store.js";

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function methodNotAllowed() {
  return createJsonResponse({ error: "Method not allowed." }, 405);
}

export async function onRequestGet(context: any) {
  if (context.request.method !== "GET") return methodNotAllowed();
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return createJsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      500,
    );

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return createJsonResponse({ error: "Missing test id." }, 400);

  try {
    const prefix = getImagesPrefix(testId);
    const listing = await bucket.list({ prefix });
    const objects = Array.isArray(listing.objects) ? listing.objects : [];
    const items = objects.map((obj: any) => {
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
    return createJsonResponse({ items });
  } catch (err) {
    return createJsonResponse(
      {
        error: err instanceof Error ? err.message : "Failed to list images.",
      },
      500,
    );
  }
}
