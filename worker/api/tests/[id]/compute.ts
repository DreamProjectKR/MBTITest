import type { MbtiEnv, PagesContext } from "../../../_types.ts";

import {
  type SubmittedAnswer,
  computeMbtiFromAnswers,
} from "../../../domain/tests/computeMbti.ts";
import { isPublishedRow } from "../../../domain/tests/mergePayload.ts";
import {
  MAX_COMPUTE_JSON_BYTES,
  getContentLength,
  payloadTooLargeResponse,
} from "../../_utils/bodyLimits.ts";
import { noStoreJsonResponse } from "../../_utils/http.ts";
import {
  RATE_COMPUTE_PER_WINDOW,
  RATE_COMPUTE_WINDOW_SEC,
  rateLimitOr429,
} from "../../_utils/rateLimit.ts";

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

  const tooMany = await rateLimitOr429(context.env.MBTI_KV, context.request, {
    routeKey: "compute",
    limit: RATE_COMPUTE_PER_WINDOW,
    windowSec: RATE_COMPUTE_WINDOW_SEC,
  });
  if (tooMany) return tooMany;

  const contentLen = getContentLength(context.request);
  if (contentLen !== null && contentLen > MAX_COMPUTE_JSON_BYTES) {
    return payloadTooLargeResponse();
  }

  let rawBuf: ArrayBuffer;
  try {
    rawBuf = await context.request.arrayBuffer();
  } catch {
    return noStoreJsonResponse(
      { error: "Request body could not be read." },
      400,
    );
  }
  if (rawBuf.byteLength > MAX_COMPUTE_JSON_BYTES) {
    return payloadTooLargeResponse();
  }

  let body: RequestBody;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBuf)) as RequestBody;
  } catch {
    return noStoreJsonResponse(
      { error: "Request body must be valid JSON." },
      400,
    );
  }

  const row = await db
    .prepare(
      "SELECT test_id, is_published FROM tests WHERE test_id = ?1 LIMIT 1",
    )
    .bind(testId)
    .first<{ test_id?: unknown; is_published?: unknown }>();
  if (!row?.test_id || !isPublishedRow(row))
    return noStoreJsonResponse({ error: "Test not found." }, 404);

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
