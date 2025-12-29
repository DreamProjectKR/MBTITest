/**
 * Admin API: `POST /api/admin/import-d1`
 *
 * Protected endpoint that imports existing R2 test.json data into D1.
 * (Implementation is filled in subsequent steps.)
 */

import { encodeDescriptionText, encodeTagsText } from "../utils/codecs.js";
import type { D1Database, PagesContext, R2Bucket } from "../types/bindings.d.ts";
import { requireBucket, requireDb } from "../utils/bindings.js";
import { JSON_HEADERS, errorResponse, jsonResponse, withCacheHeaders } from "../utils/http.js";
import { isRecord, readString } from "../utils/guards.js";

function hasValidAuth(request: Request, token: string) {
  if (!token) return false;
  const raw = request.headers.get("authorization") || "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return m[1] === token;
}

type LegacyAnswerJson = {
  id?: string;
  label?: string;
  mbtiAxis?: string;
  direction?: string;
};

type LegacyQuestionJson = {
  id?: string;
  label?: string;
  prompt?: string;
  answers?: LegacyAnswerJson[];
};

type LegacyResultJson = { image?: string; summary?: string; };

type LegacyTestJson = {
  id?: string;
  title?: string;
  author?: string;
  authorImg?: string;
  thumbnail?: string;
  description?: string | string[];
  tags?: string | string[];
  questions?: LegacyQuestionJson[];
  results?: Record<string, LegacyResultJson>;
};

type ImportReportEntry = {
  id: string;
  ok: boolean;
  key: string;
  title?: string;
  metaCreatedAt?: string;
  metaUpdatedAt?: string;
  questionCount?: number;
  outcomeCount?: number;
  errors: string[];
  _testJson?: LegacyTestJson | null;
};

export async function onRequestPost(context: PagesContext) {
  const token = context.env.ADMIN_TOKEN || "";
  if (!hasValidAuth(context.request, token))
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });

  const bucket = requireBucket(context);
  if (bucket instanceof Response)
    return jsonResponse(
      { error: "R2 binding MBTI_BUCKET is missing." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );

  const db = requireDb(context);
  if (db instanceof Response)
    return jsonResponse(
      { error: "D1 binding MBTI_DB is missing." },
      { status: 500, headers: withCacheHeaders(JSON_HEADERS, { maxAge: 0 }) },
    );

  const url = new URL(context.request.url);
  const onlyTestId = (url.searchParams.get("testId") || "").trim();
  const apply =
    url.searchParams.get("apply") === "1" ||
    url.searchParams.get("apply") === "true";

  let body: unknown = null;
  try {
    body = await context.request.json();
  } catch {
    // allow empty body
  }
  const shouldApply =
    Boolean(apply) || (isRecord(body) && body.apply === true);

  // Step 1: scan R2 and validate payloads (no DB writes yet).
  const indexObj = await bucket.get("assets/index.json");
  if (!indexObj)
    return jsonResponse(
      { error: "index.json not found in R2 (assets/index.json)." },
      { status: 404 },
    );

  let index: unknown;
  try {
    index = JSON.parse(await indexObj.text());
  } catch {
    return jsonResponse({ error: "index.json is invalid JSON." }, { status: 500 });
  }

  const testsValue = isRecord(index) ? index.tests : null;
  const tests = Array.isArray(testsValue) ? testsValue : [];
  const selected = onlyTestId
    ? tests.filter((t) => isRecord(t) && readString(t.id) === onlyTestId)
    : tests;

  const report: ImportReportEntry[] = [];
  for (const metaUnknown of selected) {
    const meta = isRecord(metaUnknown) ? metaUnknown : {};
    const id = readString(meta.id).trim();
    if (!id) continue;
    const key = normalizeIndexPathToR2Key(meta.path || `${id}/test.json`);
    // eslint-disable-next-line no-await-in-loop
    const obj = await bucket.get(key);
    if (!obj) {
      report.push({ id, ok: false, key, errors: ["Missing test.json in R2."] });
      continue;
    }
    let testJson: unknown;
    try {
      // eslint-disable-next-line no-await-in-loop
      testJson = JSON.parse(await obj.text());
    } catch (e) {
      report.push({ id, ok: false, key, errors: ["test.json is invalid JSON."] });
      continue;
    }

    const errors = validateTestJsonShape(testJson);
    report.push({
      id,
      ok: errors.length === 0,
      key,
      title: isRecord(testJson) ? readString(testJson.title) : "",
      metaCreatedAt: readString(meta.createdAt),
      metaUpdatedAt: readString(meta.updatedAt),
      questionCount:
        isRecord(testJson) && Array.isArray(testJson.questions)
          ? testJson.questions.length
          : 0,
      outcomeCount:
        isRecord(testJson) && isRecord(testJson.results)
          ? Object.keys(testJson.results).length
          : 0,
      errors,
      _testJson: errors.length === 0 ? (testJson as LegacyTestJson) : null,
    });
  }

  const okCount = report.filter((r) => r.ok).length;

  if (!shouldApply) {
    // strip large payloads from response
    const cleaned = report.map(({ _testJson, ...rest }) => rest);
    return jsonResponse({
      ok: true,
      applied: false,
      scanned: report.length,
      valid: okCount,
      invalid: report.length - okCount,
      report: cleaned,
      hint: "To apply import, call with ?apply=1 or JSON body {\"apply\":true}.",
    });
  }

  // Step 2: Upsert normalized rows into D1.
  let imported = 0;
  const importErrors: Array<{ id: string; error: string; }> = [];
  for (const entry of report) {
    if (!entry.ok || !entry._testJson) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await upsertTestIntoD1(db, entry, entry._testJson);
      imported += 1;
    } catch (e) {
      importErrors.push({
        id: entry.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const cleaned = report.map(({ _testJson, ...rest }) => rest);
  return jsonResponse({
    ok: importErrors.length === 0,
    applied: true,
    scanned: report.length,
    valid: okCount,
    imported,
    importErrors,
    report: cleaned,
  });
}

function normalizeIndexPathToR2Key(rawPath: unknown): string {
  const str = String(rawPath || "").trim().replace(/^\.?\/+/, "");
  if (!str) return "";
  return str.startsWith("assets/") ? str : `assets/${str}`;
}

function validateTestJsonShape(test: unknown): string[] {
  const errs: string[] = [];
  if (!isRecord(test)) return ["test.json must be an object."];
  if (!readString(test.id)) errs.push("Missing test.id");
  if (!readString(test.title)) errs.push("Missing test.title");
  if (!Array.isArray(test.questions) || test.questions.length === 0)
    errs.push("Missing or empty questions[]");
  if (!isRecord(test.results))
    errs.push("Missing results{} (MBTI-style).");

  if (Array.isArray(test.questions)) {
    test.questions.forEach((qUnknown, idx: number) => {
      const q = isRecord(qUnknown) ? qUnknown : {};
      if (!readString(q.id)) errs.push(`Question ${idx + 1}: missing id`);
      if (!readString(q.prompt) && !readString(q.label))
        errs.push(`Question ${idx + 1}: missing prompt/label`);
      if (!Array.isArray(q.answers) || q.answers.length < 2)
        errs.push(`Question ${idx + 1}: answers must be an array (>=2)`);
    });
  }

  return errs;
}

async function upsertTestIntoD1(
  db: D1Database,
  metaEntry: ImportReportEntry,
  testJson: LegacyTestJson,
) {
  const testId = readString(testJson.id || metaEntry.id).trim();
  if (!testId) throw new Error("Missing test id for upsert.");

  const title = readString(testJson.title || metaEntry.title).trim();
  const author = readString(testJson.author).trim();
  const authorImg = readString(testJson.authorImg).trim();
  const thumbnail = readString(testJson.thumbnail).trim();

  const type = "mbti";

  const descriptionText = encodeDescriptionText(testJson.description || "");
  const tagsText = encodeTagsText(testJson.tags || []);
  const createdAt = readString(metaEntry.metaCreatedAt).trim();
  const updatedAt = readString(metaEntry.metaUpdatedAt).trim();
  const nowIso = new Date().toISOString();
  const createdAtValue = createdAt || nowIso;
  const updatedAtValue = updatedAt || createdAtValue;

  const statements: Array<ReturnType<D1Database["prepare"]>> = [];

  // Clear existing rows for idempotent import
  statements.push(db.prepare("DELETE FROM answers WHERE test_id = ?").bind(testId));
  statements.push(db.prepare("DELETE FROM questions WHERE test_id = ?").bind(testId));
  statements.push(db.prepare("DELETE FROM results WHERE test_id = ?").bind(testId));
  statements.push(db.prepare("DELETE FROM mbti_answer_effects WHERE test_id = ?").bind(testId));
  statements.push(db.prepare("DELETE FROM tests WHERE id = ?").bind(testId));

  statements.push(
    db
      .prepare(
        `INSERT INTO tests (id, title, type, description_text, tags_text, author, author_img, thumbnail, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        testId,
        title,
        type,
        descriptionText,
        tagsText,
        author,
        authorImg,
        thumbnail,
        createdAtValue,
        updatedAtValue,
      ),
  );

  const questions = Array.isArray(testJson.questions) ? testJson.questions : [];
  questions.forEach((q: LegacyQuestionJson, qIndex: number) => {
    const qid = readString(q?.id).trim() || `q${qIndex + 1}`;
    const questionText = readString(q?.label).trim();
    const questionImage = readString(q?.prompt).trim();
    statements.push(
      db
        .prepare(
          `INSERT INTO questions (test_id, question_id, ord, question, question_image)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(testId, qid, qIndex, questionText, questionImage),
    );

    const answers = Array.isArray(q?.answers) ? q.answers : [];
    answers.forEach((a: LegacyAnswerJson, aIndex: number) => {
      const aid = readString(a?.id).trim() || `${qid}_a${aIndex + 1}`;
      const aText = readString(a?.label).trim();
      const axis = readString(a?.mbtiAxis).trim().toUpperCase();
      const dir = readString(a?.direction).trim().toUpperCase();
      const mbtiDir = mbtiLetterToPlusMinus(axis, dir);
      const weight = 1;
      const delta = (mbtiDir === "minus" ? -1 : 1) * weight;
      statements.push(
        db
          .prepare(
            `INSERT INTO answers (test_id, answer_id, question_id, ord, answer, mbti_axis, mbti_dir, weight, score_key, score_value)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(testId, aid, qid, aIndex, aText, axis, mbtiDir, weight, "", 0),
      );
      if (axis) {
        statements.push(
          db
            .prepare(
              `INSERT INTO mbti_answer_effects (test_id, answer_id, axis, delta)
               VALUES (?, ?, ?, ?)`,
            )
            .bind(testId, aid, axis, delta),
        );
      }
    });
  });

  const results = isRecord(testJson.results) ? testJson.results : {};
  Object.keys(results).forEach((code) => {
    const r = results[code] || {};
    statements.push(
      db
        .prepare(
          `INSERT INTO results (test_id, result_id, result_image, result_text)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(
          testId,
          String(code),
          readString(r.image),
          readString(r.summary),
        ),
    );
  });

  const resultsArr = await db.batch(statements);
  // Best-effort: ensure batch succeeded
  if (!Array.isArray(resultsArr))
    throw new Error("D1 batch did not return results.");
}

function mbtiLetterToPlusMinus(axis: string, letter: string) {
  const ax = String(axis || "").trim().toUpperCase();
  const l = String(letter || "").trim().toUpperCase();
  if (!ax || !l) return "plus";
  const plusByAxis: Record<string, string> = { EI: "E", SN: "S", TF: "T", JP: "J" };
  const plus = plusByAxis[ax];
  if (!plus) return "plus";
  return l === plus ? "plus" : "minus";
}


