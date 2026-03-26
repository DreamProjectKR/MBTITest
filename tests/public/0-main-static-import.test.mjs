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

test("main.js: header scroll threshold uses offsetTop captured at import", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  const hdr = document.getElementById("header");
  assert.ok(hdr);
  Object.defineProperty(hdr, "offsetTop", {
    configurable: true,
    enumerable: true,
    get: () => 40,
  });
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tests: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-hdr-offset`);
  await import(u.href);
  const header = document.getElementById("header");
  assert.ok(header);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 50,
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

test("main.js: window.assetUrl resolves relative thumbnails", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  window.assetUrl = (p) => `https://cdn.example/${String(p).replace(/^assets\//, "")}`;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "wau",
            title: "WAU",
            thumbnail: "assets/wau/th.png",
            tags: ["t"],
            path: "wau/p.json",
            updatedAt: "2026-02-02",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-win-asset-url`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(document.body.textContent?.includes("WAU"));
});

test("main.js: window.assetResizeUrl is invoked for cards when defined", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  let resizeCalls = 0;
  window.assetResizeUrl = (path, opts) => {
    resizeCalls += 1;
    return `R:${path}:${opts.width}`;
  };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "wrz",
            title: "WRZ",
            thumbnail: "assets/wrz/t.png",
            tags: [],
            path: "wrz/p.json",
            updatedAt: "2026-03-03",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-win-resize`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(resizeCalls >= 1);
});

test("main.js: newtest vs toptest use different data-asset-srcset widths", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "srcset",
            title: "Srcset",
            thumbnail: "https://example.com/s.png",
            tags: [],
            path: "srcset/p.json",
            updatedAt: "2026-01-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-variant-srcset`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  const topImg = document.querySelector(".NewTestShell.toptest img");
  const newImg = document.querySelector(".NewTestShell.newtest img");
  assert.ok(topImg);
  assert.ok(newImg);
  assert.equal(topImg.getAttribute("data-asset-srcset"), "320,480,520");
  assert.equal(newImg.getAttribute("data-asset-srcset"), "320,480,640");
});

test("main.js: getTestIndex array path skips fetch and renders hashtags", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response("{}", { status: 404 });
  };
  window.getTestIndex = async () => ({
    tests: [
      {
        id: "gidx",
        title: "Gidx",
        thumbnail: "http://x/i.png",
        tags: ["solo"],
        path: "gidx/p.json",
        updatedAt: "2026-01-01",
      },
    ],
  });
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-get-idx-array`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fetchCalled, false);
  assert.ok(document.body.textContent?.includes("Gidx"));
  assert.ok(document.body.textContent?.includes("#solo"));
});

test("main.js: normalizeTests prefers updatedAt over createdAt", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "stale-upd",
            title: "StaleUpd",
            thumbnail: "http://x/a.png",
            tags: [],
            path: "a/p.json",
            updatedAt: "2010-01-01",
            createdAt: "2030-01-01",
          },
          {
            id: "mid",
            title: "MidWins",
            thumbnail: "http://x/b.png",
            tags: [],
            path: "b/p.json",
            createdAt: "2015-01-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-sort-updated-at`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  const firstH4 = document.querySelector(".NewTestList .NewTest h4");
  assert.equal(firstH4?.textContent, "MidWins");
});

test("main.js: img.loading setter errors are swallowed", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  const proto = window.HTMLImageElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "loading");
  Object.defineProperty(proto, "loading", {
    configurable: true,
    enumerable: true,
    get() {
      return "lazy";
    },
    set() {
      throw new Error("loading blocked");
    },
  });
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          tests: [
            {
              id: "imgld",
              title: "ImgLd",
              thumbnail: "http://x/p.png",
              tags: [],
              path: "imgld/p.json",
              updatedAt: "2026-01-01",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const u = new URL("../../public/scripts/main.js", import.meta.url);
    u.searchParams.set("v", `${stableImportV(import.meta.url)}-img-loading-catch`);
    await import(u.href);
    dispatchDomContentLoaded(window);
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(document.body.textContent?.includes("ImgLd"));
  } finally {
    if (desc) Object.defineProperty(proto, "loading", desc);
    else delete proto.loading;
  }
});

test("main.js: img.fetchPriority setter errors swallowed on first card", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  const proto = window.HTMLImageElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "fetchPriority");
  Object.defineProperty(proto, "fetchPriority", {
    configurable: true,
    enumerable: true,
    get() {
      return "auto";
    },
    set() {
      throw new Error("fetchPriority blocked");
    },
  });
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          tests: [
            {
              id: "fprio",
              title: "FPrio",
              thumbnail: "http://x/p.png",
              tags: [],
              path: "fprio/p.json",
              updatedAt: "2026-01-01",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const u = new URL("../../public/scripts/main.js", import.meta.url);
    u.searchParams.set("v", `${stableImportV(import.meta.url)}-fetch-priority-catch`);
    await import(u.href);
    dispatchDomContentLoaded(window);
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(document.body.textContent?.includes("FPrio"));
  } finally {
    if (desc) Object.defineProperty(proto, "fetchPriority", desc);
    else delete proto.fetchPriority;
  }
});

test("main.js: getTestIndex without tests property yields no cards", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  window.getTestIndex = async () => ({});
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-idx-missing-tests`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(document.querySelectorAll(".NewTestShell").length, 0);
});

test("main.js: card click encodes test id in location href", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "id/with?x=1",
            title: "ClickEnc",
            thumbnail: "http://x/i.png",
            tags: [],
            path: "ce/p.json",
            updatedAt: "2026-01-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => "https://example.com/",
    set: (v) => {
      hrefSnap = String(v);
    },
  });
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-card-click-encode`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  document.querySelector(".NewTestShell")?.click();
  assert.ok(hrefSnap.includes("testintro.html"));
  assert.ok(hrefSnap.includes("testId="));
  assert.ok(hrefSnap.includes(encodeURIComponent("id/with?x=1")));
});

test("main.js: protocol-relative thumbnail flows through assetUrl", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "prel",
            title: "ProtoRel",
            thumbnail: "//cdn.example.com/t.png",
            tags: ["h"],
            path: "prel/p.json",
            updatedAt: "2026-01-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-proto-rel-thumb`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(document.body.textContent?.includes("ProtoRel"));
  assert.ok(document.body.textContent?.includes("#h"));
  const img = document.querySelector(".NewTest img");
  assert.equal(
    img?.getAttribute("data-asset-src"),
    "//cdn.example.com/t.png",
  );
});

test("main.js: scroll add/remove classes when header offsetTop is zero", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  const hdr = document.getElementById("header");
  assert.ok(hdr);
  Object.defineProperty(hdr, "offsetTop", {
    configurable: true,
    enumerable: true,
    get: () => 0,
  });
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tests: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-scroll-top-zero`);
  await import(u.href);
  const header = document.getElementById("header");
  assert.ok(header);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 0,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.ok(!header.classList.contains("fixed-header"));
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 1,
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

test("main.js: uppercase HTTPS thumbnail uses assetUrl regex in resolveThumbnailPath", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "uphttps",
            title: "UpHttps",
            thumbnail: "HTTPS://CDN.EXAMPLE/T.PNG",
            tags: ["t"],
            path: "up/p.json",
            updatedAt: "2026-01-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-upper-https-thumb`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(document.body.textContent?.includes("UpHttps"));
});

test("main.js: fetch JSON with non-array tests renders no cards", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tests: "not-array" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-tests-not-array`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(document.querySelectorAll(".NewTestShell").length, 0);
});

test("main.js: getTestIndex non-array tests yields no cards", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  window.getTestIndex = async () => ({ tests: 123 });
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-idx-tests-num`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(document.querySelectorAll(".NewTestShell").length, 0);
});

test("main.js: window.assetResizeUrl and window.assetUrl both used for relative thumb", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.body.innerHTML = MAIN_PAGE_HTML;
  window.assetUrl = (p) => `AU:${p}`;
  let resizeSeen = false;
  window.assetResizeUrl = (path, opts) => {
    resizeSeen = true;
    return `AR:${path}:${opts.width}`;
  };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "both",
            title: "BothAUAR",
            thumbnail: "assets/both/x.png",
            tags: [],
            path: "both/p.json",
            updatedAt: "2026-01-01",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-both-au-ar`);
  await import(u.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(resizeSeen, true);
  assert.ok(document.body.textContent?.includes("BothAUAR"));
});
