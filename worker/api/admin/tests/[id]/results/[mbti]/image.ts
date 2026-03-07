import type { MbtiEnv, PagesContext } from "../../../../../_types.ts";

import { uploadResultImageWorkflow } from "../../../../../../application/workflows/uploadResultImage.ts";
import { noStoreJsonResponse } from "../../../../../_utils/http.ts";

type Params = { id?: string; mbti?: string };

const MBTI_ORDER = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISTP",
  "ESTJ",
  "ESTP",
  "ISFJ",
  "ISFP",
  "ESFJ",
  "ESFP",
] as const;

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
  return "png";
}

/** I/O: parse multipart or body into buffer + contentType. */
async function extractUpload(
  context: PagesContext<MbtiEnv, Params>,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const contentType = context.request.headers.get("content-type") || "";
  const isMultipart = contentType
    .toLowerCase()
    .startsWith("multipart/form-data");
  if (isMultipart) {
    const formData = await context.request.formData();
    const file = formData.get("file");
    if (!file || typeof (file as File).arrayBuffer !== "function") return null;
    const buffer = await (file as File).arrayBuffer();
    return { buffer, contentType: (file as File).type || contentType };
  }

  const buffer = await context.request.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return null;
  return { buffer, contentType: contentType || "image/png" };
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

  const mbtiRaw =
    context.params?.mbti ?
      String(context.params.mbti).trim().toUpperCase()
    : "";
  if (
    !mbtiRaw ||
    !MBTI_ORDER.includes(mbtiRaw as (typeof MBTI_ORDER)[number])
  ) {
    return badRequest("Invalid MBTI code.");
  }

  let upload: { buffer: ArrayBuffer; contentType: string } | null = null;
  try {
    upload = await extractUpload(context);
  } catch {
    return badRequest("Unable to parse uploaded file.");
  }
  if (!upload) return badRequest("File upload required.");

  const extension = extensionFromMime(upload.contentType);

  try {
    return noStoreJsonResponse(
      await uploadResultImageWorkflow(context, {
        testId,
        mbti: mbtiRaw,
        extension,
        contentType: upload.contentType,
        buffer: upload.buffer,
      }),
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to upload image.";
    return noStoreJsonResponse(
      {
        error:
          message === "Test JSON not found while updating image." ? message : (
            message
          ),
      },
      message === "Test JSON not found while updating image." ? 404 : 500,
    );
  }
}
