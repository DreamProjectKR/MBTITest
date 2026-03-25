/**
 * Import `testquiz.js` without `?v=` where possible so merged line coverage maps to a stable URL.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TESTQUIZ_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

function testquizHref(v) {
  const u = new URL("../../public/scripts/testquiz.js", import.meta.url);
  if (v) u.searchParams.set("v", v);
  return u.href;
}

function twoQuestionQuiz(id) {
  const t = minimalPublishedQuizTest(id);
  const imagePrefix = `assets/${id}/images`;
  t.questions = [
    {
      id: "q1",
      label: "Q1",
      questionImage: `${imagePrefix}/q1.png`,
      answers: [
        { mbtiAxis: "EI", direction: "E", label: "E" },
        { mbtiAxis: "EI", direction: "I", label: "I" },
      ],
    },
    {
      id: "q2",
      label: "Q2",
      questionImage: `${imagePrefix}/q2.png`,
      answers: [
        { mbtiAxis: "SN", direction: "S", label: "S" },
        { mbtiAxis: "SN", direction: "N", label: "N" },
      ],
    },
  ];
  return t;
}

test("testquiz.js static import: two questions then result with local MBTI", async () => {
  const t = twoQuestionQuiz("static-quiz-2");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(`/api/tests/${t.id}`) && u.includes("compute")) {
      return new Response("{}", { status: 500 });
    }
    if (u.includes(`/api/tests/${t.id}`)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  const buttons = () => [...document.querySelectorAll(".TestSelectBtn button")];
  assert.equal(buttons().length, 2);
  buttons()[0].click();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(buttons().length, 2);
  buttons()[0].click();
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(hrefSnap.includes("testresult.html"));
  assert.ok(hrefSnap.includes("result="));
});

test("testquiz.js versioned: sessionStorage cache skips network", async () => {
  const t = minimalPublishedQuizTest("cached-quiz");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  let fetches = 0;
  globalThis.fetch = async () => {
    fetches += 1;
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizHref("cache"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(fetches, 0);
  assert.ok(document.querySelector(".TestSelectBtn button"));
});

test("testquiz.js versioned: API failure shows error copy", async () => {
  const t = minimalPublishedQuizTest("fail-quiz");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  globalThis.fetch = async () => new Response("", { status: 500 });

  await import("../../public/scripts/config.js");
  await import(testquizHref("api-fail"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(
    document.body.textContent?.includes("테스트 정보를 불러오지 못했습니다."),
  );
});

test("testquiz.js versioned: empty questions array", async () => {
  const t = minimalPublishedQuizTest("empty-q");
  t.questions = [];
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  globalThis.fetch = async (url) => {
    if (String(url).includes(`/api/tests/${t.id}`)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizHref("no-questions"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(document.body.textContent?.includes("문항이 없습니다."));
});
