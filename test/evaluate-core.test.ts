import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateMbtiAxes,
  evaluateScoreOutcomes,
  normalizeAnswerIds,
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

test("evaluateMbtiAxes returns deterministic MBTI code", () => {
  const payloads = [
    { axis: "EI", dir: "E" },
    { axis: "EI", dir: "E" },
    { axis: "SN", dir: "N" },
    { axis: "TF", dir: "F" },
    { axis: "JP", dir: "P" },
  ];
  const code = evaluateMbtiAxes(payloads, {
    axisOrder: ["EI", "SN", "TF", "JP"],
    axisDefaults: { EI: "I", SN: "S", TF: "T", JP: "J" },
  });
  assert.equal(code, "ENFP");
});

test("evaluateScoreOutcomes chooses best score and respects tieBreakOrder", () => {
  const payloads = [{ scores: { A: 1, B: 1 } }];
  const code = evaluateScoreOutcomes(payloads, { tieBreakOrder: ["B", "A"] });
  assert.equal(code, "B");
});


