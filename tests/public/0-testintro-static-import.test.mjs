/**
 * Stable `testintro.js` import (no `?v=`) so the intro load path maps to one module URL.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TESTINTRO_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";
import { stableImportV } from "./stable-import.mjs";

test("testintro.js stable URL: renders title from API detail", async () => {
  const t = minimalPublishedQuizTest("intro-stable");
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
  await import(
    new URL("../../public/scripts/testintro.js", import.meta.url).href
  );
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(
    document.querySelector(".IntroShellTextBox h2")?.textContent,
    t.title,
  );
});

test("testintro.js stable URL: mobile scroll adds Sticky header margin", async () => {
  const t = minimalPublishedQuizTest("intro-scroll-stable");
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
  const introScrollUrl = new URL(
    "../../public/scripts/testintro.js",
    import.meta.url,
  );
  introScrollUrl.searchParams.set(
    "v",
    `${stableImportV(import.meta.url)}-intro-scroll`,
  );
  await import(introScrollUrl.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const head = document.querySelector("header.Sticky");
  const headEl = document.querySelector(".Head");
  assert.ok(head && headEl);
  Object.defineProperty(headEl, "offsetTop", {
    configurable: true,
    enumerable: true,
    get: () => 10,
  });

  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 9999,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(head.style.marginBottom, "35px");

  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 0,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(head.style.marginBottom, "");
});

test("testintro.js stable URL: API non-OK falls back to getTestIndex + assetUrl path", async () => {
  const t = minimalPublishedQuizTest("intro-fallback-stable");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(`/api/tests/${t.id}`)) {
      return new Response("missing", { status: 404 });
    }
    if (u.includes(t.path) || u.includes(encodeURIComponent(t.path))) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  window.getTestIndex = async () => ({
    tests: [
      {
        id: t.id,
        title: t.title,
        path: t.path,
        thumbnail: t.thumbnail,
      },
    ],
  });

  const introFbUrl = new URL(
    "../../public/scripts/testintro.js",
    import.meta.url,
  );
  introFbUrl.searchParams.set(
    "v",
    `${stableImportV(import.meta.url)}-intro-fallback`,
  );
  await import(introFbUrl.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 120));

  assert.equal(
    document.querySelector(".IntroShellTextBox h2")?.textContent,
    t.title,
  );
});
