import { JSON_HEADERS } from "../utils/store.js";
import {
  encodeDescriptionText,
  encodeTagsText,
  decodeTagsText,
} from "../../utils/codecs.js";

const AXIS_SET = new Set(["EI", "SN", "TF", "JP"]);
const MBTI_ORDER = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISTP",
  "ESTJ",
  "ESTP",
  "ISFJ",
  "ISFP",
  "ESFJ",
  "ESFP",
];

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function badRequest(message) {
  return createJsonResponse({ error: message }, 400);
}

function methodNotAllowed() {
  return createJsonResponse({ error: "Method not allowed." }, 405);
}

function validateTestPayload(test) {
  if (!test.id) return "Missing test id.";
  if (!test.title || !String(test.title).trim()) return "Test title required.";
  if (!Array.isArray(test.questions) || test.questions.length === 0)
    return "At least one question is required.";

  for (let i = 0; i < test.questions.length; i += 1) {
    const question = test.questions[i];
    if (!question || typeof question !== "object")
      return `Question ${i + 1} is invalid.`;
    if (!question.prompt && !question.label)
      return `Question ${i + 1} needs prompt or label.`;
    if (!Array.isArray(question.answers) || question.answers.length < 2)
      return `Question ${i + 1} needs at least two answers.`;

    for (let j = 0; j < question.answers.length; j += 1) {
      const answer = question.answers[j];
      if (!answer || typeof answer !== "object")
        return `Question ${i + 1} answer ${j + 1} is invalid.`;
      if (!answer.label || !String(answer.label).trim())
        return `Question ${i + 1} answer ${j + 1} needs a label.`;
      if (!answer.mbtiAxis || !AXIS_SET.has(answer.mbtiAxis))
        return `Question ${i + 1} answer ${j + 1} has invalid mbtiAxis.`;
      if (!answer.direction || !String(answer.direction).trim())
        return `Question ${i + 1} answer ${j + 1} needs a direction.`;
    }
  }

  if (!test.results || typeof test.results !== "object")
    return "Results must be an object.";

  const codes = Object.keys(test.results);
  if (codes.length === 0)
    return "Results must contain at least one MBTI entry.";

  for (const code of codes) {
    if (!MBTI_ORDER.includes(code))
      return `Result code "${code}" is not a valid MBTI type.`;
    const details = test.results[code];
    if (!details || typeof details !== "object")
      return `Result ${code} must be an object.`;
    if (!details.image || !String(details.image).trim())
      return `Result ${code} needs an image path.`;
    if (!details.summary || !String(details.summary).trim())
      return `Result ${code} needs a summary.`;
  }

  return null;
}

export async function onRequestPut(context) {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const db = context.env.MBTI_DB;
  if (!db)
    return createJsonResponse({ error: "D1 binding MBTI_DB is missing." }, 500);
  const bucket = context.env.MBTI_BUCKET;

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return badRequest("Missing test id.");

  let payload;
  try {
    payload = await context.request.json();
  } catch (err) {
    return badRequest("Request body must be valid JSON.");
  }

  if (payload.id && payload.id !== testId)
    return badRequest("Payload id must match the URL parameter.");

  const testPayload = { ...payload, id: testId };
  const validationError = validateTestPayload(testPayload);
  if (validationError) return badRequest(validationError);

  try {
    const existing = await db
      .prepare(`SELECT created_at FROM tests WHERE id = ?`)
      .bind(testId)
      .first();

    const nowIso = new Date().toISOString();
    const createdAt = existing?.created_at || nowIso;
    const updatedAt = nowIso;

    const statements = [];
    statements.push(db.prepare("DELETE FROM answers WHERE test_id = ?").bind(testId));
    statements.push(db.prepare("DELETE FROM questions WHERE test_id = ?").bind(testId));
    statements.push(db.prepare("DELETE FROM outcomes WHERE test_id = ?").bind(testId));
    statements.push(db.prepare("DELETE FROM tests WHERE id = ?").bind(testId));

    const rulesJson = JSON.stringify({
      mode: "mbtiAxes",
      axisOrder: ["EI", "SN", "TF", "JP"],
      axisDefaults: { EI: "I", SN: "S", TF: "T", JP: "J" },
    });

    statements.push(
      db
        .prepare(
          `INSERT INTO tests (id, title, type, description_text, tags_text, author, author_img, thumbnail, rules_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          testId,
          String(testPayload.title || ""),
          "mbti",
          encodeDescriptionText(testPayload.description || ""),
          encodeTagsText(testPayload.tags || []),
          String(testPayload.author || ""),
          String(testPayload.authorImg || ""),
          String(testPayload.thumbnail || ""),
          rulesJson,
          createdAt,
          updatedAt,
        ),
    );

    const questions = Array.isArray(testPayload.questions) ? testPayload.questions : [];
    questions.forEach((q, qIndex) => {
      const qid = String(q?.id || "").trim() || `q${qIndex + 1}`;
      const label = String(q?.label || "").trim();
      const promptImage = String(q?.prompt || "").trim();
      statements.push(
        db
          .prepare(
            `INSERT INTO questions (test_id, question_id, ord, label, prompt_image, prompt_text, prompt_meta_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(testId, qid, qIndex, label, promptImage, "", "", createdAt, updatedAt),
      );

      const answers = Array.isArray(q?.answers) ? q.answers : [];
      answers.forEach((a, aIndex) => {
        const aid = String(a?.id || "").trim() || `${qid}_a${aIndex + 1}`;
        const aLabel = String(a?.label || "").trim();
        const axis = String(a?.mbtiAxis || "").trim();
        const dir = String(a?.direction || "").trim();
        const payloadJson = JSON.stringify(
          axis && dir ? { mbtiAxis: axis, direction: dir, axis, dir, weight: 1 } : {},
        );
        statements.push(
          db
            .prepare(
              `INSERT INTO answers (test_id, answer_id, question_id, ord, label, payload_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(testId, aid, qid, aIndex, aLabel, payloadJson, createdAt, updatedAt),
        );
      });
    });

    const results = testPayload.results && typeof testPayload.results === "object" ? testPayload.results : {};
    Object.keys(results).forEach((code) => {
      const details = results[code] || {};
      statements.push(
        db
          .prepare(
            `INSERT INTO outcomes (test_id, code, title, image, summary, meta_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            testId,
            String(code),
            "",
            String(details.image || ""),
            String(details.summary || ""),
            "",
            createdAt,
            updatedAt,
          ),
      );
    });

    await db.batch(statements);

    // Optional legacy compatibility: regenerate assets/index.json from D1.
    // This keeps older clients/tools working without making D1 the only access path.
    if (bucket && String(context.env.EMIT_INDEX_ON_SAVE || "") === "1") {
      await emitIndexJsonToR2({ db, bucket });
    }

    const meta = {
      id: testId,
      title: testPayload.title || "제목 없는 테스트",
      thumbnail: testPayload.thumbnail || "",
      tags: Array.isArray(testPayload.tags) ? [...testPayload.tags] : [],
      path: `${testId}/test.json`,
      createdAt: createdAt.split("T")[0],
      updatedAt: updatedAt.split("T")[0],
    };

    return createJsonResponse({ ok: true, test: testPayload, meta });
  } catch (err) {
    return createJsonResponse(
      { error: err instanceof Error ? err.message : "Failed to save test." },
      500,
    );
  }
}

async function emitIndexJsonToR2({ db, bucket }) {
  const res = await db
    .prepare(
      `SELECT id, title, thumbnail, tags_text, created_at, updated_at
       FROM tests
       ORDER BY updated_at DESC`,
    )
    .all();
  const rows = Array.isArray(res?.results) ? res.results : [];
  const tests = rows.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    thumbnail: r.thumbnail ?? "",
    tags: decodeTagsText(r.tags_text ?? ""),
    path: `${String(r.id || "")}/test.json`,
    createdAt: (r.created_at ?? "").slice(0, 10),
    updatedAt: (r.updated_at ?? "").slice(0, 10),
  }));

  await bucket.put("assets/index.json", JSON.stringify({ tests }, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl:
        "public, max-age=60, must-revalidate, stale-while-revalidate=600",
    },
  });
}
