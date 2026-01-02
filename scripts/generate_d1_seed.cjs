/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sqlString(value) {
  if (value == null) return "NULL";
  const s = String(value);
  // SQLite string literal escaping: single quote doubled.
  return `'${s.replace(/'/g, "''")}'`;
}

function jsonString(value) {
  if (value == null) return "NULL";
  return sqlString(JSON.stringify(value));
}

function normalizeAnswerText(answer) {
  if (!answer) return "";
  return String(answer.answer || answer.label || "").trim();
}

function readSeedConfig(repoRoot) {
  const configPath = path.join(repoRoot, "seed", "seed-config.json");
  if (!fs.existsSync(configPath)) {
    return { excludeTestIds: [] };
  }
  try {
    const parsed = readJson(configPath);
    const excludeTestIds = Array.isArray(parsed?.excludeTestIds)
      ? parsed.excludeTestIds
          .map((v) => String(v || "").trim())
          .filter(Boolean)
      : [];
    return { excludeTestIds };
  } catch (err) {
    throw new Error(`Invalid seed config JSON: ${configPath}`);
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const assetsDir = path.join(repoRoot, "assets");
  const indexPath = path.join(assetsDir, "index.json");
  const seedConfig = readSeedConfig(repoRoot);
  const excluded = new Set(seedConfig.excludeTestIds);

  const index = readJson(indexPath);
  const tests = Array.isArray(index?.tests) ? index.tests : [];
  const sortedTests = [...tests].sort((a, b) =>
    String(a?.id || "").localeCompare(String(b?.id || "")),
  );

  const lines = [];
  lines.push("-- Auto-generated from assets/index.json + assets/<test>/test.json");
  lines.push("-- DO NOT EDIT BY HAND (edit JSON, then re-run generator)");
  lines.push("");
  // NOTE:
  // `wrangler d1 execute --remote --file=...` can reject explicit SQL transactions
  // (BEGIN/COMMIT). Keep the seed file transaction-free for compatibility.
  lines.push("PRAGMA foreign_keys = ON;");
  lines.push("");

  // Clear tables in dependency order (optional; keeps seed idempotent for development)
  lines.push("DELETE FROM tests;");
  lines.push("");

  for (const meta of sortedTests) {
    const testId = String(meta?.id || "").trim();
    const sourcePath = String(meta?.path || "").trim(); // e.g. "test-summer/test.json"
    if (!testId || !sourcePath) continue;
    if (excluded.has(testId)) {
      lines.push(`-- skipped by seed-config: ${testId}`);
      lines.push("");
      continue;
    }

    const testJsonPath = path.join(assetsDir, sourcePath);
    if (!fs.existsSync(testJsonPath)) {
      throw new Error(`Missing test.json for ${testId}: ${testJsonPath}`);
    }
    const testJson = readJson(testJsonPath);

    lines.push(`-- test: ${testId}`);
    lines.push(
      [
        "INSERT INTO tests (test_id, title, description_json, author, author_img_path, thumbnail_path, source_path, tags_json, created_at, updated_at)",
        "VALUES (",
        [
          sqlString(testId),
          sqlString(testJson?.title || meta?.title || ""),
          jsonString(testJson?.description),
          sqlString(testJson?.author || null),
          sqlString(testJson?.authorImg || null),
          sqlString(testJson?.thumbnail || meta?.thumbnail || null),
          sqlString(sourcePath),
          jsonString(
            Array.isArray(testJson?.tags)
              ? testJson.tags
              : Array.isArray(meta?.tags)
              ? meta.tags
              : [],
          ),
          sqlString(meta?.createdAt || null),
          sqlString(meta?.updatedAt || null),
        ].join(", "),
        ");",
      ].join(" "),
    );

    lines.push("");
  }

  lines.push("");

  process.stdout.write(lines.join("\n"));
}

main();


