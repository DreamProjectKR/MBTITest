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

test("testresult.js clamps percent query params to 0–100", async () => {
  const t = minimalPublishedQuizTest("clamp-p");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}&pE=999&pS=-5&pT=50&pJ=50`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));
  globalThis.fetch = async () => new Response("{}", { status: 404 });

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const text = document.querySelector(".ResultAxisStats")?.textContent || "";
  assert.ok(text.includes("E 100%"));
  assert.ok(text.includes("S 0%") || text.includes("N 100%"));
});

test("testresult.js renders title when result image path is empty", async () => {
  const t = minimalPublishedQuizTest("no-res-img");
  const mbti = "ENFP";
  t.results[mbti] = { ...t.results[mbti], image: "", summary: "요약" };
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));
  globalThis.fetch = async () => new Response("{}", { status: 404 });

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const title = document.querySelector(".ResultShellTextBox h2");
  assert.ok(String(title?.textContent || "").includes(mbti));
  const img = document.querySelector(".ResultShellImg img");
  assert.equal(img?.getAttribute("data-asset-src"), null);
});

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

test("testresult.js shows error when API body is not valid JSON", async () => {
  const t = minimalPublishedQuizTest("res-bad-json-body");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  globalThis.fetch = async (url) => {
    if (String(url).includes(`/api/tests/${t.id}`)) {
      return new Response("{{{not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(
    document.querySelector(".ResultShellTextBox h2")?.textContent,
    "결과를 불러올 수 없습니다.",
  );
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

test("testresult.js share uses navigator.share when available", async () => {
  const t = minimalPublishedQuizTest("res-share-native");
  const mbti = "ENFP";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  globalThis.fetch = async () => new Response("{}", { status: 404 });

  let shared = null;
  window.navigator.share = async (data) => {
    shared = data;
  };

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  document.querySelector(".TestShare button")?.click();
  await new Promise((r) => setTimeout(r, 25));

  assert.ok(shared);
  assert.ok(String(shared?.title || "").includes(mbti));
});

test("testresult.js renders when applyAssetAttributes is unavailable", async () => {
  const t = minimalPublishedQuizTest("res-no-apply");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  globalThis.fetch = async () => new Response("{}", { status: 404 });

  await import("../../public/scripts/config.js");
  delete window.applyAssetAttributes;
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const title = document.querySelector(".ResultShellTextBox h2");
  assert.ok(String(title?.textContent || "").includes(mbti));
});

test("testresult.js skips corrupt sessionStorage JSON and loads from API", async () => {
  const t = minimalPublishedQuizTest("res-bad-cache-json");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, "{not-valid-json");

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
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  const title = document.querySelector(".ResultShellTextBox h2");
  assert.ok(String(title?.textContent || "").includes(mbti));
});

test("testresult.js still renders when sessionStorage.setItem throws", async () => {
  const t = minimalPublishedQuizTest("res-quota");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  const orig = window.sessionStorage.setItem.bind(window.sessionStorage);
  window.sessionStorage.setItem = function (key, value) {
    if (String(key).includes("mbtitest:testdata")) {
      throw new Error("quota");
    }
    return orig(key, value);
  };

  globalThis.fetch = async (url) => {
    if (String(url).includes(`/api/tests/${t.id}`)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  try {
    await import("../../public/scripts/config.js");
    await import(testresultImportHref());
    dispatchDomContentLoaded(window);
    await new Promise((r) => setTimeout(r, 80));

    const title = document.querySelector(".ResultShellTextBox h2");
    assert.ok(String(title?.textContent || "").includes(mbti));
  } finally {
    window.sessionStorage.setItem = orig;
  }
});

test("testresult.js shows error when testId query is missing", async () => {
  createBrowserEnv({
    url: "http://127.0.0.1:8788/testresult.html?result=ESTJ",
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(
    document.querySelector(".ResultShellTextBox h2")?.textContent,
    "결과를 불러올 수 없습니다.",
  );
});

test("testresult.js shows error when result query is missing", async () => {
  const t = minimalPublishedQuizTest("res-no-mbti");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(
    document.querySelector(".ResultShellTextBox h2")?.textContent,
    "결과를 불러올 수 없습니다.",
  );
});

test("testresult.js Restart navigates to testquiz with testId", async () => {
  const t = minimalPublishedQuizTest("res-restart");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  globalThis.fetch = async () => new Response("{}", { status: 404 });

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  await import("../../public/scripts/config.js");
  await import(testresultImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  document.querySelector(".Restart button")?.click();

  assert.ok(hrefSnap.includes("testquiz.html"));
  assert.ok(hrefSnap.includes("testId="));
  assert.ok(hrefSnap.includes(encodeURIComponent(t.id)));
});
