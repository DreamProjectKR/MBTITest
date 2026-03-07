import { normalizeAssetPath } from "./assetKeys.ts";

const AXIS_SET = new Set(["EI", "SN", "TF", "JP"]);
const AXIS_MAP: Record<string, readonly [string, string]> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

export const MBTI_ORDER = [
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

export type Answer = {
  label?: unknown;
  mbtiAxis?: unknown;
  direction?: unknown;
};

export type Question = {
  label?: unknown;
  questionImage?: unknown;
  answers?: unknown;
};

export type ResultEntry = {
  image?: unknown;
  summary?: unknown;
};

type TestPayloadForValidation = {
  id: string;
  title: string;
  thumbnail: string;
  authorImg: string;
  questions: Question[];
  results: Record<string, ResultEntry>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

/** Pure: normalize unknown question payload list. */
export function normalizeQuestions(input: unknown): Question[] {
  const rawQuestions = Array.isArray(input) ? (input as Question[]) : [];
  return rawQuestions.map((question) => ({
    ...(isObject(question) ? question : {}),
    questionImage: normalizeAssetPath(
      isObject(question) ? question.questionImage : "",
    ),
  }));
}

/** Pure: normalize unknown results payload object. */
export function normalizeResults(input: unknown): Record<string, ResultEntry> {
  const rawResults =
    isObject(input) ? (input as Record<string, ResultEntry>) : {};
  return Object.fromEntries(
    Object.entries(rawResults).map(([code, entry]) => {
      const detail = isObject(entry) ? entry : {};
      return [
        code,
        {
          ...detail,
          image: normalizeAssetPath(detail.image),
        } as ResultEntry,
      ];
    }),
  ) as Record<string, ResultEntry>;
}

/** Pure: validate normalized test payload. */
export function validateTestPayload(
  test: TestPayloadForValidation,
): string | null {
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

    const answers =
      Array.isArray(question.answers) ? (question.answers as Answer[]) : [];
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
