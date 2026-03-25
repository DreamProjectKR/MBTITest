/**
 * Extra `testresult.js` scenarios. Each test uses a unique `?v=` so the script re-runs and
 * `dom` refs are bound to the current document (cached ESM would keep stale `querySelector` nodes).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TESTRESULT_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

function testresultHref(v) {
  const u = new URL("../../public/scripts/testresult.js", import.meta.url);
  if (v) u.searchParams.set("v", v);
  return u.href;
}

test("testresult.js static import: missing testId or result shows early error", async () => {
  createBrowserEnv({
    url: "http://127.0.0.1:8788/testresult.html",
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  await import("../../public/scripts/config.js");
  await import(testresultHref("early-err"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(
    document.querySelector(".ResultShellTextBox h2")?.textContent,
    "결과를 불러올 수 없습니다.",
  );
});

test("testresult.js static import: result param without testId shows early error", async () => {
  createBrowserEnv({
    url: "http://127.0.0.1:8788/testresult.html?result=ESTJ",
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  await import("../../public/scripts/config.js");
  await import(testresultHref("result-only"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(
    document.querySelector(".ResultShellTextBox h2")?.textContent,
    "결과를 불러올 수 없습니다.",
  );
});

test("testresult.js static import: fetch JSON when cache empty", async () => {
  const t = minimalPublishedQuizTest("res-fetch-static");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}&pE=50&pS=50&pT=50&pJ=50`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

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
  await import(testresultHref("fetch-json"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  const title = document.querySelector(".ResultShellTextBox h2");
  assert.ok(String(title?.textContent || "").includes(mbti));
  assert.ok(document.querySelector(".ResultAxisStats"));
});

test("testresult.js static import: invalid sessionStorage JSON falls back to fetch", async () => {
  const t = minimalPublishedQuizTest("res-bad-cache");
  const mbti = "ENFP";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, "{not-json");

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
  await import(testresultHref("bad-cache"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.ok(
    String(
      document.querySelector(".ResultShellTextBox h2")?.textContent || "",
    ).includes(mbti),
  );
});

test("testresult.js versioned: share uses navigator.share when available", async () => {
  const t = minimalPublishedQuizTest("res-share-nav");
  const mbti = "ISTP";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  let shared = null;
  window.navigator.share = async (payload) => {
    shared = payload;
  };

  globalThis.fetch = async () => new Response("{}", { status: 404 });

  await import("../../public/scripts/config.js");
  await import(testresultHref("share-nav"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  document.querySelector(".ResultBtnShell .TestShare button")?.click();
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(shared && String(shared.url || "").includes("testresult.html"));
  assert.ok(String(shared.title || "").includes(mbti));
});
