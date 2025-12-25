import {
  JSON_HEADERS,
  readIndex,
  writeIndex,
  buildIndexWithMeta,
  createMetaFromTest,
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
    if (!question.prompt && !question.label)
      return `Question ${i + 1} needs prompt or label.`;
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
    await writeTest(bucket, testId, testPayload);
    const index = await readIndex(bucket);
    const existingMeta = Array.isArray(index.tests)
      ? index.tests.find((entry) => entry?.id === testId)
      : undefined;
    const meta = createMetaFromTest(testPayload, existingMeta);
    const updatedIndex = buildIndexWithMeta(index, meta);
    await writeIndex(bucket, updatedIndex);
    return createJsonResponse({ ok: true, test: testPayload, meta });
  } catch (err) {
    return createJsonResponse(
      { error: err instanceof Error ? err.message : "Failed to save test." },
      500,
    );
  }
}
