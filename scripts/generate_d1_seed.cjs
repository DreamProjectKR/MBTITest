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
    const excludeTestIds =
      Array.isArray(parsed?.excludeTestIds) ?
        parsed.excludeTestIds.map((v) => String(v || "").trim()).filter(Boolean)
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

const MBTI_CODES = [
  "ENFJ", "ENFP", "ENTJ", "ENTP", "ESFJ", "ESFP", "ESTJ", "ESTP",
  "INFJ", "INFP", "INTJ", "INTP", "ISFJ", "ISFP", "ISTJ", "ISTP",
];

function getImageTypeAndName(filename) {
  const base = path.basename(filename, path.extname(filename));
  if (base === "author") return { imageType: "author", imageName: "author" };
  if (base === "thumbnail") return { imageType: "thumbnail", imageName: "thumbnail" };
  if (/^Q\d+$/i.test(base)) return { imageType: "question", imageName: base };
  if (MBTI_CODES.includes(base.toUpperCase())) return { imageType: "result", imageName: base.toUpperCase() };
  return null;
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function discoverTestImages(assetsDir, testId) {
  const imagesDir = path.join(assetsDir, testId, "images");
  if (!fs.existsSync(imagesDir)) return [];
  const entries = fs.readdirSync(imagesDir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const parsed = getImageTypeAndName(e.name);
    if (!parsed) continue;
    const imageKey = `assets/${testId}/images/${e.name}`;
    let sizeBytes = null;
    try {
      sizeBytes = fs.statSync(path.join(imagesDir, e.name)).size;
    } catch (_) {}
    out.push({
      image_key: imageKey,
      image_type: parsed.imageType,
      image_name: parsed.imageName,
      content_type: getContentType(e.name),
      size_bytes: sizeBytes,
    });
  }
  return out.sort((a, b) => a.image_name.localeCompare(b.image_name));
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
    "-- Auto-generated from assets/<test-*>/test.json, assets/<test-*>/images/*, + seed/seed-config.json",
  );
  lines.push(
    "-- DO NOT EDIT BY HAND (edit config/JSON or assets, then re-run: node scripts/generate_d1_seed.cjs)",
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
    const questionCount =
      Array.isArray(testJson?.questions) ? testJson.questions.length : 0;
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

    const seedTimestamp = "2025-01-01T00:00:00.000Z";
    const imageRows = discoverTestImages(assetsDir, testId);
    for (const row of imageRows) {
      lines.push(
        [
          "INSERT INTO test_images (test_id, image_key, image_type, image_name, content_type, size_bytes, uploaded_at)",
          "VALUES (",
          [
            sqlString(testId),
            sqlString(row.image_key),
            sqlString(row.image_type),
            sqlString(row.image_name),
            sqlString(row.content_type),
            row.size_bytes != null ? String(row.size_bytes) : "NULL",
            sqlString(seedTimestamp),
          ].join(", "),
          ");",
        ].join(" "),
      );
    }
    if (imageRows.length > 0) lines.push("");
  }

  process.stdout.write(lines.join("\n"));
}

main();
