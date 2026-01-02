import { JSON_HEADERS, getImagesPrefix } from "../../utils/store.js";

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function methodNotAllowed() {
  return createJsonResponse({ error: "Method not allowed." }, 405);
}

function badRequest(message) {
  return createJsonResponse({ error: message }, 400);
}

function extensionFromMime(mimeType = "") {
  const type = String(mimeType || "").toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/svg+xml") return "svg";
  return "png";
}

function sanitizeBaseName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // Keep simple URL-safe-ish names.
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

async function extractUpload(context) {
  const contentType = context.request.headers.get("content-type") || "";
  const isMultipart = contentType.toLowerCase().startsWith("multipart/form-data");
  if (isMultipart) {
    const formData = await context.request.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    if (!file || typeof file.arrayBuffer !== "function") return null;
    const buffer = await file.arrayBuffer();
    return { buffer, contentType: file.type || contentType, name: name ? String(name) : "" };
  }

  const buffer = await context.request.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return null;
  return { buffer, contentType: contentType || "image/png", name: "" };
}

export async function onRequestGet(context) {
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

export async function onRequestPut(context) {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return createJsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      500,
    );

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return badRequest("Missing test id.");

  let upload;
  try {
    upload = await extractUpload(context);
  } catch (err) {
    return badRequest("Unable to parse uploaded file.");
  }
  if (!upload) return badRequest("File upload required.");

  const ext = extensionFromMime(upload.contentType);
  const base =
    sanitizeBaseName(upload.name) ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `img-${Date.now()}`);

  const prefix = getImagesPrefix(testId);
  const key = `${prefix}${base}.${ext}`;

  try {
    await bucket.put(key, new Uint8Array(upload.buffer), {
      httpMetadata: { contentType: upload.contentType },
    });
  } catch (err) {
    return createJsonResponse(
      { error: err instanceof Error ? err.message : "Failed to upload image." },
      500,
    );
  }

  const path = key; // includes `assets/...`
  const publicPath = key.replace(/^assets\/?/i, "");

  return createJsonResponse({
    ok: true,
    key,
    path,
    url: `/assets/${publicPath}`,
  });
}
