import {
  encodeDescriptionText,
  encodeTagsText,
  decodeTagsText,
  decodeDescriptionText,
} from "../../utils/codecs.js";
import type { D1Database, PagesContext, R2Bucket } from "../../types/bindings.d.ts";
import { requireDb } from "../../utils/bindings.js";
import { errorResponse, jsonResponse, methodNotAllowed } from "../../utils/http.js";
import { isRecord, readNumber, readString, readStringArray } from "../../utils/guards.js";

type AdminAnswerPayload = Record<string, unknown>;
type AdminQuestionPayload = Record<string, unknown>;
type AdminResultsPayload = Record<string, unknown>;

type AdminTestPayload = Record<string, unknown> & {
  id: string;
  title: string;
  type?: string;
  description?: string | string[];
  tags?: string | string[];
  author?: string;
  authorImg?: string;
  thumbnail?: string;
  questions?: unknown;
  results?: unknown;
};

function validateTestPayload(test: unknown): string | null {
  if (!isRecord(test)) return "Invalid payload.";
  const id = readString(test.id).trim();
  const title = readString(test.title).trim();
  if (!id) return "Missing test id.";
  if (!title) return "Test title required.";
  // Allow drafts (empty questions/outcomes) while editing in admin.

  const questionsValue = test.questions;
  const questions = Array.isArray(questionsValue) ? questionsValue : [];
  for (let i = 0; i < questions.length; i += 1) {
    const question = questions[i];
    if (!isRecord(question)) return `Question ${i + 1} is invalid.`;
    if (
      !readString(question.question).trim() &&
      !readString(question.label).trim() &&
      !readString(question.question_image).trim() &&
      !readString(question.questionImage).trim() &&
      !readString(question.prompt).trim()
    )
      return `Question ${i + 1} needs question text or image.`;
    const answersValue = question.answers;
    const answers = Array.isArray(answersValue) ? answersValue : [];
    if (answers.length && answers.length < 2)
      return `Question ${i + 1} needs at least two answers.`;

    for (let j = 0; j < answers.length; j += 1) {
      const answer = answers[j];
      if (!isRecord(answer))
        return `Question ${i + 1} answer ${j + 1} is invalid.`;
      if (!readString(answer.answer).trim() && !readString(answer.label).trim())
        return `Question ${i + 1} answer ${j + 1} needs a label.`;
    }
  }

  return null;
}

function safeJsonStringify(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input.trim();
  try {
    return JSON.stringify(input);
  } catch {
    return "";
  }
}

function safeJsonParse(input: unknown): unknown {
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

function plusLetterByAxis(axisRaw: string): string {
  const axis = String(axisRaw || "").trim().toUpperCase();
  if (axis === "EI") return "E";
  if (axis === "SN") return "S";
  if (axis === "TF") return "T";
  if (axis === "JP") return "J";
  return "";
}

function mbtiSideToDelta(axisRaw: string, sideRaw: string, weightRaw: number): number {
  const axis = String(axisRaw || "").trim().toUpperCase();
  const side = String(sideRaw || "").trim().toUpperCase();
  const weight = Math.max(1, Math.floor(readNumber(weightRaw, 1)));
  const plus = plusLetterByAxis(axis);
  if (!axis || !side || !plus) return 0;
  const sign = side === plus ? 1 : -1;
  return sign * weight;
}

type GetParams = { id?: string };
export async function onRequestGet(context: PagesContext<GetParams>) {
  if (context.request.method !== "GET") return methodNotAllowed();
  const db = requireDb(context);
  if (db instanceof Response) return db;

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return errorResponse("Missing test id.", 400);

  try {
    const testRow = await db
      .prepare(
        `SELECT id, title, type, description_text, tags_text, author, author_img, thumbnail, created_at, updated_at
         FROM tests WHERE id = ?`,
      )
      .bind(testId)
      .first();

    if (!testRow) return errorResponse("Not found.", 404);

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
        `SELECT answer_id, question_id, ord, answer, pole_axis, pole_side, weight, score_key, score_value
         FROM answers
         WHERE test_id = ?
         ORDER BY question_id ASC, ord ASC`,
      )
      .bind(testId)
      .all();
    const answerRows = Array.isArray(answersRes?.results) ? answersRes.results : [];

    const outcomesRes = await db
      .prepare(
        `SELECT result_id, result_image, result_text
         FROM results
         WHERE test_id = ?
         ORDER BY result_id ASC`,
      )
      .bind(testId)
      .all();
    const outcomeRows = Array.isArray(outcomesRes?.results)
      ? outcomesRes.results
      : [];

    const results: Record<string, { title: string; image: string; summary: string; metaJson: string }> = {};
    outcomeRows.forEach((o: Record<string, unknown>) => {
      results[readString(o.result_id)] = {
        title: "",
        image: readString(o.result_image),
        summary: readString(o.result_text),
        metaJson: "",
      };
    });

    const questions = questionRows.map((q: Record<string, unknown>) => {
      const qid = readString(q.question_id);
      const answers = answerRows
        .filter((a: Record<string, unknown>) => readString(a.question_id) === qid)
        .map((a: Record<string, unknown>) => {
          const axis = readString(a.pole_axis).trim().toUpperCase();
          const side = readString(a.pole_side).trim().toUpperCase();
          const inferred =
            axis && side ? { mbtiAxis: axis, direction: side } : inferMbtiFromAnswerId(readString(a.answer_id));
          return {
            id: readString(a.answer_id),
            label: readString(a.answer),
            weight: readNumber(a.weight, 1),
            ...(inferred ? inferred : {}),
            scoreKey: readString(a.score_key),
            scoreValue: readNumber(a.score_value, 0),
          };
        });
      return {
        id: qid,
        label: readString(q.question),
        prompt: readString(q.question_image),
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

    return jsonResponse(payload);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load test.",
      500,
    );
  }
}

export async function onRequestPut(context: PagesContext<GetParams>) {
  if (context.request.method !== "PUT") return methodNotAllowed();
  const db = requireDb(context);
  if (db instanceof Response) return db;
  const bucket = context.env.MBTI_BUCKET;

  const testId = context.params?.id ? String(context.params.id).trim() : "";
  if (!testId) return errorResponse("Missing test id.", 400);

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  if (!isRecord(payload)) return errorResponse("Invalid payload.", 400);
  if (readString(payload.id) && readString(payload.id) !== testId)
    return errorResponse("Payload id must match the URL parameter.", 400);

  const testPayload = { ...payload, id: testId } as AdminTestPayload;
  const validationError = validateTestPayload(testPayload);
  if (validationError) return errorResponse(validationError, 400);

  try {
    const existing = await db
      .prepare(`SELECT created_at FROM tests WHERE id = ?`)
      .bind(testId)
      .first<{ created_at: string | null }>();

    const nowIso = new Date().toISOString();
    const createdAt = (existing?.created_at ?? "") || nowIso;
    const updatedAt = nowIso;

    const statements: ReturnType<D1Database["prepare"]>[] = [];
    statements.push(db.prepare("DELETE FROM mbti_answer_effects WHERE test_id = ?").bind(testId));
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
    questions.forEach((qUnknown: unknown, qIndex: number) => {
      const q = isRecord(qUnknown) ? qUnknown : {};
      const qid = readString(q.id).trim() || `q${qIndex + 1}`;
      const questionText = readString(q.question || q.label).trim();
      const questionImage = readString(q.questionImage || q.question_image || q.prompt).trim();
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

      const answers = Array.isArray(q.answers) ? (q.answers as unknown[]) : [];
      answers.forEach((aUnknown: unknown, aIndex: number) => {
        const a = isRecord(aUnknown) ? (aUnknown as AdminAnswerPayload) : {};
        const aid = readString(a.id).trim() || `${qid}_a${aIndex + 1}`;
        const answerText = readString(a.answer || a.label).trim();
        const mbtiAxis = readString(a.mbtiAxis).trim().toUpperCase();
        const direction = readString(a.direction).trim().toUpperCase();
        const inferred = (!direction && mbtiAxis) ? inferMbtiFromAnswerId(readString(aid)) : null;
        const poleAxis = mbtiAxis || inferred?.mbtiAxis || "";
        const poleSide = direction || inferred?.direction || "";
        const weight = Math.max(1, Math.floor(readNumber(a.weight, 1)));
        const scoreKey = readString(a.scoreKey).trim();
        const scoreValue = Math.floor(readNumber(a.scoreValue, 0));
        const delta = mbtiSideToDelta(poleAxis, poleSide, weight);
        statements.push(
          db
            .prepare(
              `INSERT INTO answers (test_id, answer_id, question_id, ord, answer, pole_axis, pole_side, weight, score_key, score_value, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              testId,
              aid,
              qid,
              aIndex,
              answerText,
              poleAxis,
              poleSide,
              weight,
              scoreKey,
              scoreValue,
              createdAt,
              updatedAt,
            ),
        );
        if (poleAxis) {
          statements.push(
            db
              .prepare(
                `INSERT INTO mbti_answer_effects (test_id, answer_id, axis, delta, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
              )
              .bind(testId, aid, poleAxis, delta, createdAt, updatedAt),
          );
        }
      });
    });

    const results = isRecord(testPayload.results) ? (testPayload.results as AdminResultsPayload) : {};
    Object.keys(results).forEach((code) => {
      const detailsRaw = results[code];
      const details = isRecord(detailsRaw) ? detailsRaw : {};
      statements.push(
        db
          .prepare(
            `INSERT INTO results (test_id, result_id, result_image, result_text, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            testId,
            String(code),
            readString(details.result_image || details.resultImage || details.image),
            readString(details.summary),
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
      title: readString(testPayload.title) || "제목 없는 테스트",
      thumbnail: readString(testPayload.thumbnail),
      tags: readStringArray(testPayload.tags),
      path: `${testId}/test.json`,
      createdAt: createdAt.split("T")[0],
      updatedAt: updatedAt.split("T")[0],
    };

    return jsonResponse({ ok: true, test: testPayload, meta });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to save test.",
      500,
    );
  }
}

async function emitIndexJsonToR2({ db, bucket }: { db: D1Database; bucket: R2Bucket }) {
  const res = await db
    .prepare(
      `SELECT id, title, thumbnail, tags_text, created_at, updated_at
       FROM tests
       ORDER BY updated_at DESC`,
    )
    .all();
  type TestIndexRow = {
    id: string;
    title: string | null;
    thumbnail: string | null;
    tags_text: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  const rows = (Array.isArray(res?.results) ? res.results : []) as TestIndexRow[];
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
