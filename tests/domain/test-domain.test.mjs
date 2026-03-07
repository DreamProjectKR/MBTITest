import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAssetKey } from "../../worker/domain/tests/assetKeys.ts";
import { computeMbtiFromAnswers } from "../../worker/domain/tests/computeMbti.ts";
import { mergeTestDetailPayload } from "../../worker/domain/tests/mergePayload.ts";
import {
  normalizeQuestions,
  normalizeResults,
  validateTestPayload,
} from "../../worker/domain/tests/validation.ts";

test("normalizeAssetKey canonicalizes asset paths", () => {
  assert.equal(
    normalizeAssetKey("/assets/test-a/images/thumbnail.png"),
    "assets/test-a/images/thumbnail.png",
  );
  assert.equal(
    normalizeAssetKey("./test-a/images/thumbnail.png"),
    "assets/test-a/images/thumbnail.png",
  );
});

test("computeMbtiFromAnswers returns mbti and percentages", () => {
  const result = computeMbtiFromAnswers([
    { mbtiAxis: "EI", direction: "E" },
    { mbtiAxis: "EI", direction: "E" },
    { mbtiAxis: "SN", direction: "N" },
    { mbtiAxis: "TF", direction: "T" },
    { mbtiAxis: "JP", direction: "P" },
  ]);

  assert.equal(result.mbti, "ENTP");
  assert.equal(result.percentages.E, 100);
  assert.equal(result.percentages.I, 0);
});

test("mergeTestDetailPayload merges D1 metadata and body JSON", () => {
  const payload = mergeTestDetailPayload(
    {
      test_id: "test-a",
      title: "Test A",
      description_json: JSON.stringify(["line1"]),
      author: "Dream",
      author_img_path: "assets/test-a/images/author.png",
      thumbnail_path: "assets/test-a/images/thumbnail.png",
      tags_json: JSON.stringify(["tag-a"]),
      source_path: "assets/test-a/test.json",
      created_at: "2026-03-07",
      updated_at: "2026-03-07",
      is_published: 1,
    },
    { questions: [], results: {} },
  );

  assert.equal(payload.id, "test-a");
  assert.equal(payload.isPublished, true);
  assert.deepEqual(payload.description, ["line1"]);
});

test("validation normalizes asset paths and validates required structure", () => {
  const questions = normalizeQuestions([
    {
      label: "Question 1",
      questionImage: "/test-a/images/Q1.png",
      answers: [
        { label: "A", mbtiAxis: "EI", direction: "E" },
        { label: "B", mbtiAxis: "EI", direction: "I" },
      ],
    },
    ...Array.from({ length: 11 }, (_, index) => ({
      label: `Question ${index + 2}`,
      questionImage: `assets/test-a/images/Q${index + 2}.png`,
      answers: [
        { label: "A", mbtiAxis: "EI", direction: "E" },
        { label: "B", mbtiAxis: "EI", direction: "I" },
      ],
    })),
  ]);
  const results = normalizeResults(
    Object.fromEntries(
      [
        "INTJ",
        "INTP",
        "ENTJ",
        "ENTP",
        "INFJ",
        "INFP",
        "ENFJ",
        "ENFP",
        "ISTJ",
        "ISTP",
        "ESTJ",
        "ESTP",
        "ISFJ",
        "ISFP",
        "ESFJ",
        "ESFP",
      ].map((code) => [
        code,
        { image: `/${code}.png`, summary: `${code} summary` },
      ]),
    ),
  );

  const error = validateTestPayload({
    id: "test-a",
    title: "Test A",
    thumbnail: "assets/test-a/images/thumbnail.png",
    authorImg: "assets/test-a/images/author.png",
    questions,
    results,
  });

  assert.equal(error, null);
  assert.equal(questions[0].questionImage, "assets/test-a/images/Q1.png");
  assert.equal(results.INTJ.image, "assets/INTJ.png");
});
