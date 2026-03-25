import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_MINIMAL_HTML } from "./fixtures-admin-html.mjs";
import { createBrowserEnv } from "./setup-happy-dom.mjs";

test("renderResults shows empty-state when no MBTI entries", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  const { renderResults } = await import("../../public/scripts/admin/render.js");
  renderResults({});

  const list = document.querySelector("[data-result-list]");
  assert.ok(
    list.innerHTML.includes("등록된 결과가 없습니다. 16개 MBTI를 모두 채워주세요."),
  );
});

test("renderQuestions uses slash-prefixed path when window.assetUrl is missing", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  const prev = window.assetUrl;
  delete window.assetUrl;

  try {
    const { renderQuestions } = await import("../../public/scripts/admin/render.js");
    renderQuestions([
      {
        id: "q1",
        label: "L",
        questionImage: "assets/t/quiz.png",
        answers: [],
      },
    ]);
  } finally {
    window.assetUrl = prev;
  }

  const img = document.querySelector("[data-question-list] img");
  assert.ok(img);
  assert.ok(String(img.getAttribute("src") || "").startsWith("/assets/t/quiz"));
});
