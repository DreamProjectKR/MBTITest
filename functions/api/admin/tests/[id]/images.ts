import type { MbtiEnv, PagesContext } from "../../../../_types";
import {
  JSON_HEADERS,
  getImagesPrefix,
  listTestImageMeta,
  upsertTestImageMeta,
} from "../../utils/store.js";

type Params = { id?: string };

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function methodNotAllowed(): Response {
  return json({ error: "Method not allowed." }, 405);
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function extensionFromMime(mimeType = ""): string {
  const type = String(mimeType || "").toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/svg+xml") return "svg";
  return "png";
}

function sanitizeBaseName(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function inferImageType(baseName: string): string {
  const base = String(baseName || "")
    .trim()
    .toLowerCase();
  if (base === "thumbnail") return "thumbnail";
  if (base === "author") return "author";
  if (/^q\d{1,2}$/i.test(baseName)) return "question";
  if (/^[ei][ns][tf][jp]$/i.test(baseName)) return "result";
  return "misc";
}

async function extractUpload(
  context: PagesContext<MbtiEnv, Params>,
): Promise<{ buffer: ArrayBuffer; contentType: string; name: string } | null> {
  const contentType = context.request.headers.get("content-type") || "";
  const isMultipart = contentType
    .toLowerCase()
    .startsWith("multipart/form-data");
  if (isMultipart) {
    const formData = await context.request.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    if (!file || typeof (file as File).arrayBuffer !== "function") return null;
    const buffer = await (file as File).arrayBuffer();
    return {
      buffer,
      contentType: (file as File).type || contentType,
      name: name ? String(name) : "",
    };
  }

  const buffer = await context.request.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return null;
  return { buffer, contentType: contentType || "image/png", name: "" };
}

export async function onRequestGet(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  if (context.request.method !== "GET") return methodNotAllowed();
  const db = context.env.mbti_db;
  if (!db) return json({ error: "D1 binding mbti_db is missing." }, 500);

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return json({ error: "Missing test id." }, 400);

  try {
    const rows = await listTestImageMeta(db, testId);
    const items = rows.map((row) => {
      const key = String(row.image_key || "");
      const path = key.replace(/^assets\/?/i, "");
      return {
        id: row.id ?? null,
        key,
        path,
        url: `/assets/${path}`,
        imageType: row.image_type || "",
        imageName: row.image_name || "",
        contentType: row.content_type || "",
        size: Number(row.size_bytes || 0),
        lastModified: row.uploaded_at || null,
      };
    });
    return json({ items });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Failed to list images." },
      500,
    );
  }
}

export async function onRequestPut(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return json({ error: "R2 binding MBTI_BUCKET is missing." }, 500);
  const db = context.env.mbti_db;
  if (!db) return json({ error: "D1 binding mbti_db is missing." }, 500);

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return badRequest("Missing test id.");

  let upload: {
    buffer: ArrayBuffer;
    contentType: string;
    name: string;
  } | null = null;
  try {
    upload = await extractUpload(context);
  } catch {
    return badRequest("Unable to parse uploaded file.");
  }
  if (!upload) return badRequest("File upload required.");

  const ext = extensionFromMime(upload.contentType);
  const base =
    sanitizeBaseName(upload.name) ||
    (typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `img-${Date.now()}`);

  const prefix = getImagesPrefix(testId);
  const key = `${prefix}${base}.${ext}`;
  const imageType = inferImageType(base);

  try {
    await bucket.put(key, new Uint8Array(upload.buffer), {
      httpMetadata: { contentType: upload.contentType },
    });
    await upsertTestImageMeta(db, {
      testId,
      imageKey: key,
      imageType,
      imageName: base,
      contentType: upload.contentType,
      sizeBytes: upload.buffer.byteLength,
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Failed to upload image." },
      500,
    );
  }

  const publicPath = key.replace(/^assets\/?/i, "");
  return json({ ok: true, key, path: key, url: `/assets/${publicPath}` });
}
