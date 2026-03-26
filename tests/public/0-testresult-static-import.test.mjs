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

test("testresult.js static import: fetch 200 with non-JSON body shows error", async () => {
  const t = minimalPublishedQuizTest("fetch-nonjson");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  globalThis.fetch = async () =>
    new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  await import("../../public/scripts/config.js");
  await import(testresultHref("fetch-nonjson"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(
    document.querySelector(".ResultShellTextBox h2")?.textContent,
    "결과를 불러올 수 없습니다.",
  );
});

test("testresult.js static import: cached test without results entry still renders title", async () => {
  const t = minimalPublishedQuizTest("res-miss");
  delete t.results.ENFP;
  const mbti = "ENFP";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));
  globalThis.fetch = async () => new Response("{}", { status: 404 });

  await import("../../public/scripts/config.js");
  await import(testresultHref("res-miss"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const title = document.querySelector(".ResultShellTextBox h2");
  assert.ok(String(title?.textContent || "").includes(mbti));
  assert.equal(
    document.querySelector(".ResultShellImg img")?.getAttribute("data-asset-src"),
    null,
  );
});

test("testresult.js static import: invalid pS skips axis breakdown (not all four percents)", async () => {
  const t = minimalPublishedQuizTest("partial-p");
  const mbti = "ENFP";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}&pE=50&pS=bad`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  await import("../../public/scripts/config.js");
  await import(testresultHref("partial-p"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(document.querySelector(".ResultAxisStats"), null);
});

test("testresult.js static import: axis stats append when ResultBtnShell not direct child", async () => {
  const t = minimalPublishedQuizTest("nested-btn");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}&pE=50&pS=50&pT=50&pJ=50`,
  });
  document.body.innerHTML = `
<header class="Sticky"><div class="Head"></div></header>
<main class="ResultShell">
  <div class="ResultShellImg"><img alt="" /></div>
  <div class="ResultShellTextBox">
    <h2>결과</h2>
    <div class="ResultBtnOuter">
      <div class="ResultBtnShell">
        <div class="Restart"><button type="button">다시</button></div>
        <div class="TestShare"><button type="button">공유</button></div>
      </div>
    </div>
  </div>
</main>
`;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  await import("../../public/scripts/config.js");
  await import(testresultHref("nested-axis"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const stats = document.querySelector(".ResultAxisStats");
  assert.ok(stats);
  assert.equal(stats.parentElement?.className, "ResultShellTextBox");
});

test("testresult.js static import: preload uses raw path when assetUrl and assetResizeUrl missing", async () => {
  const t = minimalPublishedQuizTest("preload-raw");
  const mbti = "ENFP";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  await import("../../public/scripts/config.js");
  const origApply = window.applyAssetAttributes;
  const origResize = window.assetResizeUrl;
  const origAssetUrl = window.assetUrl;
  window.applyAssetAttributes = () => {};
  delete window.assetResizeUrl;
  delete window.assetUrl;

  await import(testresultHref("preload-raw"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  window.applyAssetAttributes = origApply;
  window.assetResizeUrl = origResize;
  window.assetUrl = origAssetUrl;

  const link = document.querySelector('link[rel="preload"][as="image"]');
  assert.ok(link);
  const href = String(link.getAttribute("href") || "");
  assert.ok(href.includes("assets/"));
  assert.ok(!href.includes("/cdn-cgi/image/"));
});

test("testresult.js static import: hydrateAssetElement calls applyAssetAttributes", async () => {
  const t = minimalPublishedQuizTest("hydrate-apply");
  const mbti = "ENFP";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  let applyCalls = 0;
  window.applyAssetAttributes = (el) => {
    applyCalls += 1;
    assert.equal(String(el?.tagName || "").toLowerCase(), "img");
  };

  await import("../../public/scripts/config.js");
  await import(testresultHref("hydrate-apply"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(applyCalls >= 1);
});

test("testresult.js static import: hydrateAssetElement skips when applyAssetAttributes missing", async () => {
  const t = minimalPublishedQuizTest("hydrate-no-fn");
  const mbti = "ENFP";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, JSON.stringify(t));

  await import("../../public/scripts/config.js");
  delete window.applyAssetAttributes;

  await import(testresultHref("hydrate-no-fn"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(
    document
      .querySelector(".ResultShellImg img")
      ?.getAttribute("data-asset-src"),
  );
});

test("testresult.js static import: persistTestJson ignores sessionStorage setItem errors", async () => {
  const t = minimalPublishedQuizTest("persist-throw");
  const mbti = "ESTJ";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testresult.html?testId=${encodeURIComponent(t.id)}&result=${mbti}`,
  });
  document.body.innerHTML = TESTRESULT_PAGE_HTML;

  const st = window.sessionStorage;
  const origSetItem = st.setItem;
  st.setItem = function () {
    throw new Error("quota");
  };

  try {
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
    await import(testresultHref("persist-throw"));
    dispatchDomContentLoaded(window);
    await new Promise((r) => setTimeout(r, 60));

    assert.ok(
      String(
        document.querySelector(".ResultShellTextBox h2")?.textContent || "",
      ).includes(mbti),
    );
  } finally {
    st.setItem = origSetItem;
  }
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
