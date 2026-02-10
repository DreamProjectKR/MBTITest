import type { MbtiEnv, PagesContext } from "../../../../_types";

import { JSON_HEADERS, withCacheHeaders } from "../../_utils/http";

type Params = { id?: string };

type AxisKey = "EI" | "SN" | "TF" | "JP";
type Direction = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

type SubmittedAnswer = {
  mbtiAxis?: unknown;
  direction?: unknown;
};

type RequestBody = {
  answers?: unknown;
};

const AXIS_PAIRS: ReadonlyArray<readonly [Direction, Direction]> = [
  ["E", "I"],
  ["S", "N"],
  ["T", "F"],
  ["J", "P"],
];

const AXIS_TO_DIRECTIONS: Record<AxisKey, readonly [Direction, Direction]> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
  });
}

function isAxis(value: unknown): value is AxisKey {
  return value === "EI" || value === "SN" || value === "TF" || value === "JP";
}

function isDirection(value: unknown): value is Direction {
  return (
    value === "E" ||
    value === "I" ||
    value === "S" ||
    value === "N" ||
    value === "T" ||
    value === "F" ||
    value === "J" ||
    value === "P"
  );
}

function computeFromAnswers(answers: SubmittedAnswer[]): {
  mbti: string;
  scores: Record<AxisKey, Record<Direction, number>>;
  percentages: Record<Direction, number>;
} {
  const scores: Record<AxisKey, Record<Direction, number>> = {
    EI: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
    SN: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
    TF: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
    JP: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
  };

  for (const answer of answers) {
    const axis = answer?.mbtiAxis;
    const direction = answer?.direction;
    if (!isAxis(axis) || !isDirection(direction)) continue;
    const [left, right] = AXIS_TO_DIRECTIONS[axis];
    if (direction !== left && direction !== right) continue;
    scores[axis][direction] = (scores[axis][direction] || 0) + 1;
  }

  let mbti = "";
  const percentages: Record<Direction, number> = {
    E: 0,
    I: 0,
    S: 0,
    N: 0,
    T: 0,
    F: 0,
    J: 0,
    P: 0,
  };

  for (const [first, second] of AXIS_PAIRS) {
    const axis = `${first}${second}` as AxisKey;
    const firstScore = scores[axis][first] || 0;
    const secondScore = scores[axis][second] || 0;
    const total = firstScore + secondScore || 1;
    percentages[first] = Math.round((firstScore / total) * 100);
    percentages[second] = 100 - percentages[first];
    mbti += firstScore >= secondScore ? first : second;
  }

  return { mbti, scores, percentages };
}

export async function onRequestPost(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  const db = context.env.mbti_db;
  if (!db) return json({ error: "D1 binding mbti_db is missing." }, 500);

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return json({ error: "Missing test id." }, 400);

  const exists = await db
    .prepare("SELECT test_id FROM tests WHERE test_id = ?1 LIMIT 1")
    .bind(testId)
    .first<{ test_id?: unknown }>();
  if (!exists?.test_id) return json({ error: "Test not found." }, 404);

  let body: RequestBody;
  try {
    body = (await context.request.json()) as RequestBody;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const answers =
    Array.isArray(body?.answers) ? (body.answers as SubmittedAnswer[]) : [];
  if (!answers.length)
    return json({ error: "answers array is required." }, 400);

  const computed = computeFromAnswers(answers);
  return json({
    testId,
    mbti: computed.mbti,
    scores: {
      EI: { E: computed.scores.EI.E, I: computed.scores.EI.I },
      SN: { S: computed.scores.SN.S, N: computed.scores.SN.N },
      TF: { T: computed.scores.TF.T, F: computed.scores.TF.F },
      JP: { J: computed.scores.JP.J, P: computed.scores.JP.P },
    },
    percentages: computed.percentages,
  });
}
