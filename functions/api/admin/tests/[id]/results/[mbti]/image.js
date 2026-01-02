import {
  JSON_HEADERS,
  getImagesPrefix,
  readTest,
  writeTest,
} from "../../../../utils/store.js";

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
];

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
  const type = mimeType.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "png";
}

async function extractUpload(context) {
  const contentType = context.request.headers.get("content-type") || "";
  const isMultipart = contentType
    .toLowerCase()
    .startsWith("multipart/form-data");
  if (isMultipart) {
    const formData = await context.request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return null;
    const buffer = await file.arrayBuffer();
    return { buffer, contentType: file.type || contentType };
  }

  const buffer = await context.request.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return null;
  return { buffer, contentType: contentType || "image/png" };
}

export async function onRequestPut(context) {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const bucket = context.env.MBTI_BUCKET;
  if (!bucket)
    return createJsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      500,
    );
  const db = context.env.mbti_db;
  if (!db)
    return createJsonResponse({ error: "D1 binding mbti_db is missing." }, 500);

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return badRequest("Missing test id.");
  const mbtiRaw = context.params?.mbti
    ? String(context.params.mbti).trim().toUpperCase()
    : "";
  if (!mbtiRaw || !MBTI_ORDER.includes(mbtiRaw))
    return badRequest("Invalid MBTI code.");

  let upload;
  try {
    upload = await extractUpload(context);
  } catch (err) {
    return badRequest("Unable to parse uploaded file.");
  }

  if (!upload) return badRequest("File upload required.");

  const bytes = new Uint8Array(upload.buffer);
  const extension = extensionFromMime(upload.contentType);
  const fileName = `${mbtiRaw}.${extension}`;
  const key = `${getImagesPrefix(testId)}${fileName}`;

  try {
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: upload.contentType },
    });
  } catch (err) {
    return createJsonResponse(
      {
        error: err instanceof Error ? err.message : "Failed to upload image.",
      },
      500,
    );
  }

  try {
    const testJson = await readTest(bucket, testId);
    if (!testJson)
      return createJsonResponse(
        { error: "Test JSON not found while updating image." },
        404,
      );

    testJson.results = testJson.results || {};
    testJson.results[mbtiRaw] = {
      ...(testJson.results[mbtiRaw] || {}),
      image: `${getImagesPrefix(testId)}${fileName}`,
    };

    await writeTest(bucket, testId, testJson);

    // Touch updated_at in D1 so listing order reflects recent edits.
    const now = new Date().toISOString().split("T")[0];
    await db
      .prepare("UPDATE tests SET updated_at = ?1 WHERE test_id = ?2")
      .bind(now, testId)
      .run();

    return createJsonResponse({
      ok: true,
      mbti: mbtiRaw,
      path: `${getImagesPrefix(testId)}${fileName}`,
      url: `/assets/${getImagesPrefix(testId).replace(
        /^assets\/?/i,
        "",
      )}${fileName}`,
    });
  } catch (err) {
    return createJsonResponse(
      {
        error:
          err instanceof Error ? err.message : "Unable to update test JSON.",
      },
      500,
    );
  }
}
