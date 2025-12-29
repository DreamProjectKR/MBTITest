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
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

import { decodeDescriptionText, decodeTagsText } from "../utils/codecs.js";

/**
 * Add caching headers to a response.
 * @param {Record<string, string> | Headers} headers
 * @param {{ etag?: string, maxAge?: number }} [opts]
 * @returns {Headers}
 */
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

/**
 * Cloudflare Pages Function entrypoint for `GET /api/tests/:id`.
 * @param {{ request: Request, env: any, params?: { id?: string } }} context
 * @returns {Promise<Response>}
 */
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
    .prepare(
      `SELECT id, title, type, description_text, tags_text, author, author_img, thumbnail, updated_at
       FROM tests
       WHERE id = ?`,
    )
    .bind(id)
    .first();

  if (!testRow) {
    return new Response(JSON.stringify({ error: "Test not found: " + id }), {
      status: 404,
      headers: withCacheHeaders(JSON_HEADERS, { maxAge: 30 }),
    });
  }

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
  const questionsRows = Array.isArray(qRes?.results) ? qRes.results : [];

  const aRes = await db
    .prepare(
      `SELECT answer_id, question_id, ord, answer, mbti_axis, mbti_dir, weight
       FROM answers
       WHERE test_id = ?
       ORDER BY question_id ASC, ord ASC`,
    )
    .bind(id)
    .all();
  const answerRows = Array.isArray(aRes?.results) ? aRes.results : [];
  const answersByQuestion = new Map<string, any[]>();
  answerRows.forEach((r: any) => {
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

  const questions = questionsRows.map((r: any) => {
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
      `SELECT result, result_image, summary
       FROM results
       WHERE test_id = ?`,
    )
    .bind(id)
    .all();
  const outcomeRows = Array.isArray(outRes?.results) ? outRes.results : [];
  const results: Record<string, { image: string; summary: string }> = {};
  outcomeRows.forEach((r: any) => {
    if (!r?.result) return;
    results[String(r.result)] = {
      image: r.result_image ?? "",
      summary: r.summary ?? "",
    };
  });

  const payload = {
    id: testRow.id,
    title: testRow.title ?? "",
    description: decodeDescriptionText(testRow.description_text ?? ""),
    author: testRow.author ?? "",
    authorImg: testRow.author_img ?? "",
    tags: decodeTagsText(testRow.tags_text ?? ""),
    thumbnail: testRow.thumbnail ?? "",
    questions,
    results,
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: withCacheHeaders(JSON_HEADERS, { etag, maxAge: 120 }),
  });
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
