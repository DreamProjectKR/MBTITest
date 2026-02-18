/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

/** Pure: return normalized test JSON (input unchanged). */
function normalizeTestJson(testJson) {
  const questions = Array.isArray(testJson.questions)
    ? testJson.questions.map((q, idx) => {
        const qq = q || {};
        const label = qq.label ?? qq.question;
        const id = qq.id ?? `q${idx + 1}`;
        const answers = Array.isArray(qq.answers)
          ? qq.answers.map((a, aIdx) => {
              const aa = a || {};
              const { answer: _a2, ...restA } = aa;
              return {
                ...restA,
                label: aa.label ?? aa.answer,
                id: aa.id ?? `${id}_${aIdx === 0 ? "a" : "b"}`,
              };
            })
          : [];
        const { question: _q, answer: _a, ...restQ } = qq;
        return { ...restQ, label, id, answers };
      })
    : [];

  const results =
    testJson.results && typeof testJson.results === "object"
      ? Object.keys(testJson.results).reduce((acc, code) => {
          const r = testJson.results[code] || {};
          const { description: _d, ...rest } = r;
          return {
            ...acc,
            [code]: { ...rest, summary: r.summary ?? r.description },
          };
        }, {})
      : {};

  return { questions, results };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const assetsDir = path.join(repoRoot, "assets");

  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  const testDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => name.startsWith("test-"));

  const touched = testDirs.flatMap((dir) => {
    const filePath = path.join(assetsDir, dir, "test.json");
    if (!fs.existsSync(filePath)) return [];
    const before = readJson(filePath);
    const after = normalizeTestJson(before);
    writeJson(filePath, after);
    return [path.relative(repoRoot, filePath)];
  });

  console.log(`Normalized ${touched.length} test.json files:`);
  touched.forEach((p) => console.log(`- ${p}`));
}

main();
