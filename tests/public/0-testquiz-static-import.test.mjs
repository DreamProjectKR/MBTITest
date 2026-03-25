/**
 * Stable `testquiz.js` import (no `?v=`) to aggregate coverage for progress DOM
 * (`ensureProgressFill`) on one module URL.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TESTQUIZ_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

function isTestDetailRequest(url, testId) {
  const u = String(url);
  const base = `/api/tests/${encodeURIComponent(testId)}`;
  return u.includes(base) && !u.includes(`${base}/compute`);
}

function isComputeRequest(url, testId) {
  return String(url).includes(
    `/api/tests/${encodeURIComponent(testId)}/compute`,
  );
}

test("testquiz.js stable URL: ensureProgressFill creates .ProgressFill", async () => {
  const t = minimalPublishedQuizTest("quiz-stable-fill");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  const progress = document.querySelector(".Progress");
  assert.ok(progress);
  assert.equal(progress.querySelector(".ProgressFill"), null);

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(
    new URL("../../public/scripts/testquiz.js", import.meta.url).href
  );
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 90));

  const fill = document.querySelector(".Progress .ProgressFill");
  assert.ok(fill, "ensureProgressFill should create ProgressFill");
  assert.equal(fill.parentElement, progress);
});
