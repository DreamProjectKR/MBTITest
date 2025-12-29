/**
 * API: `GET /api/tests/:id/quiz`
 *
 * Returns quiz payload only (questions + answers, N answers supported).
 */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

function withCacheHeaders(
  headers: HeadersInit,
  { etag, maxAge = 60 }: { etag?: string; maxAge?: number } = {},
): Headers {
  const h = new Headers(headers);
  h.set(
    "Cache-Control",
    `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 10}`,
  );
  if (etag) h.set("ETag", etag);
  return h;
}

export async function onRequestGet(context: any) {
  const db = context.env.MBTI_DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 binding MBTI_DB is missing." }), {
      status: 500,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
    });
  }

  const id = context.params?.id ? String(context.params.id) : "";
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing test id." }), {
      status: 400,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }),
    });
  }

  const testRow = await db
    .prepare(`SELECT id, title, type, updated_at FROM tests WHERE id = ?`)
    .bind(id)
    .first();

  if (!testRow) {
    return new Response(JSON.stringify({ error: "Test not found: " + id }), {
      status: 404,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }),
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

  const questionsRows = Array.isArray(qRes?.results) ? qRes.results : [];
  const questions: any[] = [];

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
    const answerRows = Array.isArray(aRes?.results) ? aRes.results : [];
    const answersByQuestion = new Map();
    answerRows.forEach((r: any) => {
      const qid = String(r.question_id || "");
      if (!qid) return;
      if (!answersByQuestion.has(qid)) answersByQuestion.set(qid, []);
      answersByQuestion.get(qid).push({
        id: r.answer_id,
        label: r.answer ?? "",
      });
    });

    questionsRows.forEach((r: any) => {
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

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 60 }),
  });
}
