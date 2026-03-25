import assert from "node:assert/strict";
import test from "node:test";

import { TESTRESULT_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

function testresultImportHref() {
  const u = new URL("../../public/scripts/testresult.js", import.meta.url);
  u.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return u.href;
}

test("testresult.js renders from cache + query params", async () => {
  const t = minimalPublishedQuizTest("res1");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}&pE=60&pS=55&pT=40&pJ=70`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  globalThis.fetch = async () => new Response("{}", { status: 404 });

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 40));

  const title = document.querySelector(".ResultShellTextBox h2");
  assert.ok(String(title?.textContent || "").includes(mbti));
  const stats = document.querySelector(".ResultAxisStats");
  assert.ok(stats);
});

test("testresult.js shows error when API fetch fails", async () => {
  const t = minimalPublishedQuizTest("res-fail");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  globalThis.fetch = async () => new Response("", { status: 500 });

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  const title = document.querySelector(".ResultShellTextBox h2");
  assert.equal(title?.textContent, "결과를 불러올 수 없습니다.");
});

test("testresult.js share uses clipboard when navigator.share is absent", async () => {
  const t = minimalPublishedQuizTest("res-share");
  const mbti = "ENFP";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  globalThis.fetch = async () => new Response("{}", { status: 404 });

  window.navigator.share = undefined;
  let clipboardText = "";
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text) => {
        clipboardText = String(text);
      },
    },
  });
  globalThis.alert = () => {};

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  document.querySelector(".TestShare button")?.click();
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(clipboardText.includes("testresult.html"));
});
