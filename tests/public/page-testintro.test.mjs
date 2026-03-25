import assert from "node:assert/strict";
import test from "node:test";

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

  await import("../../public/scripts/config.js");
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

  await import("../../public/scripts/config.js");
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

  await import("../../public/scripts/config.js");
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

  await import("../../public/scripts/config.js");
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

  await import("../../public/scripts/config.js");
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

  await import("../../public/scripts/config.js");
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

  await import("../../public/scripts/config.js");
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
    if (u.includes(`/api/tests/${t.id}`) && !u.includes("compute")) {
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

  await import("../../public/scripts/config.js");
  await import(testintroImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 80));

  document.querySelector(".TestStart button")?.click();
  await new Promise((r) => setTimeout(r, 120));

  assert.ok(hrefSnap.includes("testquiz.html"));
  assert.ok(hrefSnap.includes("testId="));
});
