import { AXIS_MAP, MBTI_ORDER, REQUIRED_QUESTION_COUNT } from "./state.js";

export function formatDescriptionForInput(description) {
  if (Array.isArray(description)) return description.join("\n");
  return description ?? "";
}

export function parseDescriptionInput(value) {
  if (!value) return [];
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeAssetsPath(rawPath) {
  const p = String(rawPath || "").trim();
  if (!p) return "";
  return p.startsWith("assets/") ? p : `assets/${p.replace(/^\/+/, "")}`;
}

export function findByBaseName(items, baseName) {
  const bn = String(baseName || "").toLowerCase();
  if (!bn) return null;
  return (
    items.find((it) =>
      String(it?.path || "")
        .toLowerCase()
        .endsWith(`/${bn}.png`),
    ) ||
    items.find((it) =>
      String(it?.path || "")
        .toLowerCase()
        .endsWith(`/${bn}.jpg`),
    ) ||
    items.find((it) =>
      String(it?.path || "")
        .toLowerCase()
        .endsWith(`/${bn}.jpeg`),
    ) ||
    items.find((it) =>
      String(it?.path || "")
        .toLowerCase()
        .endsWith(`/${bn}.webp`),
    ) ||
    null
  );
}

export function validateTestForSave(test) {
  if (!test?.title || !String(test.title).trim())
    return "테스트 제목이 필요합니다.";
  if (!String(test.thumbnail || "").trim())
    return "썸네일 이미지를 업로드해주세요.";
  if (!String(test.authorImg || "").trim())
    return "제작자 이미지를 업로드해주세요.";

  const questions = Array.isArray(test.questions) ? test.questions : [];
  if (questions.length !== REQUIRED_QUESTION_COUNT) {
    return `문항은 반드시 ${REQUIRED_QUESTION_COUNT}개여야 합니다. (현재 ${questions.length}개)`;
  }

  for (const question of questions) {
    if (!String(question?.label || "").trim())
      return "모든 문항에 질문 텍스트가 필요합니다.";
    if (!String(question?.questionImage || "").trim())
      return "모든 문항에 질문 이미지가 필요합니다.";
    const answers = Array.isArray(question?.answers) ? question.answers : [];
    if (answers.length !== 2) return "각 문항은 2개의 선택지가 필요합니다.";
    const axis = String(answers[0]?.mbtiAxis || "");
    if (!AXIS_MAP[axis]) return "선택지의 mbtiAxis가 올바르지 않습니다.";
    if (String(answers[1]?.mbtiAxis || "") !== axis) {
      return "한 문항의 두 선택지는 같은 축(mbtiAxis)을 가져야 합니다.";
    }
    const [left, right] = AXIS_MAP[axis];
    const dirs = new Set([answers[0]?.direction, answers[1]?.direction]);
    if (!(dirs.has(left) && dirs.has(right))) {
      return "한 문항의 두 선택지는 축의 두 방향을 각각 가져야 합니다.";
    }
    if (
      !String(answers[0]?.label || "").trim() ||
      !String(answers[1]?.label || "").trim()
    ) {
      return "모든 선택지에 텍스트(label)가 필요합니다.";
    }
  }

  const results =
    test?.results && typeof test.results === "object" ? test.results : {};
  for (const code of MBTI_ORDER) {
    const result = results[code];
    if (!result) return `결과가 누락되었습니다: ${code}`;
    if (!String(result.summary || "").trim())
      return `결과 요약(summary)이 필요합니다: ${code}`;
    if (!String(result.image || "").trim())
      return `결과 이미지(image)가 필요합니다: ${code}`;
  }

  return "";
}
