import type { MbtiEnv, PagesContext } from "../../../../_types.ts";

import { uploadTestImageWorkflow } from "../../../../application/workflows/uploadTestImage.ts";
import { noStoreJsonResponse } from "../../../_utils/http.ts";
import {
  type TestImageMetaRow,
  getImagesPrefix,
  listTestImageMeta,
  normalizeAssetKey,
  upsertTestImageMeta,
} from "../../utils/store.ts";

type Params = { id?: string };

function methodNotAllowed(): Response {
  return noStoreJsonResponse({ error: "Method not allowed." }, 405);
}

function badRequest(message: string): Response {
  return noStoreJsonResponse({ error: message }, 400);
}

/** Pure: map MIME type to file extension. */
function extensionFromMime(mimeType = ""): string {
  const type = String(mimeType || "").toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/svg+xml") return "svg";
  return "png";
}

/** Pure: sanitize name for use as file base name. */
function sanitizeBaseName(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

/** Pure: canonicalize base name to reduce lookup variants. */
function canonicalBaseName(baseName: string): string {
  const base = String(baseName || "").trim();
  if (!base) return "";
  if (/^q\d{1,2}$/i.test(base)) return `Q${base.replace(/^q/i, "")}`;
  if (/^[ei][ns][tf][jp]$/i.test(base)) return base.toUpperCase();
  if (base.toLowerCase() === "thumbnail") return "thumbnail";
  if (base.toLowerCase() === "author") return "author";
  return base;
}

/** Pure: infer image type from base name. */
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

/** Pure: map DB row to API item shape. */
function rowToImageItem(row: TestImageMetaRow): {
  id: number | null;
  key: string;
  path: string;
  url: string;
  imageType: string;
  imageName: string;
  contentType: string;
  size: number;
  lastModified: string | null;
} {
  const key = String(row.image_key || "");
  const path = key.replace(/^assets\/?/i, "");
  return {
    id: (row.id ?? null) as number | null,
    key,
    path,
    url: `/assets/${path}`,
    imageType: row.image_type ? String(row.image_type) : "",
    imageName: row.image_name ? String(row.image_name) : "",
    contentType: row.content_type ? String(row.content_type) : "",
    size: Number(row.size_bytes || 0),
    lastModified: row.uploaded_at ? String(row.uploaded_at) : null,
  };
}

/** I/O: parse multipart or body into buffer + contentType + name. */
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
  const db = context.env.MBTI_DB;
  if (!db)
    return noStoreJsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      500,
    );

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return noStoreJsonResponse({ error: "Missing test id." }, 400);

  try {
    const rows = await listTestImageMeta(db, testId);
    const items = rows.map(rowToImageItem);
    return noStoreJsonResponse({ items });
  } catch (err) {
    return noStoreJsonResponse(
      {
        error: err instanceof Error ? err.message : "Failed to list images.",
      },
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
    return noStoreJsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      500,
    );
  const db = context.env.MBTI_DB;
  if (!db)
    return noStoreJsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      500,
    );

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
  const baseRaw =
    sanitizeBaseName(upload.name) ||
    ((
      typeof crypto !== "undefined" &&
      "randomUUID" in crypto &&
      typeof crypto.randomUUID === "function"
    ) ?
      crypto.randomUUID()
    : `img-${Date.now()}`);
  const base = canonicalBaseName(baseRaw);

  try {
    return noStoreJsonResponse(
      await uploadTestImageWorkflow(context, {
        testId,
        baseName: base,
        extension: ext,
        contentType: upload.contentType,
        buffer: upload.buffer,
      }),
    );
  } catch (err) {
    return noStoreJsonResponse(
      { error: err instanceof Error ? err.message : "Failed to upload image." },
      500,
    );
  }
}
