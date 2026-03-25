import assert from "node:assert/strict";
import test from "node:test";

import { TESTQUIZ_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

function testquizImportHref() {
  const u = new URL("../../public/scripts/testquiz.js", import.meta.url);
  u.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return u.href;
}

test("testquiz.js answers one question and navigates to result", async () => {
  const t = minimalPublishedQuizTest("quiz1");
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

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes(`/api/tests/${t.id}`) && !u.includes("compute")) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.includes("/compute")) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  const btn = document.querySelector(".TestSelectBtn button");
  assert.ok(btn);
  btn.click();

  await new Promise((r) => setTimeout(r, 20));

  assert.ok(
    hrefSnap.includes("testresult.html"),
    `expected navigation to result, got ${hrefSnap}`,
  );
  assert.ok(hrefSnap.includes("result="));
});

test("testquiz.js uses edge compute MBTI and percent query params when API succeeds", async () => {
  const t = minimalPublishedQuizTest("quiz-edge");
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
    if (u.includes(`/api/tests/${t.id}`) && !u.includes("compute")) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.includes("/compute")) {
      return new Response(
        JSON.stringify({
          mbti: "INTJ",
          percentages: { E: 72, S: 81, T: 40, J: 65 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  const btn = document.querySelector(".TestSelectBtn button");
  assert.ok(btn);
  btn.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.ok(hrefSnap.includes("result=INTJ"));
  assert.ok(hrefSnap.includes("pE=") && hrefSnap.includes("72"));
});

test("testquiz.js shows error when testId is missing", async () => {
  createBrowserEnv({ url: "http://127.0.0.1:8788/testquiz.html" });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 40));

  assert.ok(document.body.textContent?.includes("testId"));
});

test("testquiz.js shows message when question has no answers", async () => {
  const t = minimalPublishedQuizTest("quiz-no-ans");
  t.questions = [
    {
      id: "q1",
      label: "Q1",
      questionImage: `assets/${t.id}/images/q1.png`,
      answers: [],
    },
  ];

  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(`/api/tests/${t.id}`)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  assert.ok(
    document.body.textContent?.includes("선택지가 준비되지 않았습니다."),
  );
});
