import assert from "node:assert/strict";
import test from "node:test";

import {
  MBTI_ORDER,
  normalizeQuestions,
  normalizeResults,
  validateTestPayload,
} from "../../worker/domain/tests/validation.ts";

function twelveQuestions() {
  return Array.from({ length: 12 }, (_, i) => ({
    label: `L${i + 1}`,
    questionImage: `assets/t/q${i + 1}.png`,
    answers: [
      { label: "A", mbtiAxis: "EI", direction: "E" },
      { label: "B", mbtiAxis: "EI", direction: "I" },
    ],
  }));
}

function sixteenResults() {
  return Object.fromEntries(
    MBTI_ORDER.map((code) => [
      code,
      { image: `assets/t/r/${code}.png`, summary: "s" },
    ]),
  );
}

function basePayload(overrides = {}) {
  return {
    id: "tid",
    title: "Title",
    thumbnail: "assets/t/th.png",
    authorImg: "assets/t/a.png",
    questions: twelveQuestions(),
    results: sixteenResults(),
    ...overrides,
  };
}

test("normalizeQuestions maps non-object entries to empty spread", () => {
  const q = normalizeQuestions([null, { label: "x", questionImage: "p.png" }]);
  assert.equal(q[0].label, undefined);
  assert.ok(String(q[1].questionImage).includes("assets/"));
});

test("normalizeQuestions treats non-array input as empty list", () => {
  assert.deepEqual(normalizeQuestions(null), []);
});

test("normalizeResults wraps non-object entries", () => {
  const r = normalizeResults({
    INTJ: null,
    INTP: { image: "x.png", summary: "y" },
  });
  assert.ok(r.INTJ);
  assert.equal(typeof r.INTJ.image, "string");
});

test("normalizeResults: non-object input becomes empty object", () => {
  assert.deepEqual(normalizeResults(null), {});
  assert.deepEqual(normalizeResults(undefined), {});
  assert.deepEqual(normalizeResults(42), {});
});

test("validateTestPayload: missing id", () => {
  const p = basePayload({ id: "" });
  assert.match(validateTestPayload(p), /Missing test id/);
});

test("validateTestPayload: title / thumbnail / author", () => {
  assert.match(validateTestPayload(basePayload({ title: "" })), /title/);
  assert.match(validateTestPayload(basePayload({ title: "  " })), /title/);
  assert.match(
    validateTestPayload(basePayload({ thumbnail: "" })),
    /thumbnail/,
  );
  assert.match(validateTestPayload(basePayload({ authorImg: "" })), /author/);
});

test("validateTestPayload: external URLs on thumbnail, author, question image", () => {
  assert.match(
    validateTestPayload(basePayload({ thumbnail: "https://x/th.png" })),
    /Thumbnail/,
  );
  assert.match(
    validateTestPayload(basePayload({ authorImg: "https://x/a.png" })),
    /Author image/,
  );
  const qs = twelveQuestions();
  qs[0] = {
    ...qs[0],
    questionImage: "https://evil/q.png",
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qs })),
    /Question 1 image/,
  );
});

test("validateTestPayload: question count", () => {
  assert.match(
    validateTestPayload(
      basePayload({ questions: twelveQuestions().slice(0, 11) }),
    ),
    /exactly 12/,
  );
  assert.match(
    validateTestPayload(basePayload({ questions: null })),
    /exactly 12/,
  );

  const thirteen = [...twelveQuestions(), twelveQuestions()[0]];
  assert.match(
    validateTestPayload(basePayload({ questions: thirteen })),
    /exactly 12/,
  );
});

test("validateTestPayload: question shape and answers count", () => {
  const qsBadType = twelveQuestions();
  qsBadType[0] = "not-an-object";
  assert.match(
    validateTestPayload(basePayload({ questions: qsBadType })),
    /Question 1 is invalid/,
  );

  const qs = twelveQuestions();
  qs[2] = null;
  assert.match(
    validateTestPayload(basePayload({ questions: qs })),
    /Question 3 is invalid/,
  );

  const qs2 = twelveQuestions();
  qs2[1] = { ...qs2[1], label: "" };
  assert.match(
    validateTestPayload(basePayload({ questions: qs2 })),
    /Question 2 needs a label/,
  );

  const qs3 = twelveQuestions();
  qs3[3] = { ...qs3[3], questionImage: "" };
  assert.match(
    validateTestPayload(basePayload({ questions: qs3 })),
    /Question 4 needs a questionImage/,
  );

  const qs4 = twelveQuestions();
  qs4[4] = {
    ...qs4[4],
    answers: [{ label: "A", mbtiAxis: "EI", direction: "E" }],
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qs4 })),
    /Question 5 needs exactly two answers/,
  );
});

test("validateTestPayload: invalid axis on first answer", () => {
  const qs = twelveQuestions();
  qs[0] = {
    label: "Q",
    questionImage: "assets/t/q.png",
    answers: [
      { label: "A", mbtiAxis: "XX", direction: "E" },
      { label: "B", mbtiAxis: "XX", direction: "I" },
    ],
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qs })),
    /invalid mbtiAxis/,
  );

  const qsNumAxis = twelveQuestions();
  qsNumAxis[1] = {
    label: "Q",
    questionImage: "assets/t/q.png",
    answers: [
      { label: "A", mbtiAxis: 99, direction: "E" },
      { label: "B", mbtiAxis: "EI", direction: "I" },
    ],
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qsNumAxis })),
    /Question 2 has invalid mbtiAxis/,
  );
});

test("validateTestPayload: answer-level validation", () => {
  const qs = twelveQuestions();
  qs[0] = {
    label: "Q",
    questionImage: "assets/t/q.png",
    answers: [{ label: "A", mbtiAxis: "EI", direction: "E" }, null],
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qs })),
    /Question 1 answer 2 is invalid/,
  );

  const qs2 = twelveQuestions();
  qs2[1] = {
    ...qs2[1],
    answers: [
      { label: "", mbtiAxis: "EI", direction: "E" },
      { label: "B", mbtiAxis: "EI", direction: "I" },
    ],
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qs2 })),
    /Question 2 answer 1 needs a label/,
  );

  const qs3 = twelveQuestions();
  qs3[2] = {
    ...qs3[2],
    answers: [
      { label: "A", mbtiAxis: "EI", direction: "E" },
      { label: "B", mbtiAxis: "XX", direction: "I" },
    ],
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qs3 })),
    /Question 3 answer 2 has invalid mbtiAxis/,
  );

  const qs4 = twelveQuestions();
  qs4[3] = {
    ...qs4[3],
    answers: [
      { label: "A", mbtiAxis: "EI", direction: "" },
      { label: "B", mbtiAxis: "EI", direction: "I" },
    ],
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qs4 })),
    /Question 4 answer 1 needs a direction/,
  );
});

test("validateTestPayload: answers must share axis and cover both poles", () => {
  const qs = twelveQuestions();
  qs[0] = {
    label: "Q",
    questionImage: "assets/t/q.png",
    answers: [
      { label: "A", mbtiAxis: "EI", direction: "E" },
      { label: "B", mbtiAxis: "SN", direction: "I" },
    ],
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qs })),
    /share the same mbtiAxis/,
  );

  const qs2 = twelveQuestions();
  qs2[1] = {
    ...qs2[1],
    answers: [
      { label: "A", mbtiAxis: "EI", direction: "E" },
      { label: "B", mbtiAxis: "EI", direction: "E" },
    ],
  };
  assert.match(
    validateTestPayload(basePayload({ questions: qs2 })),
    /cover both poles/,
  );
});

test("validateTestPayload: result entry that is not an object", () => {
  const r = { ...sixteenResults(), ENFP: "not-an-object" };
  assert.match(
    validateTestPayload(basePayload({ results: r })),
    /ENFP must be an object/,
  );
});

test("validateTestPayload: results block", () => {
  const r = sixteenResults();
  delete r.ENFP;
  assert.match(validateTestPayload(basePayload({ results: r })), /exactly 16/);

  const r2 = { ...sixteenResults() };
  delete r2.INTJ;
  r2.FAKE = { image: "a.png", summary: "s" };
  assert.match(
    validateTestPayload(basePayload({ results: r2 })),
    /not a valid MBTI/,
  );

  const r3 = { ...sixteenResults(), ENFP: null };
  assert.match(
    validateTestPayload(basePayload({ results: r3 })),
    /ENFP must be an object/,
  );

  const r4 = { ...sixteenResults(), ENFP: { image: "", summary: "s" } };
  assert.match(
    validateTestPayload(basePayload({ results: r4 })),
    /needs an image path/,
  );

  const r5 = {
    ...sixteenResults(),
    ENFP: { image: "https://x/i.png", summary: "s" },
  };
  assert.match(
    validateTestPayload(basePayload({ results: r5 })),
    /uploaded R2 asset/,
  );

  const r6 = {
    ...sixteenResults(),
    ENFP: { image: "assets/t/x.png", summary: "" },
  };
  assert.match(
    validateTestPayload(basePayload({ results: r6 })),
    /needs a summary/,
  );

  const r7 = {
    ...sixteenResults(),
    ENFP: { image: "assets/t/x.png", summary: "   " },
  };
  assert.match(
    validateTestPayload(basePayload({ results: r7 })),
    /needs a summary/,
  );
});

test("validateTestPayload: happy path still null", () => {
  assert.equal(validateTestPayload(basePayload()), null);
});
