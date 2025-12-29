/**
 * API: `GET /api/tests/:id` (legacy)
 *
 * D1-backed endpoint that assembles a best-effort legacy `test.json` shape for compatibility.
 * New clients should prefer:
 * - `GET /api/tests/:id/meta`
 * - `GET /api/tests/:id/quiz`
 * - `POST /api/tests/:id/evaluate`
 * - `GET /api/tests/:id/outcome?code=...`
 */
import type { PagesContext } from "../types/bindings.d.ts";
import { decodeDescriptionText, decodeTagsText } from "../utils/codecs.js";
import { requireDb } from "../utils/bindings.js";
import { JSON_HEADERS, errorResponse, jsonResponse, withCacheHeaders } from "../utils/http.js";

/**
 * Cloudflare Pages Function entrypoint for `GET /api/tests/:id`.
 */
type TestRow = {
  id: string;
  title: string | null;
  type: string | null;
  description_text: string | null;
  tags_text: string | null;
  author: string | null;
  author_img: string | null;
  thumbnail: string | null;
  updated_at: string | null;
};

type QuestionRow = {
  question_id: string;
  ord: number;
  question: string | null;
  question_image: string | null;
};

type AnswerRow = {
  answer_id: string;
  question_id: string;
  ord: number;
  answer: string | null;
  mbti_axis: string | null;
  mbti_dir: string | null;
  weight: number | null;
};

type ResultRow = {
  result_id: string;
  result_image: string | null;
  result_text: string | null;
};

export async function onRequestGet(context: PagesContext<{ id?: string }>) {
  const db = requireDb(context);
  if (db instanceof Response) {
    return jsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );
  }

  const id = context.params?.id ? String(context.params.id) : "";
  if (!id) return errorResponse("Missing test id.", 400);

  const testRow = await db
    .prepare(
      `SELECT id, title, type, description_text, tags_text, author, author_img, thumbnail, updated_at
       FROM tests
       WHERE id = ?`,
    )
    .bind(id)
    .first();

  if (!testRow) return errorResponse("Test not found: " + id, 404);

  const ifNoneMatch = context.request.headers.get("if-none-match");
  const etagBase = testRow.updated_at ?? "";
  const etag = etagBase ? `"d1-test-legacy-${id}-${etagBase}"` : "";
  if (etag && ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 120 }),
    });
  }

  const qRes = await db
    .prepare(
      `SELECT question_id, ord, question, question_image
       FROM questions
       WHERE test_id = ?
       ORDER BY ord ASC`,
    )
    .bind(id)
    .all();
  const questionsRows = (Array.isArray(qRes?.results) ? qRes.results : []) as QuestionRow[];

  const aRes = await db
    .prepare(
      `SELECT answer_id, question_id, ord, answer, mbti_axis, mbti_dir, weight
       FROM answers
       WHERE test_id = ?
       ORDER BY question_id ASC, ord ASC`,
    )
    .bind(id)
    .all();
  const answerRows = (Array.isArray(aRes?.results) ? aRes.results : []) as AnswerRow[];
  type LegacyAnswer = {
    id: string;
    label: string;
    mbtiAxis: string;
    direction: string;
  };
  const answersByQuestion = new Map<string, LegacyAnswer[]>();
  answerRows.forEach((r) => {
    const qid = String(r.question_id || "");
    if (!qid) return;
    if (!answersByQuestion.has(qid)) answersByQuestion.set(qid, []);
    const list = answersByQuestion.get(qid);
    if (!list) return;
    const axis = String(r.mbti_axis ?? "").trim().toUpperCase();
    const dir = String(r.mbti_dir ?? "").trim().toUpperCase();
    const inferred =
      axis && dir ? { mbtiAxis: axis, direction: dir } : inferMbtiFromAnswerId(String(r.answer_id || ""));
    list.push({
      id: r.answer_id,
      label: r.answer ?? "",
      // Legacy compatibility: surface mbtiAxis/direction when encoded into answer_id.
      mbtiAxis: inferred?.mbtiAxis || "",
      direction: inferred?.direction || "",
    });
  });

  const questions = questionsRows.map((r) => {
    const qid = String(r.question_id || "");
    return {
      id: qid,
      label: r.question ?? "",
      prompt: r.question_image ?? "",
      answers: answersByQuestion.get(qid) || [],
    };
  });

  const outRes = await db
    .prepare(
      `SELECT result_id, result_image, result_text
       FROM results
       WHERE test_id = ?`,
    )
    .bind(id)
    .all();
  const outcomeRows = (Array.isArray(outRes?.results) ? outRes.results : []) as ResultRow[];
  const results: Record<string, { image: string; summary: string }> = {};
  outcomeRows.forEach((r) => {
    if (!r?.result_id) return;
    results[String(r.result_id)] = { image: r.result_image ?? "", summary: r.result_text ?? "" };
  });

  const test = testRow as TestRow;
  const payload = {
    id: test.id,
    title: test.title ?? "",
    description: decodeDescriptionText(test.description_text ?? ""),
    author: test.author ?? "",
    authorImg: test.author_img ?? "",
    tags: decodeTagsText(test.tags_text ?? ""),
    thumbnail: test.thumbnail ?? "",
    questions,
    results,
  };

  return jsonResponse(payload, { status: 200, headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 120 }) });
}

function inferMbtiFromAnswerId(answerId: string) {
  const upper = String(answerId || "").toUpperCase();
  const m1 = upper.match(
    /(?:^|[^A-Z0-9])(EI|SN|TF|JP)[_:\-](E|I|S|N|T|F|J|P)(?:$|[^A-Z0-9])/,
  );
  if (m1) return { mbtiAxis: m1[1], direction: m1[2] };
  const axis = upper.match(/\bAXIS\s*=\s*(EI|SN|TF|JP)\b/);
  const dir = upper.match(/\b(DIR|DIRECTION)\s*=\s*(E|I|S|N|T|F|J|P)\b/);
  if (axis && dir) return { mbtiAxis: axis[1], direction: dir[2] };
  return null;
}
