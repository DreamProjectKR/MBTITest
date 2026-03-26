import assert from "node:assert/strict";
import test from "node:test";
import { installMbtiConfig } from "./config-install.mjs";

import { TESTINTRO_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

function testintroImportHref() {
  const u = new URL("../../public/scripts/testintro.js", import.meta.url);
  u.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return u.href;
}

/** `/api/tests/:id` vs `/api/tests/:id/compute` — test ids may contain the substring "compute". */
function isTestDetailRequest(url, testId) {
  const u = String(url);
  const base = `/api/tests/${encodeURIComponent(testId)}`;
  return u.includes(base) && !u.includes(`${base}/compute`);
}

test("testintro.js renders intro from GET /api/tests/:id", async () => {
  const t = minimalPublishedQuizTest("intro1");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

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

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  const h2 = document.querySelector(".IntroShellTextBox h2");
  assert.equal(h2?.textContent, t.title);
});

test("testintro.js shows error when testId is missing", async () => {
  createBrowserEnv({ url: "http://127.0.0.1:8788/testintro.html" });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async () => new Response("{}", { status: 404 });

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 40));

  const h2 = document.querySelector(".IntroShellTextBox h2");
  assert.equal(h2?.textContent, "테스트를 불러올 수 없습니다.");
  assert.ok(
    document.querySelector(".IntroDescription")?.textContent?.includes(
      "testId",
    ),
  );
});

test("testintro.js falls back to index + asset fetch when detail API fails", async () => {
  const t = minimalPublishedQuizTest("intro-fallback");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    const pathname = new URL(u, "http://127.0.0.1/").pathname;
    if (pathname === `/api/tests/${t.id}`) {
      return new Response("{}", { status: 404 });
    }
    if (u.includes(t.path) || pathname.endsWith(".json")) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(new Uint8Array([0x89, 0x50]), {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  };

  installMbtiConfig(window, document);
  window.getTestIndex = async () => ({
    tests: [
      {
        id: t.id,
        path: t.path,
        title: t.title,
        is_published: true,
      },
    ],
  });
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 80));

  const h2 = document.querySelector(".IntroShellTextBox h2");
  assert.equal(h2?.textContent, t.title);
});

test("testintro.js adds mobile header margin on scroll", async () => {
  const t = minimalPublishedQuizTest("intro-scroll");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

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

  window.matchMedia = (q) => ({
    media: q,
    matches: String(q).includes("max-width: 900px"),
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  const headerScroll = document.querySelector("header");
  assert.ok(headerScroll);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 9999,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(headerScroll.style.marginBottom, "35px");
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 0,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(headerScroll.style.marginBottom, "");
});

test("testintro.js TestShare uses clipboard when navigator.share is absent", async () => {
  const t = minimalPublishedQuizTest("intro-clip");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

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
  const alerts = [];
  globalThis.alert = (msg) => alerts.push(String(msg));

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  document.querySelector(".TestShare button")?.click();
  await new Promise((r) => setTimeout(r, 30));

  assert.ok(clipboardText.includes("testId="));
  assert.ok(alerts.some((a) => a.includes("클립보드")));
});

test("testintro.js TestShare uses navigator.share when available", async () => {
  const t = minimalPublishedQuizTest("intro-share");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

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

  let shared = null;
  window.navigator.share = async (data) => {
    shared = data;
  };

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  document.querySelector(".TestShare button")?.click();
  await new Promise((r) => setTimeout(r, 30));

  assert.ok(shared);
  assert.equal(shared.title, t.title);
});

test("testintro.js registers service worker when supported", async () => {
  const t = minimalPublishedQuizTest("intro-sw");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

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

  let swCall = null;
  navigator.serviceWorker = {
    register: (url, opts) => {
      swCall = { url, opts };
      return Promise.reject(new Error("offline"));
    },
  };

  installMbtiConfig(window, document);
  await import(testintroImportHref());

  assert.ok(swCall);
  assert.equal(swCall.url, "/sw.js");
  assert.equal(swCall.opts.scope, "/");
});

test("testintro.js Start navigates to testquiz after warm-up", async () => {
  const t = minimalPublishedQuizTest("intro-start");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  };

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () =>
      `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 80));

  document.querySelector(".TestStart button")?.click();
  await new Promise((r) => setTimeout(r, 120));

  assert.ok(hrefSnap.includes("testquiz.html"));
  assert.ok(hrefSnap.includes("testId="));
});

test("testintro.js Start navigates when detail fails, cache JSON is corrupt, warm-up uses stub", async () => {
  const t = minimalPublishedQuizTest("intro-bad-cache-start");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  window.sessionStorage.setItem(
    `mbtitest:testdata:${t.id}`,
    "{not-valid-json",
  );

  globalThis.fetch = async (url) => {
    const u = String(url);
    const pathname = new URL(u, "http://127.0.0.1/").pathname;
    if (pathname === `/api/tests/${t.id}`) {
      return new Response("{}", { status: 404 });
    }
    if (pathname === "/api/tests") {
      return new Response(JSON.stringify({ tests: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () =>
      `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  installMbtiConfig(window, document);
  window.getTestIndex = async () => ({ tests: [] });
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 60));

  assert.equal(
    document.querySelector(".IntroShellTextBox h2")?.textContent,
    "테스트를 불러올 수 없습니다.",
  );

  document.querySelector(".TestStart button")?.click();
  await new Promise((r) => setTimeout(r, 120));

  assert.ok(hrefSnap.includes("testquiz.html"));
  assert.ok(hrefSnap.includes(encodeURIComponent(t.id)));
});

test("testintro.js uses fetch for index when getTestIndex is absent", async () => {
  const t = minimalPublishedQuizTest("intro-no-gti");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  // Install config, then drop getTestIndex so loadIntroData uses fetch(TEST_INDEX_URL).
  window.ASSETS_BASE = "/assets";
  window.API_TESTS_BASE = "/api/tests";
  window.TEST_INDEX_URL = "/api/tests";
  window.assetUrl = function assetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    let clean = String(path).replace(/^\.?\/+/, "");
    clean = clean.replace(/^assets\/+/i, "");
    return `${window.ASSETS_BASE}/${clean}`.replace(/\/{2,}/g, "/");
  };

  globalThis.fetch = async (url) => {
    const u = String(url);
    const pathname = new URL(u, window.location.href).pathname;
    if (pathname === `/api/tests/${t.id}`) {
      return new Response("{}", { status: 404 });
    }
    if (pathname === "/api/tests") {
      return new Response(
        JSON.stringify({
          tests: [
            {
              id: t.id,
              path: t.path,
              title: t.title,
              is_published: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (pathname.startsWith("/assets/") && pathname.endsWith(".json")) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(new Uint8Array([0x89, 0x50]), {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  };

  installMbtiConfig(window, document);
  delete window.getTestIndex;
  delete globalThis.getTestIndex;
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 90));

  assert.equal(
    document.querySelector(".IntroShellTextBox h2")?.textContent,
    t.title,
  );
});

test("testintro.js shows error when test.json fetch fails after index match", async () => {
  const t = minimalPublishedQuizTest("intro-jsonfail");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    const pathname = new URL(u, window.location.href).pathname;
    if (pathname === `/api/tests/${t.id}`) {
      return new Response("{}", { status: 404 });
    }
    if (pathname === "/api/tests") {
      return new Response(
        JSON.stringify({
          tests: [
            {
              id: t.id,
              path: t.path,
              title: t.title,
              is_published: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (pathname.startsWith("/assets/") && pathname.endsWith(".json")) {
      return new Response("{}", { status: 404 });
    }
    return new Response("{}", { status: 404 });
  };

  installMbtiConfig(window, document);
  delete window.getTestIndex;
  delete globalThis.getTestIndex;
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 90));

  assert.equal(
    document.querySelector(".IntroShellTextBox h2")?.textContent,
    "테스트를 불러올 수 없습니다.",
  );
});

test("testintro.js schedules runRest with setTimeout when requestIdleCallback absent", async () => {
  const t = minimalPublishedQuizTest("intro-no-ric");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(`/api/tests/${t.id}`)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(new Uint8Array([0x89, 0x50]), {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  };

  const prevRic = globalThis.requestIdleCallback;
  delete globalThis.requestIdleCallback;
  let sawRunRest50 = false;
  const origSt = globalThis.setTimeout;
  globalThis.setTimeout = function (fn, ms) {
    if (ms === 50 && typeof fn === "function") sawRunRest50 = true;
    return origSt.apply(this, arguments);
  };

  try {
    installMbtiConfig(window, document);
    await import(testintroImportHref());
    dispatchDomContentLoaded(window);
    await new Promise((r) => setTimeout(r, 200));
  } finally {
    globalThis.requestIdleCallback = prevRic;
    globalThis.setTimeout = origSt;
  }

  assert.equal(sawRunRest50, true);
});

test("testintro.js renders string description and skips tags when not an array", async () => {
  const t = minimalPublishedQuizTest("intro-str-desc");
  t.description = "단일 줄 소개문";
  t.tags = null;

  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

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

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(
    document
      .querySelector(".IntroDescription")
      ?.textContent?.includes("단일 줄 소개문"),
  );
  assert.equal(
    document.querySelectorAll(".IntroShellImg .NewTestHashTag .HashTag")
      .length,
    0,
  );
});

test("testintro.js renders when sessionStorage.setItem fails during persist", async () => {
  const t = minimalPublishedQuizTest("intro-persist-fail");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  const orig = window.sessionStorage.setItem.bind(window.sessionStorage);
  window.sessionStorage.setItem = function (key, value) {
    if (String(key).includes("mbtitest:testdata")) {
      throw new Error("quota");
    }
    return orig(key, value);
  };

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

  try {
    installMbtiConfig(window, document);
    await import(testintroImportHref());
    dispatchDomContentLoaded(window);
    await new Promise((r) => setTimeout(r, 60));

    assert.equal(
      document.querySelector(".IntroShellTextBox h2")?.textContent,
      t.title,
    );
  } finally {
    window.sessionStorage.setItem = orig;
  }
});

test("testintro.js loads when IntroBtnShell has no TestShare block", async () => {
  const t = minimalPublishedQuizTest("intro-no-share");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = `
<header class="Sticky"><div class="Head"></div></header>
<main class="TestIntroShell">
  <div class="IntroShellImg">
    <img alt="" />
    <div class="NewTestHashTag"></div>
  </div>
  <div class="IntroShellTextBox">
    <h2>제목</h2>
    <div class="Creator"><img alt="" /><p class="CreatorName"></p></div>
    <div class="IntroDescription"></div>
    <div class="IntroBtnShell">
      <div class="TestStart"><button type="button">시작</button></div>
    </div>
  </div>
</main>`;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(document.querySelector(".IntroShellTextBox h2")?.textContent, t.title);
  assert.equal(document.querySelector(".TestShare button"), null);
});

test("testintro.js loads when IntroBtnShell has no TestStart button", async () => {
  const t = minimalPublishedQuizTest("intro-no-start");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = `
<header class="Sticky"><div class="Head"></div></header>
<main class="TestIntroShell">
  <div class="IntroShellImg">
    <img alt="" />
    <div class="NewTestHashTag"></div>
  </div>
  <div class="IntroShellTextBox">
    <h2>제목</h2>
    <div class="Creator"><img alt="" /><p class="CreatorName"></p></div>
    <div class="IntroDescription"></div>
    <div class="IntroBtnShell">
      <div class="TestShare"><button type="button">공유</button></div>
    </div>
  </div>
</main>`;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(document.querySelector(".IntroShellTextBox h2")?.textContent, t.title);
  assert.equal(document.querySelector(".TestStart button"), null);
});

test("testintro.js Start second click returns early while first warm-up is pending", async () => {
  const t = minimalPublishedQuizTest("intro-double-start");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(new Uint8Array([0xd7]), { status: 200 });
  };

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 80));

  let hrefSets = 0;
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: () => {
      hrefSets += 1;
    },
  });

  const startBtn = document.querySelector(".TestStart button");
  assert.ok(startBtn);
  startBtn.click();
  startBtn.click();
  assert.equal(startBtn.getAttribute("data-loading"), "1");
  assert.equal(hrefSets, 0);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(hrefSets, 1);
});

test("testintro.js desktop scroll fixes header without mobile margin", async () => {
  const t = minimalPublishedQuizTest("intro-scroll-desktop");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  window.matchMedia = (q) => ({
    media: q,
    matches: false,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  const headEl = document.querySelector(".Head");
  const headerScroll = document.querySelector("header");
  assert.ok(headEl);
  assert.ok(headerScroll);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 9999,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.ok(headEl.classList.contains("fixed-header"));
  assert.equal(headerScroll.style.marginBottom, "");
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 0,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(headEl.classList.contains("fixed-header"), false);
});

test("testintro.js scroll is a no-op when .Head element is missing", async () => {
  const t = minimalPublishedQuizTest("intro-no-head-el");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML.replace(
    '<div class="Head"></div>',
    "",
  );

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(document.querySelector(".Head"), null);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 5000,
  });
  assert.doesNotThrow(() => window.dispatchEvent(new Event("scroll")));
});

test("testintro.js shows error when API fails and index lacks test id", async () => {
  const missingId = "intro-index-miss-xyz";
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(missingId)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(`/api/tests/${encodeURIComponent(missingId)}`)) {
      return new Response("", { status: 404 });
    }
    return new Response("{}", { status: 404 });
  };

  window.getTestIndex = async () => ({
    tests: [{ id: "other-row", path: "other/test.json", title: "Other" }],
  });

  installMbtiConfig(window, document);
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 80));

  assert.equal(
    document.querySelector(".IntroShellTextBox h2")?.textContent,
    "테스트를 불러올 수 없습니다.",
  );
  assert.equal(
    document.querySelector(".IntroDescription")?.textContent,
    "테스트 정보를 불러오지 못했습니다.",
  );
});
