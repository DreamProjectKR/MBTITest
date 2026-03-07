import type { MbtiEnv, PagesContext } from "../../../_types.ts";

import {
  type SubmittedAnswer,
  computeMbtiFromAnswers,
} from "../../../domain/tests/computeMbti.ts";
import { noStoreJsonResponse } from "../../_utils/http.ts";

type Params = { id?: string };

type RequestBody = {
  answers?: unknown;
};

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

  const computed = computeMbtiFromAnswers(answers);
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
