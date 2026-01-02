import {
  JSON_HEADERS,
  writeTest,
} from "../utils/store.js";

const AXIS_SET = new Set(["EI", "SN", "TF", "JP"]);
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

function badRequest(message) {
  return createJsonResponse({ error: message }, 400);
}

function methodNotAllowed() {
  return createJsonResponse({ error: "Method not allowed." }, 405);
}

function validateTestPayload(test) {
  if (!test.id) return "Missing test id.";
  if (!test.title || !String(test.title).trim()) return "Test title required.";
  if (!Array.isArray(test.questions) || test.questions.length === 0)
    return "At least one question is required.";

  for (let i = 0; i < test.questions.length; i += 1) {
    const question = test.questions[i];
    if (!question || typeof question !== "object")
      return `Question ${i + 1} is invalid.`;
    if (!question.questionImage && !question.label)
      return `Question ${i + 1} needs questionImage or label.`;
    if (!Array.isArray(question.answers) || question.answers.length < 2)
      return `Question ${i + 1} needs at least two answers.`;

    for (let j = 0; j < question.answers.length; j += 1) {
      const answer = question.answers[j];
      if (!answer || typeof answer !== "object")
        return `Question ${i + 1} answer ${j + 1} is invalid.`;
      if (!answer.label || !String(answer.label).trim())
        return `Question ${i + 1} answer ${j + 1} needs a label.`;
      if (!answer.mbtiAxis || !AXIS_SET.has(answer.mbtiAxis))
        return `Question ${i + 1} answer ${j + 1} has invalid mbtiAxis.`;
      if (!answer.direction || !String(answer.direction).trim())
        return `Question ${i + 1} answer ${j + 1} needs a direction.`;
    }
  }

  if (!test.results || typeof test.results !== "object")
    return "Results must be an object.";

  const codes = Object.keys(test.results);
  if (codes.length === 0)
    return "Results must contain at least one MBTI entry.";

  for (const code of codes) {
    if (!MBTI_ORDER.includes(code))
      return `Result code "${code}" is not a valid MBTI type.`;
    const details = test.results[code];
    if (!details || typeof details !== "object")
      return `Result ${code} must be an object.`;
    if (!details.image || !String(details.image).trim())
      return `Result ${code} needs an image path.`;
    if (!details.summary || !String(details.summary).trim())
      return `Result ${code} needs a summary.`;
  }

  return null;
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

  let payload;
  try {
    payload = await context.request.json();
  } catch (err) {
    return badRequest("Request body must be valid JSON.");
  }

  if (payload.id && payload.id !== testId)
    return badRequest("Payload id must match the URL parameter.");

  const testPayload = { ...payload, id: testId };
  const validationError = validateTestPayload(testPayload);
  if (validationError) return badRequest(validationError);

  try {
    // 1) Store the full quiz body in R2 (slim: questions/results only)
    const slimBody = {
      questions: Array.isArray(testPayload.questions) ? testPayload.questions : [],
      results: testPayload.results && typeof testPayload.results === "object" ? testPayload.results : {},
    };
    await writeTest(bucket, testId, slimBody);

    // 2) Store/refresh meta in D1
    const now = new Date().toISOString().split("T")[0];
    const createdAt = String(testPayload.createdAt || now);
    const updatedAt = String(testPayload.updatedAt || now);
    const tagsJson = JSON.stringify(Array.isArray(testPayload.tags) ? testPayload.tags : []);
    const descriptionJson = JSON.stringify(testPayload.description ?? null);

    await db
      .prepare(
        `
        INSERT INTO tests (test_id, title, description_json, author, author_img_path, thumbnail_path, source_path, tags_json, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(test_id) DO UPDATE SET
          title = excluded.title,
          description_json = excluded.description_json,
          author = excluded.author,
          author_img_path = excluded.author_img_path,
          thumbnail_path = excluded.thumbnail_path,
          source_path = excluded.source_path,
          tags_json = excluded.tags_json,
          created_at = COALESCE(tests.created_at, excluded.created_at),
          updated_at = excluded.updated_at
        `,
      )
      .bind(
        testId,
        String(testPayload.title || ""),
        descriptionJson,
        String(testPayload.author || ""),
        String(testPayload.authorImg || ""),
        String(testPayload.thumbnail || ""),
        String(testPayload.path || `${testId}/test.json`),
        tagsJson,
        createdAt,
        updatedAt,
      )
      .run();

    return createJsonResponse({ ok: true });
  } catch (err) {
    return createJsonResponse(
      { error: err instanceof Error ? err.message : "Failed to save test." },
      500,
    );
  }
}
