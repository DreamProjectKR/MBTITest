import type { MbtiEnv, PagesContext } from "../../../_types";

import { noStoreJsonResponse } from "../../_utils/http";

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

const INITIAL_SCORES: Record<AxisKey, Record<Direction, number>> = {
  EI: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
  SN: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
  TF: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
  JP: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
};

const DIRECTIONS: Direction[] = ["E", "I", "S", "N", "T", "F", "J", "P"];

const INITIAL_PERCENTAGES: Record<Direction, number> = DIRECTIONS.reduce(
  (acc, d) => ({ ...acc, [d]: 0 }),
  {} as Record<Direction, number>,
);

/** Pure: compute MBTI string and percentages from submitted answers (immutable accumulation). */
function computeFromAnswers(answers: SubmittedAnswer[]): {
  mbti: string;
  scores: Record<AxisKey, Record<Direction, number>>;
  percentages: Record<Direction, number>;
} {
  const scores = answers.reduce<Record<AxisKey, Record<Direction, number>>>(
    (acc, answer) => {
      const axis = answer?.mbtiAxis;
      const direction = answer?.direction;
      if (!isAxis(axis) || !isDirection(direction)) return acc;
      const [left, right] = AXIS_TO_DIRECTIONS[axis];
      if (direction !== left && direction !== right) return acc;
      const prev = acc[axis][direction] || 0;
      return {
        ...acc,
        [axis]: { ...acc[axis], [direction]: prev + 1 },
      };
    },
    {
      ...(Object.fromEntries(
        (["EI", "SN", "TF", "JP"] as const).map((k) => [
          k,
          { ...INITIAL_SCORES[k] },
        ]),
      ) as Record<AxisKey, Record<Direction, number>>),
    },
  );

  const percentages = AXIS_PAIRS.reduce<Record<Direction, number>>(
    (acc, [first, second]) => {
      const axis = `${first}${second}` as AxisKey;
      const firstScore = scores[axis][first] || 0;
      const secondScore = scores[axis][second] || 0;
      const total = firstScore + secondScore || 1;
      const firstPct = Math.round((firstScore / total) * 100);
      return {
        ...acc,
        [first]: firstPct,
        [second]: 100 - firstPct,
      };
    },
    { ...INITIAL_PERCENTAGES },
  );

  const mbti = AXIS_PAIRS.map(([first, second]) => {
    const axis = `${first}${second}` as AxisKey;
    const firstScore = scores[axis][first] || 0;
    const secondScore = scores[axis][second] || 0;
    return firstScore >= secondScore ? first : second;
  }).join("");

  return { mbti, scores, percentages };
}

export async function onRequestPost(
  context: PagesContext<MbtiEnv, Params>,
): Promise<Response> {
  const db = context.env.MBTI_DB;
  if (!db)
    return noStoreJsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      500,
    );

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return noStoreJsonResponse({ error: "Missing test id." }, 400);

  const exists = await db
    .prepare("SELECT test_id FROM tests WHERE test_id = ?1 LIMIT 1")
    .bind(testId)
    .first<{ test_id?: unknown }>();
  if (!exists?.test_id)
    return noStoreJsonResponse({ error: "Test not found." }, 404);

  let body: RequestBody;
  try {
    body = (await context.request.json()) as RequestBody;
  } catch {
    return noStoreJsonResponse(
      { error: "Request body must be valid JSON." },
      400,
    );
  }

  const answers =
    Array.isArray(body?.answers) ? (body.answers as SubmittedAnswer[]) : [];
  if (!answers.length)
    return noStoreJsonResponse({ error: "answers array is required." }, 400);

  const computed = computeFromAnswers(answers);
  return noStoreJsonResponse({
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
