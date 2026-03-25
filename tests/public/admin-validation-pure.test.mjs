import assert from "node:assert/strict";
import test from "node:test";

import { MBTI_CODES, buildTwelveQuestions } from "./sample-test-json.mjs";
import { createBrowserEnv } from "./setup-happy-dom.mjs";

createBrowserEnv();

const {
  findByBaseName,
  formatDescriptionForInput,
  getNextQuestionNo,
  normalizeAssetsPath,
  parseDescriptionInput,
  validateTestForSave,
} = await import("../../public/scripts/admin/validation.js");

test("formatDescriptionForInput and parseDescriptionInput", () => {
  assert.equal(formatDescriptionForInput(undefined), "");
  assert.equal(formatDescriptionForInput("x"), "x");
  assert.deepEqual(formatDescriptionForInput(["a", "b"]), "a\nb");
  assert.deepEqual(parseDescriptionInput(""), []);
  assert.deepEqual(parseDescriptionInput("  a\n\nb  "), ["a", "b"]);
});

test("normalizeAssetsPath trims and prefixes", () => {
  assert.equal(normalizeAssetsPath(""), "");
  assert.equal(normalizeAssetsPath("  "), "");
  assert.equal(normalizeAssetsPath("assets/x.png"), "assets/x.png");
  assert.equal(normalizeAssetsPath("/foo/bar.png"), "assets/foo/bar.png");
});

test("getNextQuestionNo picks lowest free slot; 0 when q1..q12 all used", () => {
  assert.equal(getNextQuestionNo([]), 1);
  assert.equal(getNextQuestionNo([{ id: "q1" }]), 2);
  assert.equal(getNextQuestionNo([{ id: "q2" }, { id: "q1" }]), 3);
  const full = Array.from({ length: 12 }, (_, i) => ({ id: `q${i + 1}` }));
  assert.equal(getNextQuestionNo(full), 0);
});

test("findByBaseName tries png jpg jpeg webp suffixes", () => {
  assert.equal(findByBaseName([], "x"), null);
  assert.equal(findByBaseName([{ path: "assets/t/X.png" }], ""), null);
  assert.deepEqual(findByBaseName([{ path: "assets/t/X.png" }], "x"), {
    path: "assets/t/X.png",
  });
  assert.deepEqual(findByBaseName([{ path: "p/a.JPG" }], "a"), {
    path: "p/a.JPG",
  });
  assert.deepEqual(findByBaseName([{ path: "p/b.jpeg" }], "b"), {
    path: "p/b.jpeg",
  });
  assert.deepEqual(findByBaseName([{ path: "p/c.webp" }], "c"), {
    path: "p/c.webp",
  });
  assert.equal(findByBaseName([{ path: "other" }], "z"), null);
});

test("validateTestForSave returns errors for invalid payloads", () => {
  assert.ok(String(validateTestForSave(null)).includes("제목"));
  assert.ok(String(validateTestForSave({ title: "t" })).includes("썸네일"));
  assert.ok(
    String(
      validateTestForSave({ title: "t", thumbnail: "a", authorImg: "" }),
    ).includes("제작자"),
  );

  const base = {
    title: "T",
    thumbnail: "assets/th.png",
    authorImg: "assets/a.png",
    questions: [],
    results: {},
  };
  assert.ok(String(validateTestForSave(base)).includes("12개"));

  const qShort = buildTwelveQuestions("x", "assets/x/images").slice(0, 11);
  assert.ok(
    String(validateTestForSave({ ...base, questions: qShort })).includes(
      "12개",
    ),
  );

  const twelve = buildTwelveQuestions("x", "assets/x/images");
  const badLabel = twelve.map((q, idx) =>
    idx === 0 ? { ...q, label: "  " } : q,
  );
  assert.ok(
    String(validateTestForSave({ ...base, questions: badLabel })).includes(
      "질문 텍스트",
    ),
  );

  const badImg = twelve.map((q, idx) =>
    idx === 0 ? { ...q, questionImage: "" } : q,
  );
  assert.ok(
    String(validateTestForSave({ ...base, questions: badImg })).includes(
      "질문 이미지",
    ),
  );

  const oneAns = twelve.map((q, idx) =>
    idx === 0 ? { ...q, answers: [q.answers[0]] } : q,
  );
  assert.ok(
    String(validateTestForSave({ ...base, questions: oneAns })).includes(
      "2개의 선택지",
    ),
  );

  const badAxis = twelve.map((q, idx) =>
    idx === 0 ?
      {
        ...q,
        answers: [
          { mbtiAxis: "XX", direction: "E", label: "a" },
          { mbtiAxis: "XX", direction: "I", label: "b" },
        ],
      }
    : q,
  );
  assert.ok(
    String(validateTestForSave({ ...base, questions: badAxis })).includes(
      "mbtiAxis",
    ),
  );

  const axisMismatch = twelve.map((q, idx) =>
    idx === 0 ?
      {
        ...q,
        answers: [
          { mbtiAxis: "EI", direction: "E", label: "a" },
          { mbtiAxis: "SN", direction: "I", label: "b" },
        ],
      }
    : q,
  );
  assert.ok(
    String(validateTestForSave({ ...base, questions: axisMismatch })).includes(
      "같은 축",
    ),
  );

  const badDirs = twelve.map((q, idx) =>
    idx === 0 ?
      {
        ...q,
        answers: [
          { mbtiAxis: "EI", direction: "E", label: "a" },
          { mbtiAxis: "EI", direction: "E", label: "b" },
        ],
      }
    : q,
  );
  assert.ok(
    String(validateTestForSave({ ...base, questions: badDirs })).includes(
      "두 방향",
    ),
  );

  const badAnsLabel = twelve.map((q, idx) =>
    idx === 0 ?
      {
        ...q,
        answers: [
          { mbtiAxis: "EI", direction: "E", label: "" },
          { mbtiAxis: "EI", direction: "I", label: "b" },
        ],
      }
    : q,
  );
  assert.ok(
    String(validateTestForSave({ ...base, questions: badAnsLabel })).includes(
      "label",
    ),
  );

  const resultsPartial = MBTI_CODES.reduce((acc, code, i) => {
    if (i === 0) return acc;
    return {
      ...acc,
      [code]: { summary: "s", image: "assets/r.png" },
    };
  }, {});
  assert.ok(
    String(
      validateTestForSave({
        ...base,
        questions: buildTwelveQuestions("id", "assets/id/images"),
        results: resultsPartial,
      }),
    ).includes("누락"),
  );

  const missSummary = MBTI_CODES.reduce(
    (acc, code) => ({
      ...acc,
      [code]: { summary: "", image: "assets/r.png" },
    }),
    {},
  );
  assert.ok(
    String(
      validateTestForSave({
        ...base,
        questions: buildTwelveQuestions("id", "assets/id/images"),
        results: missSummary,
      }),
    ).includes("요약"),
  );

  const missImage = MBTI_CODES.reduce(
    (acc, code) => ({
      ...acc,
      [code]: { summary: "s", image: "" },
    }),
    {},
  );
  assert.ok(
    String(
      validateTestForSave({
        ...base,
        questions: buildTwelveQuestions("id", "assets/id/images"),
        results: missImage,
      }),
    ).includes("결과 이미지"),
  );
});

test("validateTestForSave accepts fully valid payload", () => {
  const questions = buildTwelveQuestions("ok", "assets/ok/images");
  const results = MBTI_CODES.reduce(
    (acc, code) => ({
      ...acc,
      [code]: { summary: "s", image: `assets/ok/r/${code}.png` },
    }),
    {},
  );
  assert.equal(
    validateTestForSave({
      title: "OK",
      thumbnail: "assets/ok/th.png",
      authorImg: "assets/ok/a.png",
      questions,
      results,
    }),
    "",
  );
});
