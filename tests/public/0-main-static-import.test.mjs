/**
 * Import `main.js` without `?v=` so home page script lines map to a stable URL in coverage.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_PAGE_HTML } from "./fixtures-pages.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";
import { stableImportV } from "./stable-import.mjs";

test("main.js static import: renders cards and toggles header on scroll", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  const sampleHttp = {
    id: "static1",
    title: "Static",
    thumbnail: "http://example.com/abs.png",
    tags: ["tag1", "tag2", "tag3"],
    path: "static1/test.json",
    updatedAt: "2026-03-01",
  };
  const sampleRel = {
    id: "static-rel",
    title: "RelThumb",
    thumbnail: "assets/static-rel/th.png",
    tags: ["x"],
    path: "static-rel/test.json",
    updatedAt: "2026-03-02",
  };

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/tests")) {
      return new Response(
        JSON.stringify({
          tests: [sampleHttp, sampleRel, { ...sampleHttp, title: "DupSameKey" }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import("../../public/scripts/main.js");

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(document.body.textContent?.includes("Static"));
  assert.ok(document.body.textContent?.includes("RelThumb"));
  assert.ok(!document.body.textContent?.includes("DupSameKey"));

  const firstShell = document.querySelector(".NewTestShell");
  assert.ok(firstShell);
  firstShell.click();
  assert.ok(hrefSnap.includes("testintro.html"));
  assert.match(hrefSnap, /testId=static-rel/);

  const header = document.getElementById("header");
  assert.ok(header);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 9999,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.ok(header.classList.contains("fixed-header"));
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 0,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.ok(!header.classList.contains("fixed-header"));
});

test("main.js uses fetch path when getTestIndex is absent (no config)", async () => {
  createBrowserEnv({ url: "http://127.0.0.1:8788/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  assert.equal(typeof window.getTestIndex, "undefined");

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/tests")) {
      return new Response(
        JSON.stringify({
          tests: [
            {
              id: "main-fetch-only",
              title: "Fetch only title",
              thumbnail: "assets/mf/thumb.png",
              tags: ["a", "b", "c"],
              path: "mf/test.json",
              updatedAt: "2026-02-02",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 404 });
  };

  const mainUrl = new URL("../../public/scripts/main.js", import.meta.url);
  mainUrl.searchParams.set("v", `${stableImportV(import.meta.url)}-fetch`);
  await import(mainUrl.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(document.body.textContent?.includes("Fetch only title"));
});

test("main.js import: without config uses ASSETS_BASE for relative thumbnails", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  window.ASSETS_BASE = "https://cdn.example/pub/assets//";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "noconf-assets",
            title: "NoConfAssets",
            thumbnail: "assets/noconf/x.png",
            tags: "not-an-array",
            path: "noconf/test.json",
            createdAt: "2025-06-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-noconf-assets`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.ok(document.body.textContent?.includes("NoConfAssets"));
  const img = document.querySelector('img[data-asset-src="assets/noconf/x.png"]');
  assert.ok(img);
  assert.equal(img.getAttribute("data-asset-version"), null);
});

test("main.js import: getTestIndex returning empty tests yields no cards", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  window.getTestIndex = async () => ({ tests: null });

  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-idx-empty`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(document.querySelectorAll(".NewTestShell").length, 0);
});

test("main.js: renderSections returns early when only one NewTestList exists", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = `
<header id="headerScroll"><div id="header" class="Head"></div></header>
<main id="MainTop">
  <div class="NewTestList"><div class="NewTestListShell"></div></div>
</main>`;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "solo",
            title: "Solo",
            thumbnail: "http://example.com/t.png",
            tags: [],
            path: "solo/p.json",
            updatedAt: "2026-01-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-one-newtest-list`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(document.querySelectorAll(".NewTestShell").length, 0);
});

test("main.js: TEST_INDEX_URL overrides default index fetch", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  window.TEST_INDEX_URL = "https://example.com/custom/tests.json";
  let hitCustom = false;
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("custom/tests.json")) {
      hitCustom = true;
      return new Response(JSON.stringify({ tests: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-test-index-url`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(hitCustom, true);
});

test("main.js: non-JSON index response logs load failure", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response("<!doctype html><html></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  const errs = [];
  const prevErr = console.error;
  console.error = (...args) => {
    errs.push(args.map(String).join(" "));
    prevErr.apply(console, args);
  };
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-bad-json`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));
  console.error = prevErr;
  assert.ok(errs.some((e) => e.includes("테스트 목록 로딩 실패")));
});

test("main.js: at most three hashtag spans per card", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "tags4",
            title: "FourTags",
            thumbnail: "http://example.com/i.png",
            tags: ["a", "b", "c", "d"],
            path: "tags4/p.json",
            updatedAt: "2026-01-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-tags-slice`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  const shell = [...document.querySelectorAll(".NewTestShell")].find((el) =>
    el.textContent?.includes("FourTags"),
  );
  assert.ok(shell);
  assert.equal(shell.querySelectorAll(".HashTag").length, 3);
});

test("main.js: normalizeTests sorts by createdAt when updatedAt missing", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "older",
            title: "OlderFirstInPayload",
            thumbnail: "http://example.com/o.png",
            tags: [],
            path: "older/p.json",
            createdAt: "2019-06-01",
          },
          {
            id: "newer",
            title: "NewerWinsSort",
            thumbnail: "http://example.com/n.png",
            tags: [],
            path: "newer/p.json",
            createdAt: "2024-06-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-sort-created`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  const firstH4 = document.querySelector(".NewTestList .NewTest h4");
  assert.equal(firstH4?.textContent, "NewerWinsSort");
});

test("main.js: missing title uses default card label", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "notitle",
            title: "",
            thumbnail: "",
            tags: [],
            path: "notitle/p.json",
            updatedAt: "2026-01-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-default-title`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  const h4 = document.querySelector(".NewTest h4");
  assert.equal(h4?.textContent, "테스트 이름");
  const img = document.querySelector(".NewTest img");
  assert.equal(img?.getAttribute("data-asset-src"), null);
  assert.equal(img?.alt, "테스트 이미지");
});
