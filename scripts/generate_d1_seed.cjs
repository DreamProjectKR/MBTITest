/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sqlString(value) {
  if (value == null) return "NULL";
  const s = String(value);
  return `'${s.replace(/'/g, "''")}'`;
}

function jsonString(value) {
  if (value == null) return "NULL";
  return sqlString(JSON.stringify(value));
}

function readSeedConfig(repoRoot) {
  const configPath = path.join(repoRoot, "seed", "seed-config.json");
  if (!fs.existsSync(configPath)) {
    return { excludeTestIds: [], tests: {} };
  }
  try {
    const parsed = readJson(configPath);
    const excludeTestIds = Array.isArray(parsed?.excludeTestIds)
      ? parsed.excludeTestIds.map((v) => String(v || "").trim()).filter(Boolean)
      : [];
    const tests =
      parsed?.tests && typeof parsed.tests === "object" ? parsed.tests : {};
    return { excludeTestIds, tests };
  } catch (err) {
    throw new Error(`Invalid seed config JSON: ${configPath}`);
  }
}

function discoverTests(assetsDir) {
  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && e.name.startsWith("test-"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
  const out = [];
  for (const dir of dirs) {
    const testJsonPath = path.join(assetsDir, dir, "test.json");
    if (!fs.existsSync(testJsonPath)) continue;
    out.push({ testId: dir, sourcePath: `${dir}/test.json`, testJsonPath });
  }
  return out;
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const assetsDir = path.join(repoRoot, "assets");
  const seedConfig = readSeedConfig(repoRoot);
  const excluded = new Set(seedConfig.excludeTestIds);
  const testsMeta = seedConfig.tests;

  const discovered = discoverTests(assetsDir);
  const lines = [];
  lines.push(
    "-- Auto-generated from assets/<test-*>/test.json + seed/seed-config.json",
  );
  lines.push(
    "-- DO NOT EDIT BY HAND (edit config/JSON, then re-run: node scripts/generate_d1_seed.cjs)",
  );
  lines.push("");
  lines.push("PRAGMA foreign_keys = ON;");
  lines.push("");
  lines.push("DELETE FROM tests;");
  lines.push("");

  for (const { testId, sourcePath, testJsonPath } of discovered) {
    if (excluded.has(testId)) {
      lines.push(`-- skipped by seed-config.excludeTestIds: ${testId}`);
      lines.push("");
      continue;
    }

    const testJson = readJson(testJsonPath);
    const questionCount = Array.isArray(testJson?.questions)
      ? testJson.questions.length
      : 0;
    const meta = testsMeta[testId] || {};
    const title = meta.title ?? testId;
    const description = meta.description ?? null;
    const author = meta.author ?? null;
    const authorImg = meta.authorImg ?? null;
    const thumbnail = meta.thumbnail ?? null;
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const createdAt = meta.createdAt ?? null;
    const updatedAt = meta.updatedAt ?? null;

    lines.push(`-- test: ${testId}`);
    lines.push(
      [
        "INSERT INTO tests (test_id, title, description_json, author, author_img_path, thumbnail_path, source_path, tags_json, question_count, is_published, created_at, updated_at)",
        "VALUES (",
        [
          sqlString(testId),
          sqlString(title),
          jsonString(description),
          sqlString(author),
          sqlString(authorImg),
          sqlString(thumbnail),
          sqlString(sourcePath),
          jsonString(tags),
          String(Number(questionCount)),
          "1",
          sqlString(createdAt),
          sqlString(updatedAt),
        ].join(", "),
        ");",
      ].join(" "),
    );
    lines.push("");
  }

  process.stdout.write(lines.join("\n"));
}

main();
