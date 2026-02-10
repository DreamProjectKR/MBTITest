import type { MbtiEnv, PagesContext } from "../../../_types";
import { JSON_HEADERS, writeTest } from "../utils/store.js";

type Params = { id?: string };

const AXIS_SET = new Set(["EI", "SN", "TF", "JP"]);
const AXIS_MAP: Record<string, readonly [string, string]> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};
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

type Axis = (typeof MBTI_ORDER)[number]; // not used directly, keep minimal

type TestPayload = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  author?: unknown;
  authorImg?: unknown;
  thumbnail?: unknown;
  tags?: unknown;
  path?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  questions?: unknown;
  results?: unknown;
};

type Question = {
  label?: unknown;
  questionImage?: unknown;
  answers?: unknown;
};

type Answer = {
  label?: unknown;
  mbtiAxis?: unknown;
  direction?: unknown;
};

type ResultEntry = {
  image?: unknown;
  summary?: unknown;
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function methodNotAllowed(): Response {
  return json({ error: "Method not allowed." }, 405);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function validateTestPayload(test: {
  id: string;
  title: string;
  thumbnail: string;
  authorImg: string;
  questions: Question[];
  results: Record<string, ResultEntry>;
}): string | null {
  if (!test.id) return "Missing test id.";
  if (!test.title || !String(test.title).trim()) return "Test title required.";
  if (!test.thumbnail || !String(test.thumbnail).trim())
    return "Test needs a thumbnail path.";
  if (!test.authorImg || !String(test.authorImg).trim())
    return "Test needs an author image path.";
  if (!Array.isArray(test.questions) || test.questions.length !== 12)
    return "Test must have exactly 12 questions.";

  if (/^https?:\/\//i.test(String(test.thumbnail)))
    return "Thumbnail must be an uploaded R2 asset path (not an external URL).";
  if (/^https?:\/\//i.test(String(test.authorImg)))
    return "Author image must be an uploaded R2 asset path (not an external URL).";

  for (let i = 0; i < test.questions.length; i += 1) {
    const question = test.questions[i];
    if (!question || typeof question !== "object")
      return `Question ${i + 1} is invalid.`;
    if (!question.label || !String(question.label).trim())
      return `Question ${i + 1} needs a label.`;
    if (!question.questionImage || !String(question.questionImage).trim())
      return `Question ${i + 1} needs a questionImage path.`;
    if (/^https?:\/\//i.test(String(question.questionImage)))
      return `Question ${i + 1} image must be an uploaded R2 asset path (not an external URL).`;

    const answers = Array.isArray(question.answers)
      ? (question.answers as Answer[])
      : [];
    if (answers.length !== 2)
      return `Question ${i + 1} needs exactly two answers.`;
    const axisRaw = answers?.[0]?.mbtiAxis;
    const axis = typeof axisRaw === "string" ? axisRaw : "";
    if (!axis || !AXIS_SET.has(axis))
      return `Question ${i + 1} has invalid mbtiAxis.`;
    const pair = AXIS_MAP[axis];
    const pos = pair?.[0] ?? "";
    const neg = pair?.[1] ?? "";

    for (let j = 0; j < answers.length; j += 1) {
      const answer = answers[j];
      if (!answer || typeof answer !== "object")
        return `Question ${i + 1} answer ${j + 1} is invalid.`;
      if (!answer.label || !String(answer.label).trim())
        return `Question ${i + 1} answer ${j + 1} needs a label.`;
      if (!answer.mbtiAxis || !AXIS_SET.has(String(answer.mbtiAxis)))
        return `Question ${i + 1} answer ${j + 1} has invalid mbtiAxis.`;
      if (!answer.direction || !String(answer.direction).trim())
        return `Question ${i + 1} answer ${j + 1} needs a direction.`;
    }

    if (String(answers[1]?.mbtiAxis || "") !== axis)
      return `Question ${i + 1} answers must share the same mbtiAxis.`;
    const dirSet = new Set([
      String(answers[0]?.direction || ""),
      String(answers[1]?.direction || ""),
    ]);
    if (!(dirSet.has(pos) && dirSet.has(neg)))
      return `Question ${i + 1} answers must cover both poles for ${axis}.`;
  }

  const results = test.results;
  const codes = Object.keys(results);
  if (codes.length !== MBTI_ORDER.length)
    return "Results must contain exactly 16 MBTI entries.";

  for (const code of codes) {
    if (!MBTI_ORDER.includes(code as (typeof MBTI_ORDER)[number]))
      return `Result code "${code}" is not a valid MBTI type.`;
    const details = results[code];
    if (!details || typeof details !== "object")
      return `Result ${code} must be an object.`;
    if (!details.image || !String(details.image).trim())
      return `Result ${code} needs an image path.`;
    if (/^https?:\/\//i.test(String(details.image)))
      return `Result ${code} image must be an uploaded R2 asset path (not an external URL).`;
    if (!details.summary || !String(details.summary).trim())
      return `Result ${code} needs a summary.`;
  }

  return null;
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

  let payload: unknown;
  try {
    payload = (await context.request.json()) as unknown;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  if (!isObject(payload)) return badRequest("Request body must be an object.");

  const p = payload as TestPayload;
  if (p.id && String(p.id) !== testId)
    return badRequest("Payload id must match the URL parameter.");

  const title = String(p.title ?? "");
  const thumbnail = String(p.thumbnail ?? "");
  const authorImg = String(p.authorImg ?? "");

  const questions = Array.isArray(p.questions)
    ? (p.questions as Question[])
    : [];
  const results = isObject(p.results)
    ? (p.results as Record<string, ResultEntry>)
    : {};

  const validationError = validateTestPayload({
    id: testId,
    title,
    thumbnail,
    authorImg,
    questions,
    results,
  });
  if (validationError) return badRequest(validationError);

  try {
    // 1) Store the quiz body in R2 (slim: questions/results only)
    const slimBody = { questions, results };
    await writeTest(bucket, testId, slimBody);

    // 2) Store/refresh meta in D1
    const now = new Date().toISOString().split("T")[0] ?? "";
    const createdAt = String(p.createdAt ?? now);
    const updatedAt = String(p.updatedAt ?? now);
    const tagsJson = JSON.stringify(Array.isArray(p.tags) ? p.tags : []);
    const descriptionJson = JSON.stringify(p.description ?? null);

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
        title,
        descriptionJson,
        String(p.author ?? ""),
        authorImg,
        thumbnail,
        String(p.path ?? `${testId}/test.json`),
        tagsJson,
        createdAt,
        updatedAt,
      )
      .all();

    if (context.env.CACHE_KV) {
      context.waitUntil(context.env.CACHE_KV.delete(`test:${testId}`));
    }

    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save test.";
    return json({ error: message }, 500);
  }
}
