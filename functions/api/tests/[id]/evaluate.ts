/**
 * API: `POST /api/tests/:id/evaluate`
 *
 * Body:
 * - { answers: ["answer_id", ...] }  OR
 * - { selections: [{ questionId, answerId }, ...] }
 *
 * Evaluates selected answers and returns a result.
 *
 * Designers should not edit JSON. Evaluation inputs are stored in typed D1 columns:
 * - answers.mbti_axis / answers.mbti_dir / answers.weight
 * - answers.score_key / answers.score_value
 */

import {
  evaluateMbtiAxes,
  evaluateScoreOutcomes,
  normalizeAnswerIds,
  summarizeMbtiPlusMinus,
} from "../utils/evaluate-core.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function withCacheHeaders(
  headers: HeadersInit,
  { maxAge = 0 }: { maxAge?: number } = {},
): Headers {
  const h = new Headers(headers);
  h.set("Cache-Control", `no-store, max-age=${maxAge}`);
  return h;
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
  });
}

export async function onRequestPost(context: any) {
  const db = context.env.MBTI_DB;
  if (!db) return json(500, { error: "D1 binding MBTI_DB is missing." });

  const testId = context.params?.id ? String(context.params.id) : "";
  if (!testId) return json(400, { error: "Missing test id." });

  let body = null;
  try {
    body = await context.request.json();
  } catch (e) {
    return json(400, { error: "Request body must be valid JSON." });
  }

  const answerIds = normalizeAnswerIds(body);
  if (!answerIds.length) return json(400, { error: "No answers provided." });
  if (answerIds.length > 200)
    return json(400, { error: "Too many answers." });

  const testRow = await db
    .prepare(`SELECT id, title, type FROM tests WHERE id = ?`)
    .bind(testId)
    .first();
  if (!testRow) return json(404, { error: "Test not found: " + testId });

  const type = String(testRow.type || "generic").trim() || "generic";
  const payloads = await loadAnswerPayloads(db, testId, answerIds, type);
  if (!payloads.length) {
    return json(400, { error: "No valid answer scoring data found." });
  }

  let outcomeCode = "";
  let analysis: any = null;
  try {
    if (type === "mbti") {
      const summary = summarizeMbtiPlusMinus(payloads, DEFAULT_MBTI_RULES);
      outcomeCode = summary.code;
      analysis = summary;
    }
    else if (type === "score") outcomeCode = evaluateScoreOutcomes(payloads, {});
    else return json(400, { error: "Unsupported test type for evaluation.", type });
  } catch (e) {
    return json(400, {
      error: "Failed to evaluate test rules.",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  if (!outcomeCode)
    return json(400, { error: "Could not determine outcome." });

  const outRow = await db
    .prepare(
      `SELECT result, result_image, summary
       FROM results
       WHERE test_id = ? AND result = ?`,
    )
    .bind(testId, outcomeCode)
    .first();

  if (!outRow) {
    return json(404, {
      error: "Outcome not found for computed code.",
      code: outcomeCode,
    });
  }

  const payload = {
    id: testRow.id,
    title: testRow.title ?? "",
    type: testRow.type ?? "generic",
    outcome: {
      code: outRow.result,
      title: "",
      image: outRow.result_image ?? "",
      summary: outRow.summary ?? "",
      meta: null,
    },
    analysis,
  };

  return json(200, payload);
}

const DEFAULT_MBTI_RULES = {
  mode: "mbtiAxes",
  axisOrder: ["EI", "SN", "TF", "JP"],
  axisDefaults: { EI: "I", SN: "S", TF: "T", JP: "J" },
};

function inferMbtiFromAnswerId(answerId: string) {
  // Supported formats inside answer_id (case-insensitive):
  // - "EI:E" or "EI_E" or "EI-E"
  // - "axis=EI;dir=E" (very loose)
  const raw = String(answerId || "");
  const upper = raw.toUpperCase();

  const m1 = upper.match(
    /(?:^|[^A-Z0-9])(EI|SN|TF|JP)[_:\-](E|I|S|N|T|F|J|P)(?:$|[^A-Z0-9])/,
  );
  if (m1) return { mbtiAxis: m1[1], direction: m1[2], weight: 1 };

  const axis = upper.match(/\bAXIS\s*=\s*(EI|SN|TF|JP)\b/);
  const dir = upper.match(/\b(DIR|DIRECTION)\s*=\s*(E|I|S|N|T|F|J|P)\b/);
  if (axis && dir) return { mbtiAxis: axis[1], direction: dir[2], weight: 1 };

  return null;
}

async function loadAnswerPayloads(db: any, testId: string, answerIds: string[], type: string) {
  const uniq = Array.from(new Set(answerIds.map((v) => String(v || "").trim()))).filter(Boolean);
  if (!uniq.length) return [];
  const placeholders = uniq.map(() => "?").join(",");
  const res = await db
    .prepare(
      `SELECT answer_id, mbti_axis, mbti_dir, weight, score_key, score_value
       FROM answers
       WHERE test_id = ? AND answer_id IN (${placeholders})`,
    )
    .bind(testId, ...uniq)
    .all();
  const rows = Array.isArray(res?.results) ? res.results : [];

  if (type === "mbti") {
    return rows
      .map((r: any) => {
        const axis = String(r.mbti_axis ?? "").trim().toUpperCase();
        const rawDir = String(r.mbti_dir ?? "").trim().toLowerCase();
        const weight = Number.isFinite(Number(r.weight)) ? Number(r.weight) : 1;
        const sign =
          rawDir === "plus" || rawDir === "positive" || rawDir === "+"
            ? 1
            : rawDir === "minus" || rawDir === "negative" || rawDir === "-"
              ? -1
              : 0;
        if (axis && sign) return { axis, delta: sign * Math.max(1, weight) };
        // Fallback: older data might still encode letters inside answer_id
        const fallback = inferMbtiFromAnswerId(String(r.answer_id ?? ""));
        return fallback ? { axis: fallback.mbtiAxis, dir: fallback.direction, weight } : null;
      })
      .filter(Boolean);
  }

  if (type === "score") {
    return rows
      .map((r: any) => {
        const key = String(r.score_key ?? "").trim();
        const value = Number(r.score_value);
        if (!key || !Number.isFinite(value) || value === 0) return null;
        return { scores: { [key]: value } };
      })
      .filter(Boolean);
  }

  return [];
}


