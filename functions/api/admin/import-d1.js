/**
 * Admin API: `POST /api/admin/import-d1`
 *
 * Protected endpoint that imports existing R2 test.json data into D1.
 * (Implementation is filled in subsequent steps.)
 */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

import { encodeDescriptionText, encodeTagsText } from "../utils/codecs.js";

function json(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function unauthorized() {
  return json(401, { error: "Unauthorized" });
}

function hasValidAuth(request, token) {
  if (!token) return false;
  const raw = request.headers.get("authorization") || "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return m[1] === token;
}

export async function onRequestPost(context) {
  const token = context.env.ADMIN_TOKEN || "";
  if (!hasValidAuth(context.request, token)) return unauthorized();

  const bucket = context.env.MBTI_BUCKET;
  if (!bucket) return json(500, { error: "R2 binding MBTI_BUCKET is missing." });

  const db = context.env.MBTI_DB;
  if (!db) return json(500, { error: "D1 binding MBTI_DB is missing." });

  const url = new URL(context.request.url);
  const onlyTestId = (url.searchParams.get("testId") || "").trim();
  const apply =
    url.searchParams.get("apply") === "1" ||
    url.searchParams.get("apply") === "true";

  let body = null;
  try {
    body = await context.request.json();
  } catch (e) {
    // allow empty body
  }
  const shouldApply = Boolean(apply || body?.apply === true);

  // Step 1: scan R2 and validate payloads (no DB writes yet).
  const indexObj = await bucket.get("assets/index.json");
  if (!indexObj)
    return json(404, { error: "index.json not found in R2 (assets/index.json)." });

  let index;
  try {
    index = JSON.parse(await indexObj.text());
  } catch (e) {
    return json(500, { error: "index.json is invalid JSON." });
  }

  const tests = Array.isArray(index?.tests) ? index.tests : [];
  const selected = onlyTestId
    ? tests.filter((t) => String(t?.id || "") === onlyTestId)
    : tests;

  const report = [];
  for (const meta of selected) {
    const id = String(meta?.id || "").trim();
    if (!id) continue;
    const key = normalizeIndexPathToR2Key(meta?.path || `${id}/test.json`);
    // eslint-disable-next-line no-await-in-loop
    const obj = await bucket.get(key);
    if (!obj) {
      report.push({ id, ok: false, key, error: "Missing test.json in R2." });
      continue;
    }
    let testJson;
    try {
      // eslint-disable-next-line no-await-in-loop
      testJson = JSON.parse(await obj.text());
    } catch (e) {
      report.push({ id, ok: false, key, error: "test.json is invalid JSON." });
      continue;
    }

    const errors = validateTestJsonShape(testJson);
    report.push({
      id,
      ok: errors.length === 0,
      key,
      title: testJson?.title || "",
      metaCreatedAt: meta?.createdAt || "",
      metaUpdatedAt: meta?.updatedAt || "",
      questionCount: Array.isArray(testJson?.questions) ? testJson.questions.length : 0,
      outcomeCount:
        testJson?.results && typeof testJson.results === "object"
          ? Object.keys(testJson.results).length
          : 0,
      errors,
      _testJson: errors.length === 0 ? testJson : null,
    });
  }

  const okCount = report.filter((r) => r.ok).length;

  if (!shouldApply) {
    // strip large payloads from response
    const cleaned = report.map(({ _testJson, ...rest }) => rest);
    return json(200, {
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
  const importErrors = [];
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
  return json(200, {
    ok: importErrors.length === 0,
    applied: true,
    scanned: report.length,
    valid: okCount,
    imported,
    importErrors,
    report: cleaned,
  });
}

function normalizeIndexPathToR2Key(rawPath) {
  const str = String(rawPath || "").trim().replace(/^\.?\/+/, "");
  if (!str) return "";
  return str.startsWith("assets/") ? str : `assets/${str}`;
}

function validateTestJsonShape(test) {
  const errs = [];
  if (!test || typeof test !== "object") return ["test.json must be an object."];
  if (!test.id) errs.push("Missing test.id");
  if (!test.title) errs.push("Missing test.title");
  if (!Array.isArray(test.questions) || test.questions.length === 0)
    errs.push("Missing or empty questions[]");
  if (!test.results || typeof test.results !== "object")
    errs.push("Missing results{} (MBTI-style).");

  if (Array.isArray(test.questions)) {
    test.questions.forEach((q, idx) => {
      if (!q?.id) errs.push(`Question ${idx + 1}: missing id`);
      if (!q?.prompt && !q?.label)
        errs.push(`Question ${idx + 1}: missing prompt/label`);
      if (!Array.isArray(q?.answers) || q.answers.length < 2)
        errs.push(`Question ${idx + 1}: answers must be an array (>=2)`);
    });
  }

  return errs;
}

async function upsertTestIntoD1(db, metaEntry, testJson) {
  const testId = String(testJson.id || metaEntry.id || "").trim();
  if (!testId) throw new Error("Missing test id for upsert.");

  const title = String(testJson.title || metaEntry.title || "").trim();
  const author = String(testJson.author || "").trim();
  const authorImg = String(testJson.authorImg || "").trim();
  const thumbnail = String(testJson.thumbnail || "").trim();

  const type = "mbti";
  const rulesJson = JSON.stringify({
    mode: "mbtiAxes",
    axisOrder: ["EI", "SN", "TF", "JP"],
    axisDefaults: { EI: "I", SN: "S", TF: "T", JP: "J" },
  });

  const descriptionText = encodeDescriptionText(testJson.description || "");
  const tagsText = encodeTagsText(testJson.tags || []);
  const createdAt = String(metaEntry.metaCreatedAt || "").trim();
  const updatedAt = String(metaEntry.metaUpdatedAt || "").trim();
  const nowIso = new Date().toISOString();
  const createdAtValue = createdAt || nowIso;
  const updatedAtValue = updatedAt || createdAtValue;

  const statements = [];

  // Clear existing rows for idempotent import
  statements.push(db.prepare("DELETE FROM answers WHERE test_id = ?").bind(testId));
  statements.push(db.prepare("DELETE FROM questions WHERE test_id = ?").bind(testId));
  statements.push(db.prepare("DELETE FROM outcomes WHERE test_id = ?").bind(testId));
  statements.push(db.prepare("DELETE FROM tests WHERE id = ?").bind(testId));

  statements.push(
    db
      .prepare(
        `INSERT INTO tests (id, title, type, description_text, tags_text, author, author_img, thumbnail, rules_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        rulesJson,
        createdAtValue,
        updatedAtValue,
      ),
  );

  const questions = Array.isArray(testJson.questions) ? testJson.questions : [];
  questions.forEach((q, qIndex) => {
    const qid = String(q?.id || "").trim() || `q${qIndex + 1}`;
    const label = String(q?.label || "").trim();
    const promptImage = String(q?.prompt || "").trim();
    statements.push(
      db
        .prepare(
          `INSERT INTO questions (test_id, question_id, ord, label, prompt_image, prompt_text, prompt_meta_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(testId, qid, qIndex, label, promptImage, "", ""),
    );

    const answers = Array.isArray(q?.answers) ? q.answers : [];
    answers.forEach((a, aIndex) => {
      const aid = String(a?.id || "").trim() || `${qid}_a${aIndex + 1}`;
      const aLabel = String(a?.label || "").trim();
      const axis = String(a?.mbtiAxis || "").trim();
      const dir = String(a?.direction || "").trim();
      const payload = axis && dir ? { mbtiAxis: axis, direction: dir, axis, dir, weight: 1 } : {};
      statements.push(
        db
          .prepare(
            `INSERT INTO answers (test_id, answer_id, question_id, ord, label, payload_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(testId, aid, qid, aIndex, aLabel, JSON.stringify(payload)),
      );
    });
  });

  const results = testJson.results && typeof testJson.results === "object" ? testJson.results : {};
  Object.keys(results).forEach((code) => {
    const r = results[code] || {};
    statements.push(
      db
        .prepare(
          `INSERT INTO outcomes (test_id, code, title, image, summary, meta_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          testId,
          String(code),
          "",
          String(r.image || ""),
          String(r.summary || ""),
          "",
        ),
    );
  });

  const resultsArr = await db.batch(statements);
  // Best-effort: ensure batch succeeded
  if (!Array.isArray(resultsArr))
    throw new Error("D1 batch did not return results.");
}


