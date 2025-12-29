/**
 * API: `GET /api/tests/:id/quiz`
 *
 * Returns quiz payload only (questions + answers, N answers supported).
 */

import type { PagesContext } from "../../types/bindings.d.ts";
import { requireDb } from "../../utils/bindings.js";
import { JSON_HEADERS, errorResponse, jsonResponse, withCacheHeaders } from "../../utils/http.js";

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
    .prepare(`SELECT id, title, type, updated_at FROM tests WHERE id = ?`)
    .bind(id)
    .first();

  if (!testRow) return errorResponse("Test not found: " + id, 404);

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
  const questions: Array<{
    id: string;
    label: string;
    prompt: string;
    answers: Array<{ id: string; label: string }>;
  }> = [];

  if (questionsRows.length) {
    // Fetch all answers in one query and group in JS.
    const aRes = await db
      .prepare(
        `SELECT answer_id, question_id, ord, answer
         FROM answers
         WHERE test_id = ?
         ORDER BY question_id ASC, ord ASC`,
      )
      .bind(id)
      .all();
    const answerRows = (Array.isArray(aRes?.results) ? aRes.results : []) as AnswerRow[];
    const answersByQuestion = new Map<string, Array<{ id: string; label: string }>>();
    answerRows.forEach((r) => {
      const qid = String(r.question_id || "");
      if (!qid) return;
      if (!answersByQuestion.has(qid)) answersByQuestion.set(qid, []);
      const list = answersByQuestion.get(qid);
      if (!list) return;
      list.push({ id: r.answer_id, label: r.answer ?? "" });
    });

    questionsRows.forEach((r) => {
      const qid = String(r.question_id || "");
      questions.push({
        id: qid,
        label: r.question ?? "",
        // Legacy-friendly: client supports string or {image}; keep it simple.
        prompt: r.question_image ?? "",
        answers: answersByQuestion.get(qid) || [],
      });
    });
  }

  const payload = {
    id: testRow.id,
    title: testRow.title ?? "",
    type: testRow.type ?? "generic",
    questions,
  };

  const etagBase = testRow.updated_at ?? "";
  const etag = etagBase ? `"d1-test-quiz-${id}-${etagBase}"` : "";
  const ifNoneMatch = context.request.headers.get("if-none-match");
  if (etag && ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 60 }),
    });
  }

  return jsonResponse(payload, { status: 200, headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 60 }) });
}
