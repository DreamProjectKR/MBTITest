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
  evaluateScoreOutcomes,
  normalizeAnswerIds,
  summarizeMbtiPlusMinus,
} from "../utils/evaluate-core.js";
import type { MbtiAnalysis, MbtiAxis, MbtiLetter, MbtiRules, MbtiScoringItem, ScoreItem, ScoreRules } from "../utils/evaluate-core.js";
import type { D1Database, PagesContext } from "../../types/bindings.d.ts";
import { requireDb } from "../../utils/bindings.js";
import { errorResponse, jsonResponse, methodNotAllowed } from "../../utils/http.js";
import { isRecord, readNumber, readString } from "../../utils/guards.js";

export async function onRequestPost(context: PagesContext<{ id?: string }>) {
  if (context.request.method !== "POST") return methodNotAllowed();
  const db = requireDb(context);
  if (db instanceof Response) return db;

  const testId = context.params?.id ? String(context.params.id) : "";
  if (!testId) return errorResponse("Missing test id.", 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const answerIds = normalizeAnswerIds(body);
  if (!answerIds.length) return errorResponse("No answers provided.", 400);
  if (answerIds.length > 200) return errorResponse("Too many answers.", 400);

  const testRow = await db
    .prepare(`SELECT id, title, type FROM tests WHERE id = ?`)
    .bind(testId)
    .first<{ id: string; title: string | null; type: string | null }>();
  if (!testRow) return errorResponse("Test not found: " + testId, 404);

  const type = String(testRow.type || "generic").trim() || "generic";

  let outcomeCode = "";
  let analysis: MbtiAnalysis | null = null;
  try {
    if (type === "mbti") {
      const items = await loadMbtiItemsAggregated(db, testId, answerIds);
      if (!items.length) return errorResponse("No valid answer scoring data found.", 400);
      const summary = summarizeMbtiPlusMinus(items, DEFAULT_MBTI_RULES);
      outcomeCode = summary.code;
      analysis = summary;
    } else if (type === "score") {
      const items = await loadScoreItemsAggregated(db, testId, answerIds);
      if (!items.length) return errorResponse("No valid answer scoring data found.", 400);
      outcomeCode = evaluateScoreOutcomes(items, DEFAULT_SCORE_RULES);
    } else {
      // Generic fallback: auto-detect based on which scoring columns exist for the selected answers.
      const mbtiItems = await loadMbtiItemsAggregated(db, testId, answerIds);
      if (mbtiItems.length) {
        const summary = summarizeMbtiPlusMinus(mbtiItems, DEFAULT_MBTI_RULES);
        outcomeCode = summary.code;
        analysis = summary;
      } else {
        const scoreItems = await loadScoreItemsAggregated(db, testId, answerIds);
        if (scoreItems.length) {
          outcomeCode = evaluateScoreOutcomes(scoreItems, DEFAULT_SCORE_RULES);
        } else {
          return jsonResponse({ error: "Unsupported test type for evaluation.", type }, { status: 400 });
        }
      }
    }
  } catch (e) {
    return jsonResponse(
      {
        error: "Failed to evaluate test rules.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    );
  }

  if (!outcomeCode) return errorResponse("Could not determine outcome.", 400);

  // IMPORTANT: quiz page only needs the code. Result page will fetch details via `/outcome`.
  return jsonResponse({
    id: testRow.id,
    title: testRow.title ?? "",
    type: testRow.type ?? "generic",
    outcome: {
      code: outcomeCode,
    },
    analysis,
  });
}

const DEFAULT_MBTI_RULES: MbtiRules = {
  mode: "mbtiAxes",
  axisOrder: ["EI", "SN", "TF", "JP"],
  axisDefaults: { EI: "I", SN: "S", TF: "T", JP: "J" },
};

const DEFAULT_SCORE_RULES: ScoreRules = { mode: "scoreOutcomes" };

function inferMbtiFromAnswerId(answerId: string): { mbtiAxis: MbtiAxis; direction: MbtiLetter } | null {
  const upper = String(answerId || "").toUpperCase();
  const m1 = upper.match(
    /(?:^|[^A-Z0-9])(EI|SN|TF|JP)[_:\-](E|I|S|N|T|F|J|P)(?:$|[^A-Z0-9])/,
  );
  if (m1) return { mbtiAxis: m1[1] as MbtiAxis, direction: m1[2] as MbtiLetter };
  const axis = upper.match(/\bAXIS\s*=\s*(EI|SN|TF|JP)\b/);
  const dir = upper.match(/\b(DIR|DIRECTION)\s*=\s*(E|I|S|N|T|F|J|P)\b/);
  if (axis && dir) return { mbtiAxis: axis[1] as MbtiAxis, direction: dir[2] as MbtiLetter };
  return null;
}

function mbtiLetterToPlusMinus(axis: MbtiAxis, letter: MbtiLetter): "plus" | "minus" {
  const plusByAxis: Record<MbtiAxis, MbtiLetter> = { EI: "E", SN: "S", TF: "T", JP: "J" };
  return letter === plusByAxis[axis] ? "plus" : "minus";
}

// Legacy (per-answer) loader kept for backward compatibility and edge cases.
// New path should use `loadMbtiItemsAggregated` for performance.
async function loadMbtiItems(db: D1Database, testId: string, answerIds: string[]): Promise<MbtiScoringItem[]> {
  const uniq = Array.from(new Set(answerIds.map((v) => String(v || "").trim()))).filter(Boolean);
  if (!uniq.length) return [];
  const placeholders = uniq.map(() => "?").join(",");
  const res = await db
    .prepare(
      `SELECT answer_id, mbti_axis, mbti_dir, weight
       FROM answers
       WHERE test_id = ? AND answer_id IN (${placeholders})`,
    )
    .bind(testId, ...uniq)
    .all<{ answer_id: string; mbti_axis: string | null; mbti_dir: string | null; weight: number | null }>();
  const rows = Array.isArray(res?.results) ? res.results : [];

  const out: MbtiScoringItem[] = [];
  rows.forEach((r) => {
    const axisRaw = String(r.mbti_axis ?? "").trim().toUpperCase();
    const axis = (axisRaw as MbtiAxis) || null;
    const weight = Math.max(1, Math.floor(readNumber(r.weight, 1)));
    const dirRaw = String(r.mbti_dir ?? "").trim().toLowerCase();
    if (axis && (axis === "EI" || axis === "SN" || axis === "TF" || axis === "JP")) {
      if (dirRaw === "plus") out.push({ axis, delta: weight });
      else if (dirRaw === "minus") out.push({ axis, delta: -weight });
      else {
        const fallback = inferMbtiFromAnswerId(String(r.answer_id ?? ""));
        if (fallback) {
          const pm = mbtiLetterToPlusMinus(fallback.mbtiAxis, fallback.direction);
          out.push({ axis: fallback.mbtiAxis, delta: pm === "plus" ? weight : -weight });
        }
      }
    }
  });
  return out;
}

// Legacy (per-answer) loader kept for backward compatibility and edge cases.
// New path should use `loadScoreItemsAggregated` for performance.
async function loadScoreItems(db: D1Database, testId: string, answerIds: string[]): Promise<ScoreItem[]> {
  const uniq = Array.from(new Set(answerIds.map((v) => String(v || "").trim()))).filter(Boolean);
  if (!uniq.length) return [];
  const placeholders = uniq.map(() => "?").join(",");
  const res = await db
    .prepare(
      `SELECT score_key, score_value
       FROM answers
       WHERE test_id = ? AND answer_id IN (${placeholders})`,
    )
    .bind(testId, ...uniq)
    .all<{ score_key: string | null; score_value: number | null }>();
  const rows = Array.isArray(res?.results) ? res.results : [];
  const out: ScoreItem[] = [];
  rows.forEach((r) => {
    const key = String(r.score_key ?? "").trim();
    const value = Math.floor(readNumber(r.score_value, 0));
    if (!key || value === 0) return;
    out.push({ scores: { [key]: value } });
  });
  return out;
}

async function loadMbtiItemsAggregated(
  db: D1Database,
  testId: string,
  answerIds: string[],
): Promise<MbtiScoringItem[]> {
  const uniq = Array.from(new Set(answerIds.map((v) => String(v || "").trim()))).filter(Boolean);
  if (!uniq.length) return [];
  const placeholders = uniq.map(() => "?").join(",");

  // Prefer MBTI effect table if present: aggregate by axis in D1 (return <= 4 rows).
  // NOTE: For older DBs without the table, this query will fail; we catch and fallback.
  const res = await db
    .prepare(
      `SELECT
         UPPER(TRIM(axis)) AS axis,
         SUM(COALESCE(delta, 0)) AS total
       FROM mbti_answer_effects
       WHERE test_id = ? AND answer_id IN (${placeholders})
         AND TRIM(COALESCE(axis, '')) <> ''
       GROUP BY UPPER(TRIM(axis))
       ORDER BY axis ASC`,
    )
    .bind(testId, ...uniq)
    .all<{ axis: string | null; total: number | null }>()
    .catch(() => null);

  const rows = Array.isArray(res?.results) ? res.results : [];
  const out: MbtiScoringItem[] = [];
  rows.forEach((r) => {
    const axis = String(r.axis ?? "").trim().toUpperCase() as MbtiAxis;
    if (!(axis === "EI" || axis === "SN" || axis === "TF" || axis === "JP")) return;
    const total = Math.trunc(readNumber(r.total, 0));
    if (total !== 0) out.push({ axis, delta: total });
  });

  // Legacy fallback: if no structured mbti_axis rows exist, try answer_id encoding.
  if (out.length) return out;

  // Next fallback: aggregate from legacy columns on `answers` (for DBs before mbti_answer_effects migration).
  const legacyAgg = await db
    .prepare(
      `SELECT
         UPPER(TRIM(mbti_axis)) AS axis,
         SUM(
           (CASE WHEN LOWER(TRIM(COALESCE(mbti_dir, ''))) = 'minus' THEN -1 ELSE 1 END)
           * ABS(COALESCE(weight, 1))
         ) AS total
       FROM answers
       WHERE test_id = ? AND answer_id IN (${placeholders})
         AND TRIM(COALESCE(mbti_axis, '')) <> ''
       GROUP BY UPPER(TRIM(mbti_axis))
       ORDER BY axis ASC`,
    )
    .bind(testId, ...uniq)
    .all<{ axis: string | null; total: number | null }>();

  const legacyAggRows = Array.isArray(legacyAgg?.results) ? legacyAgg.results : [];
  legacyAggRows.forEach((r) => {
    const axis = String(r.axis ?? "").trim().toUpperCase() as MbtiAxis;
    if (!(axis === "EI" || axis === "SN" || axis === "TF" || axis === "JP")) return;
    const total = Math.trunc(readNumber(r.total, 0));
    if (total !== 0) out.push({ axis, delta: total });
  });
  if (out.length) return out;

  const legacy = await db
    .prepare(
      `SELECT answer_id, COALESCE(weight, 1) AS weight
       FROM answers
       WHERE test_id = ? AND answer_id IN (${placeholders})
       ORDER BY answer_id ASC`,
    )
    .bind(testId, ...uniq)
    .all<{ answer_id: string; weight: number | null }>();

  const legacyRows = Array.isArray(legacy?.results) ? legacy.results : [];
  legacyRows.forEach((r) => {
    const fallback = inferMbtiFromAnswerId(String(r.answer_id ?? ""));
    if (!fallback) return;
    const w = Math.max(1, Math.floor(readNumber(r.weight, 1)));
    const pm = mbtiLetterToPlusMinus(fallback.mbtiAxis, fallback.direction);
    out.push({ axis: fallback.mbtiAxis, delta: pm === "plus" ? w : -w });
  });

  return out;
}

async function loadScoreItemsAggregated(
  db: D1Database,
  testId: string,
  answerIds: string[],
): Promise<ScoreItem[]> {
  const uniq = Array.from(new Set(answerIds.map((v) => String(v || "").trim()))).filter(Boolean);
  if (!uniq.length) return [];
  const placeholders = uniq.map(() => "?").join(",");

  // Aggregate in D1 (returns <= number of distinct score_key).
  const res = await db
    .prepare(
      `SELECT
         TRIM(COALESCE(score_key, '')) AS score_key,
         SUM(COALESCE(score_value, 0)) AS total
       FROM answers
       WHERE test_id = ? AND answer_id IN (${placeholders})
         AND TRIM(COALESCE(score_key, '')) <> ''
       GROUP BY TRIM(COALESCE(score_key, ''))
       ORDER BY score_key ASC`,
    )
    .bind(testId, ...uniq)
    .all<{ score_key: string | null; total: number | null }>();

  const rows = Array.isArray(res?.results) ? res.results : [];
  if (!rows.length) return [];

  // Build a single "totals" score object so we don't re-sum per-answer in JS.
  const scores: Record<string, number> = {};
  rows.forEach((r) => {
    const key = String(r.score_key ?? "").trim();
    if (!key) return;
    const total = Math.floor(readNumber(r.total, 0));
    if (total === 0) return;
    scores[key] = total;
  });
  return Object.keys(scores).length ? [{ scores }] : [];
}


