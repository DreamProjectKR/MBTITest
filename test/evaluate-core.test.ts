import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateScoreOutcomes,
  normalizeAnswerIds,
  summarizeMbtiPlusMinus,
} from "../functions/api/tests/utils/evaluate-core.ts";

test("normalizeAnswerIds supports answers[]", () => {
  assert.deepEqual(normalizeAnswerIds({ answers: ["a1", " a2 ", "", null] }), [
    "a1",
    "a2",
  ]);
});

test("normalizeAnswerIds supports selections[]", () => {
  assert.deepEqual(
    normalizeAnswerIds({
      selections: [{ questionId: "q1", answerId: "x" }, { answerId: " y " }],
    }),
    ["x", "y"],
  );
});

test("summarizeMbtiPlusMinus returns deterministic MBTI code", () => {
  const items = [
    { axis: "EI", delta: 2 },  // E wins
    { axis: "SN", delta: -1 }, // N wins
    { axis: "TF", delta: -1 }, // F wins
    { axis: "JP", delta: -1 }, // P wins
  ] as const;
  const summary = summarizeMbtiPlusMinus(items, {
    mode: "mbtiAxes",
    axisOrder: ["EI", "SN", "TF", "JP"],
    axisDefaults: { EI: "I", SN: "S", TF: "T", JP: "J" },
  });
  assert.equal(summary.code, "ENFP");
});

test("evaluateScoreOutcomes chooses best score and respects tieBreakOrder", () => {
  const payloads = [{ scores: { A: 1, B: 1 } }];
  const code = evaluateScoreOutcomes(payloads, {
    mode: "scoreOutcomes",
    tieBreakOrder: ["B", "A"],
  });
  assert.equal(code, "B");
});


