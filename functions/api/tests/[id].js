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
function withCacheHeaders(headers, { etag, maxAge = 60 } = {}) {
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
export async function onRequestGet(context) {
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
      `SELECT question_id, ord, label, prompt_image
       FROM questions
       WHERE test_id = ?
       ORDER BY ord ASC`,
    )
    .bind(id)
    .all();
  const questionsRows = Array.isArray(qRes?.results) ? qRes.results : [];

  const aRes = await db
    .prepare(
      `SELECT answer_id, question_id, ord, label, payload_json
       FROM answers
       WHERE test_id = ?
       ORDER BY question_id ASC, ord ASC`,
    )
    .bind(id)
    .all();
  const answerRows = Array.isArray(aRes?.results) ? aRes.results : [];
  const answersByQuestion = new Map();
  answerRows.forEach((r) => {
    const qid = String(r.question_id || "");
    if (!qid) return;
    if (!answersByQuestion.has(qid)) answersByQuestion.set(qid, []);
    const payload = safeJsonParse(r.payload_json) || {};
    answersByQuestion.get(qid).push({
      id: r.answer_id,
      label: r.label ?? "",
      // Legacy compatibility: try to surface mbtiAxis/direction when present.
      mbtiAxis: payload.mbtiAxis || payload.axis || "",
      direction: payload.direction || payload.dir || "",
    });
  });

  const questions = questionsRows.map((r) => {
    const qid = String(r.question_id || "");
    return {
      id: qid,
      label: r.label ?? "",
      prompt: r.prompt_image ?? "",
      answers: answersByQuestion.get(qid) || [],
    };
  });

  const outRes = await db
    .prepare(
      `SELECT code, image, summary
       FROM outcomes
       WHERE test_id = ?`,
    )
    .bind(id)
    .all();
  const outcomeRows = Array.isArray(outRes?.results) ? outRes.results : [];
  const results = {};
  outcomeRows.forEach((r) => {
    if (!r?.code) return;
    results[String(r.code)] = {
      image: r.image ?? "",
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

function safeJsonParse(raw) {
  try {
    return JSON.parse(String(raw));
  } catch (e) {
    return null;
  }
}
