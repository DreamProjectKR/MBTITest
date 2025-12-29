import { JSON_HEADERS } from "../utils/store.js";
import {
  encodeDescriptionText,
  encodeTagsText,
  decodeTagsText,
  decodeDescriptionText,
} from "../../utils/codecs.js";

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function badRequest(message: string) {
  return createJsonResponse({ error: message }, 400);
}

function methodNotAllowed() {
  return createJsonResponse({ error: "Method not allowed." }, 405);
}

function validateTestPayload(test: any): string | null {
  if (!test.id) return "Missing test id.";
  if (!test.title || !String(test.title).trim()) return "Test title required.";
  // Allow drafts (empty questions/outcomes) while editing in admin.

  const questions = Array.isArray(test.questions) ? test.questions : [];
  for (let i = 0; i < questions.length; i += 1) {
    const question = test.questions[i];
    if (!question || typeof question !== "object")
      return `Question ${i + 1} is invalid.`;
    if (
      !question.question &&
      !question.label &&
      !question.question_image &&
      !question.questionImage &&
      !question.prompt
    )
      return `Question ${i + 1} needs question text or image.`;
    const answers = Array.isArray(question.answers) ? question.answers : [];
    if (answers.length && answers.length < 2)
      return `Question ${i + 1} needs at least two answers.`;

    for (let j = 0; j < answers.length; j += 1) {
      const answer = answers[j];
      if (!answer || typeof answer !== "object")
        return `Question ${i + 1} answer ${j + 1} is invalid.`;
      if (!answer.answer && !answer.label)
        return `Question ${i + 1} answer ${j + 1} needs a label.`;
    }
  }

  return null;
}

function safeJsonStringify(input: any): string {
  if (!input) return "";
  if (typeof input === "string") return input.trim();
  try {
    return JSON.stringify(input);
  } catch {
    return "";
  }
}

function safeJsonParse(input: any): any {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function inferMbtiFromAnswerId(answerId: string) {
  const upper = String(answerId || "").toUpperCase();
  const m1 = upper.match(
    /(?:^|[^A-Z0-9])(EI|SN|TF|JP)[_:\-](E|I|S|N|T|F|J|P)(?:$|[^A-Z0-9])/,
  );
  if (m1) return { mbtiAxis: m1[1], direction: m1[2] };
  return null;
}

export async function onRequestGet(context: any) {
  if (context.request.method !== "GET") return methodNotAllowed();
  const db = context.env.MBTI_DB;
  if (!db)
    return createJsonResponse({ error: "D1 binding MBTI_DB is missing." }, 500);

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return badRequest("Missing test id.");

  try {
    const testRow = await db
      .prepare(
        `SELECT id, title, type, description_text, tags_text, author, author_img, thumbnail, created_at, updated_at
         FROM tests WHERE id = ?`,
      )
      .bind(testId)
      .first();

    if (!testRow) return createJsonResponse({ error: "Not found." }, 404);

    const questionsRes = await db
      .prepare(
        `SELECT question_id, ord, question, question_image
         FROM questions
         WHERE test_id = ?
         ORDER BY ord ASC`,
      )
      .bind(testId)
      .all();
    const questionRows = Array.isArray(questionsRes?.results)
      ? questionsRes.results
      : [];

    const answersRes = await db
      .prepare(
        `SELECT answer_id, question_id, ord, answer, mbti_axis, mbti_dir, weight, score_key, score_value
         FROM answers
         WHERE test_id = ?
         ORDER BY question_id ASC, ord ASC`,
      )
      .bind(testId)
      .all();
    const answerRows = Array.isArray(answersRes?.results) ? answersRes.results : [];

    const outcomesRes = await db
      .prepare(
        `SELECT result, result_image, summary
         FROM results
         WHERE test_id = ?
         ORDER BY result ASC`,
      )
      .bind(testId)
      .all();
    const outcomeRows = Array.isArray(outcomesRes?.results)
      ? outcomesRes.results
      : [];

    const results: any = {};
    outcomeRows.forEach((o: any) => {
      results[String(o.result)] = {
        title: "",
        image: String(o.result_image ?? ""),
        summary: String(o.summary ?? ""),
        metaJson: "",
      };
    });

    const questions = questionRows.map((q: any) => {
      const qid = String(q.question_id);
      const answers = answerRows
        .filter((a: any) => String(a.question_id) === qid)
        .map((a: any) => {
          const mbti =
            a.mbti_axis
              ? { mbtiAxis: String(a.mbti_axis), direction: "" }
              : inferMbtiFromAnswerId(String(a.answer_id ?? ""));
          return {
            id: String(a.answer_id),
            label: String(a.answer ?? ""),
            ...(mbti ? mbti : {}),
            weight: Number.isFinite(Number(a.weight)) ? Number(a.weight) : 1,
            mbtiDir:
              String(a.mbti_dir ?? "").trim().toLowerCase() === "minus" ? "minus" : "plus",
            scoreKey: String(a.score_key ?? ""),
            scoreValue: Number.isFinite(Number(a.score_value)) ? Number(a.score_value) : 0,
          };
        });
      return {
        id: qid,
        label: String(q.question ?? ""),
        prompt: String(q.question_image ?? ""),
        promptText: "",
        promptMetaJson: "",
        answers,
      };
    });

    const payload = {
      id: String(testRow.id),
      title: String(testRow.title ?? ""),
      type: String(testRow.type ?? "generic"),
      description: decodeDescriptionText(String(testRow.description_text ?? "")),
      tags: decodeTagsText(String(testRow.tags_text ?? "")),
      author: String(testRow.author ?? ""),
      authorImg: String(testRow.author_img ?? ""),
      thumbnail: String(testRow.thumbnail ?? ""),
      rulesJson: "",
      createdAt: String(testRow.created_at ?? ""),
      updatedAt: String(testRow.updated_at ?? ""),
      questions,
      results,
    };

    return createJsonResponse(payload);
  } catch (err) {
    return createJsonResponse(
      { error: err instanceof Error ? err.message : "Failed to load test." },
      500,
    );
  }
}

export async function onRequestPut(context: any) {
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
    statements.push(db.prepare("DELETE FROM results WHERE test_id = ?").bind(testId));
    statements.push(db.prepare("DELETE FROM tests WHERE id = ?").bind(testId));

    const testType = String(testPayload.type || "generic");

    statements.push(
      db
        .prepare(
          `INSERT INTO tests (id, title, type, description_text, tags_text, author, author_img, thumbnail, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          testId,
          String(testPayload.title || ""),
          testType,
          encodeDescriptionText(testPayload.description || ""),
          encodeTagsText(testPayload.tags || []),
          String(testPayload.author || ""),
          String(testPayload.authorImg || ""),
          String(testPayload.thumbnail || ""),
          createdAt,
          updatedAt,
        ),
    );

    const questions = Array.isArray(testPayload.questions) ? testPayload.questions : [];
    questions.forEach((q: any, qIndex: number) => {
      const qid = String(q?.id || "").trim() || `q${qIndex + 1}`;
      const questionText = String(q?.question || q?.label || "").trim();
      const questionImage = String(q?.questionImage || q?.question_image || q?.prompt || "").trim();
      statements.push(
        db
          .prepare(
            `INSERT INTO questions (test_id, question_id, ord, question, question_image, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            testId,
            qid,
            qIndex,
            questionText,
            questionImage,
            createdAt,
            updatedAt,
          ),
      );

      const answers = Array.isArray(q?.answers) ? q.answers : [];
      answers.forEach((a: any, aIndex: number) => {
        const aid = String(a?.id || "").trim() || `${qid}_a${aIndex + 1}`;
        const answerText = String(a?.answer || a?.label || "").trim();
        const mbtiAxis = String(a?.mbtiAxis || "").trim().toUpperCase();
        const mbtiDir =
          String(a?.mbtiDir || "").trim().toLowerCase() === "minus" ? "minus" : "plus";
        const weight = Number.isFinite(Number(a?.weight)) ? Number(a.weight) : 1;
        const scoreKey = String(a?.scoreKey || "").trim();
        const scoreValue = Number.isFinite(Number(a?.scoreValue))
          ? Number(a.scoreValue)
          : 0;
        statements.push(
          db
            .prepare(
              `INSERT INTO answers (test_id, answer_id, question_id, ord, answer, mbti_axis, mbti_dir, weight, score_key, score_value, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              testId,
              aid,
              qid,
              aIndex,
              answerText,
              mbtiAxis,
              mbtiDir,
              weight,
              scoreKey,
              scoreValue,
              createdAt,
              updatedAt,
            ),
        );
      });
    });

    const results =
      testPayload.results && typeof testPayload.results === "object"
        ? testPayload.results
        : {};
    Object.keys(results).forEach((code) => {
      const details = results[code] || {};
      statements.push(
        db
          .prepare(
            `INSERT INTO results (test_id, result, result_image, summary, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            testId,
            String(code),
            String(details.result_image || details.resultImage || details.image || ""),
            String(details.summary || ""),
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

async function emitIndexJsonToR2({ db, bucket }: { db: any; bucket: any }) {
  const res = await db
    .prepare(
      `SELECT id, title, thumbnail, tags_text, created_at, updated_at
       FROM tests
       ORDER BY updated_at DESC`,
    )
    .all();
  const rows = Array.isArray(res?.results) ? res.results : [];
  const tests = rows.map((r: any) => ({
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
