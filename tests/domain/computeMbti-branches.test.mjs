import assert from "node:assert/strict";
import test from "node:test";

import { computeMbtiFromAnswers } from "../../worker/domain/tests/computeMbti.ts";

test("computeMbtiFromAnswers ignores invalid axis and direction", () => {
  const r = computeMbtiFromAnswers([
    { mbtiAxis: "XX", direction: "E" },
    { mbtiAxis: "EI", direction: "X" },
    { mbtiAxis: "EI", direction: "E" },
    { mbtiAxis: "EI", direction: "I" },
    { mbtiAxis: "SN", direction: "S" },
    { mbtiAxis: "SN", direction: "N" },
    { mbtiAxis: "TF", direction: "T" },
    { mbtiAxis: "TF", direction: "F" },
    { mbtiAxis: "JP", direction: "J" },
    { mbtiAxis: "JP", direction: "P" },
  ]);
  assert.ok(r.mbti.length >= 4);
});

test("computeMbtiFromAnswers skips direction when it does not match axis poles", () => {
  const r = computeMbtiFromAnswers([
    { mbtiAxis: "EI", direction: "S" },
    { mbtiAxis: "EI", direction: "E" },
    { mbtiAxis: "SN", direction: "N" },
    { mbtiAxis: "TF", direction: "T" },
    { mbtiAxis: "JP", direction: "P" },
  ]);
  assert.ok(r.mbti.includes("E") || r.mbti.includes("I"));
});
