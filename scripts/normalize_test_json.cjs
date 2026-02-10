/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function normalizeTestJson(testJson) {
  const next = { ...testJson };

  // questions: move `question` -> `label`, answers: move `answer` -> `label`
  if (Array.isArray(next.questions)) {
    next.questions = next.questions.map((q, idx) => {
      const qq = { ...(q || {}) };

      if (qq.question && !qq.label) {
        qq.label = qq.question;
      }
      if (Object.prototype.hasOwnProperty.call(qq, "question")) {
        delete qq.question;
      }

      // Ensure stable ids (admin uses them for reorder/remove)
      if (!qq.id) {
        qq.id = `q${idx + 1}`;
      }

      if (Array.isArray(qq.answers)) {
        qq.answers = qq.answers.map((a, aIdx) => {
          const aa = { ...(a || {}) };

          if (aa.answer && !aa.label) {
            aa.label = aa.answer;
          }
          if (Object.prototype.hasOwnProperty.call(aa, "answer")) {
            delete aa.answer;
          }

          // Ensure stable-ish ids (admin generates ids, older tests might not have them)
          if (!aa.id) {
            aa.id = `${qq.id}_${aIdx === 0 ? "a" : "b"}`;
          }

          return aa;
        });
      }

      return qq;
    });
  }

  // results: move `description` -> `summary`
  if (next.results && typeof next.results === "object") {
    const out = {};
    Object.keys(next.results).forEach((code) => {
      const r = next.results[code];
      const rr = { ...(r || {}) };
      if (rr.description && !rr.summary) {
        rr.summary = rr.description;
      }
      if (Object.prototype.hasOwnProperty.call(rr, "description")) {
        delete rr.description;
      }
      out[code] = rr;
    });
    next.results = out;
  }

  // Slim down: keep only quiz body in R2 test.json. Meta lives in D1.
  return {
    questions: Array.isArray(next.questions) ? next.questions : [],
    results:
      next.results && typeof next.results === "object" ? next.results : {},
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const assetsDir = path.join(repoRoot, "assets");

  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  const testDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => name.startsWith("test-"));

  const touched = [];

  for (const dir of testDirs) {
    const filePath = path.join(assetsDir, dir, "test.json");
    if (!fs.existsSync(filePath)) continue;
    const before = readJson(filePath);
    const after = normalizeTestJson(before);
    writeJson(filePath, after);
    touched.push(path.relative(repoRoot, filePath));
  }

  console.log(`Normalized ${touched.length} test.json files:`);
  touched.forEach((p) => console.log(`- ${p}`));
}

main();
