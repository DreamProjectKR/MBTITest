import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Seed D1 from local repo `assets/` folder by generating SQL and running `wrangler d1 execute`.
//
// Usage:
//   node scripts/seed-d1-from-assets.mjs            # local D1 (recommended)
//   node scripts/seed-d1-from-assets.mjs --remote   # remote D1 (dangerous)
//   node scripts/seed-d1-from-assets.mjs --testId test-summer
//
// Env:
//   D1_NAME=mbti-db (default)

const args = new Set(process.argv.slice(2));
const isRemote = args.has("--remote");
const testIdArg = getArgValue("--testId");
const d1Name = process.env.D1_NAME || "mbti-db";

const root = process.cwd();
const assetsDir = join(root, "assets");
const indexPath = join(assetsDir, "index.json");

const indexJson = JSON.parse(readFileSync(indexPath, "utf8"));
const metas = Array.isArray(indexJson?.tests) ? indexJson.tests : [];
const selected = testIdArg
  ? metas.filter((m) => String(m?.id || "") === testIdArg)
  : metas;

if (!selected.length) {
  console.error("No tests found to import.", { testId: testIdArg || null });
  process.exit(1);
}

const statements = [];
// NOTE: `wrangler d1 execute --local` currently rejects explicit SQL transactions
// (BEGIN/COMMIT/SAVEPOINT). Keep this as plain statements.

// If importing all tests, clear existing rows for idempotency.
// If importing one test, clear rows for that test_id only.
if (!testIdArg) {
  statements.push("DELETE FROM answers;");
  statements.push("DELETE FROM questions;");
  statements.push("DELETE FROM results;");
  statements.push("DELETE FROM mbti_answer_effects;");
  statements.push("DELETE FROM tests;");
}

for (const meta of selected) {
  const id = String(meta?.id || "").trim();
  if (!id) continue;
  if (testIdArg) {
    statements.push(`DELETE FROM answers WHERE test_id = ${sqlString(id)};`);
    statements.push(`DELETE FROM questions WHERE test_id = ${sqlString(id)};`);
    statements.push(`DELETE FROM results WHERE test_id = ${sqlString(id)};`);
    statements.push(`DELETE FROM mbti_answer_effects WHERE test_id = ${sqlString(id)};`);
    statements.push(`DELETE FROM tests WHERE id = ${sqlString(id)};`);
  }

  const testJsonPath = join(assetsDir, id, "test.json");
  const test = JSON.parse(readFileSync(testJsonPath, "utf8"));

  const title = String(test?.title || meta?.title || "");
  const type = "mbti";
  const descriptionText = encodeDescriptionText(test?.description);
  const tagsText = encodeTagsText(test?.tags);
  const author = String(test?.author || "");
  const authorImg = canonicalAssetKey(test?.authorImg || "");
  const thumbnail = canonicalAssetKey(test?.thumbnail || meta?.thumbnail || "");

  const createdAt = String(meta?.createdAt || "").trim();
  const updatedAt = String(meta?.updatedAt || "").trim();
  const createdIso = createdAt ? `${createdAt}T00:00:00.000Z` : new Date().toISOString();
  const updatedIso = updatedAt ? `${updatedAt}T00:00:00.000Z` : createdIso;

  statements.push(
    [
      "INSERT INTO tests (id, title, type, description_text, tags_text, author, author_img, thumbnail, created_at, updated_at)",
      "VALUES (",
      sqlString(id),
      ",",
      sqlString(title),
      ",",
      sqlString(type),
      ",",
      sqlString(descriptionText),
      ",",
      sqlString(tagsText),
      ",",
      sqlString(author),
      ",",
      sqlString(authorImg),
      ",",
      sqlString(thumbnail),
      ",",
      sqlString(createdIso),
      ",",
      sqlString(updatedIso),
      ");",
    ].join(" "),
  );

  const questions = Array.isArray(test?.questions) ? test.questions : [];
  questions.forEach((q, qIndex) => {
    const qid = String(q?.id || `q${qIndex + 1}`);
    const question = String(q?.label || "");
    const questionImage = canonicalAssetKey(q?.prompt || "");
    statements.push(
      [
        "INSERT INTO questions (test_id, question_id, ord, question, question_image, created_at, updated_at)",
        "VALUES (",
        sqlString(id),
        ",",
        sqlString(qid),
        ",",
        String(qIndex),
        ",",
        sqlString(question),
        ",",
        sqlString(questionImage),
        ",",
        sqlString(createdIso),
        ",",
        sqlString(updatedIso),
        ");",
      ].join(" "),
    );

    const answers = Array.isArray(q?.answers) ? q.answers : [];
    answers.forEach((a, aIndex) => {
      const aid = String(a?.id || `${qid}_a${aIndex + 1}`);
      const aText = String(a?.label || "");
      const axis = String(a?.mbtiAxis || "").trim().toUpperCase();
      const dir = String(a?.direction || "").trim().toUpperCase();
      const mbtiDir = mbtiLetterToPlusMinus(axis, dir);
      const weight = 1;
      const delta = (mbtiDir === "minus" ? -1 : 1) * weight;
      statements.push(
        [
          "INSERT INTO answers (test_id, answer_id, question_id, ord, answer, mbti_axis, mbti_dir, weight, score_key, score_value, created_at, updated_at)",
          "VALUES (",
          sqlString(id),
          ",",
          sqlString(aid),
          ",",
          sqlString(qid),
          ",",
          String(aIndex),
          ",",
          sqlString(aText),
          ",",
          sqlString(axis),
          ",",
          sqlString(mbtiDir),
          ",",
          String(weight),
          ",",
          sqlString(""),
          ",",
          "0",
          ",",
          sqlString(createdIso),
          ",",
          sqlString(updatedIso),
          ");",
        ].join(" "),
      );
      if (axis) {
        statements.push(
          [
            "INSERT INTO mbti_answer_effects (test_id, answer_id, axis, delta, created_at, updated_at)",
            "VALUES (",
            sqlString(id),
            ",",
            sqlString(aid),
            ",",
            sqlString(axis),
            ",",
            String(delta),
            ",",
            sqlString(createdIso),
            ",",
            sqlString(updatedIso),
            ");",
          ].join(" "),
        );
      }
    });
  });

  const results = test?.results && typeof test.results === "object" ? test.results : {};
  Object.keys(results).forEach((code) => {
    const r = results[code] || {};
    const image = canonicalAssetKey(r.image || "");
    const summary = String(r.summary || "");
    statements.push(
      [
        "INSERT INTO results (test_id, result_id, result_image, result_text, created_at, updated_at)",
        "VALUES (",
        sqlString(id),
        ",",
        sqlString(String(code)),
        ",",
        sqlString(image),
        ",",
        sqlString(summary),
        ",",
        sqlString(createdIso),
        ",",
        sqlString(updatedIso),
        ");",
      ].join(" "),
    );
  });
}

mkdirSync(join(root, ".wrangler"), { recursive: true });
const sqlPath = join(root, ".wrangler", "seed-assets.sql");
writeFileSync(sqlPath, statements.join("\n") + "\n", "utf8");

const cmd = "npx";
const cmdArgs = ["wrangler", "d1", "execute", d1Name];
if (isRemote) {
  // Explicitly target the remote DB
  cmdArgs.push("--remote");
} else {
  // Ensure we target the same persisted local DB used by `wrangler pages dev --persist-to .wrangler/state`
  cmdArgs.push("--local", "--persist-to", ".wrangler/state");
}
cmdArgs.push("--file", sqlPath);

console.log(`[seed] executing: ${cmd} ${cmdArgs.join(" ")}`);
const res = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
process.exit(res.status ?? 1);

function getArgValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return "";
  return process.argv[idx + 1] || "";
}

function sqlString(v) {
  if (v == null) return "NULL";
  const s = String(v);
  return `'${s.replace(/'/g, "''")}'`;
}

function canonicalAssetKey(path) {
  const s = String(path || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const clean = s.replace(/^\.?\/+/, "").replace(/^assets\/+/i, "");
  return `assets/${clean}`;
}

function mbtiLetterToPlusMinus(axis, letter) {
  const ax = String(axis || "").trim().toUpperCase();
  const l = String(letter || "").trim().toUpperCase();
  if (!ax || !l) return "plus";
  // plus letters per axis: EI->E, SN->S, TF->T, JP->J
  const plusByAxis = { EI: "E", SN: "S", TF: "T", JP: "J" };
  const plus = plusByAxis[ax];
  if (!plus) return "plus";
  return l === plus ? "plus" : "minus";
}

function encodeDescriptionText(input) {
  if (Array.isArray(input)) {
    return input.map((v) => String(v ?? "").replace(/\r?\n/g, "\n")).join("\n");
  }
  return String(input ?? "").replace(/\r?\n/g, "\n");
}

function encodeTagsText(tags) {
  const list = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
      ? String(tags).split(",")
      : [];
  return list
    .map((t) => String(t ?? "").trim())
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(",");
}


