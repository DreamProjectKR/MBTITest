import assert from "node:assert/strict";
import test from "node:test";

import { TESTLIST_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

function testlistImportHref() {
  const u = new URL("../../public/scripts/testlist.js", import.meta.url);
  u.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return u.href;
}

test("testlist.js loads published tests from /assets/index.json", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  const t = minimalPublishedQuizTest("listpub");
  const index = {
    tests: [
      {
        id: t.id,
        title: t.title,
        path: t.path,
        thumbnail: t.thumbnail,
        tags: t.tags,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        is_published: true,
      },
    ],
  };

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/tests") || u.includes("/assets/index.json")) {
      return new Response(JSON.stringify(index), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testlistImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 30));

  const root = document.querySelector(".NewTestList");
  assert.ok(root?.textContent?.includes(t.title));
});

test("testlist.js uses window.getTestIndex when available", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  const t = minimalPublishedQuizTest("list-gti");
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
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
        tags: t.tags,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        is_published: true,
      },
    ],
  });

  await import(testlistImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(fetchCalled, false);
  assert.ok(document.body.textContent?.includes(t.title));
});

test("testlist.js filters out unpublished rows", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  const pub = minimalPublishedQuizTest("listpub2");
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: "draft",
            title: "Draft",
            path: "d/test.json",
            thumbnail: "",
            tags: [],
            is_published: false,
          },
          {
            id: pub.id,
            title: pub.title,
            path: pub.path,
            thumbnail: pub.thumbnail,
            tags: pub.tags,
            createdAt: pub.createdAt,
            updatedAt: pub.updatedAt,
            is_published: true,
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  await import("../../public/scripts/config.js");
  await import(testlistImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.ok(!document.body.textContent?.includes("Draft"));
  assert.ok(document.body.textContent?.includes(pub.title));
});

test("testlist.js adds mobile header margin when scroll past header", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/tests") || u.includes("/assets/index.json")) {
      return new Response(JSON.stringify({ tests: [] }), {
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
  await import(testlistImportHref());

  const header = document.getElementById("header");
  const headerScroll = document.getElementById("headerScroll");
  assert.ok(header && headerScroll);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 9999,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(headerScroll.style.marginBottom, "45px");
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 0,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(headerScroll.style.marginBottom, "");
});

test("testlist.js uses fetch when getTestIndex is removed", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  let fetchedUrl = "";
  globalThis.fetch = async (url) => {
    fetchedUrl = String(url);
    return new Response(JSON.stringify({ tests: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await import("../../public/scripts/config.js");
  delete window.getTestIndex;
  await import(testlistImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(
    fetchedUrl.includes("/assets/index.json") || fetchedUrl.includes("index"),
  );
});

test("testlist.js console.error when index fetch is not ok", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  const logs = [];
  const prev = console.error;
  console.error = (...a) => logs.push(a.join(" "));

  globalThis.fetch = async () => new Response("", { status: 502 });

  await import("../../public/scripts/config.js");
  delete window.getTestIndex;
  await import(testlistImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  console.error = prev;
  assert.ok(logs.some((m) => m.includes("테스트 목록 로딩 실패")));
});

test("testlist.js .test1 sets location to testintro.html", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tests: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  await import("../../public/scripts/config.js");
  await import(testlistImportHref());

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 20));

  const test1 = document.querySelector(".test1");
  assert.ok(test1);
  test1.click();
  assert.equal(hrefSnap, "testintro.html");
});

test("testlist.js renders multiple rows and dedupes duplicate id+path", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  const a = minimalPublishedQuizTest("row-a");
  const b = minimalPublishedQuizTest("row-b");
  const c = minimalPublishedQuizTest("row-c");
  const d = minimalPublishedQuizTest("row-d");
  const e = minimalPublishedQuizTest("row-e");

  const row = (t, title) => ({
    id: t.id,
    title,
    path: t.path,
    thumbnail: t.thumbnail,
    tags: ["t1", "t2", "t3", "t4", "t5"],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    is_published: true,
  });

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          row(a, "A"),
          row(b, "B"),
          row(c, "C"),
          row(d, "D"),
          row(e, "E"),
          {
            id: a.id,
            title: "Dup",
            path: a.path,
            thumbnail: a.thumbnail,
            tags: [],
            is_published: true,
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  await import("../../public/scripts/config.js");
  await import(testlistImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(document.querySelectorAll(".NewTestListShell").length, 2);
  assert.ok(document.body.textContent?.includes("A"));
  assert.ok(!document.body.textContent?.includes("Dup"));
});

test("testlist.js card click navigates to testintro with testId", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  const t = minimalPublishedQuizTest("card-nav");
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        tests: [
          {
            id: t.id,
            title: t.title,
            path: t.path,
            thumbnail: t.thumbnail,
            tags: t.tags,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            is_published: true,
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  await import("../../public/scripts/config.js");
  await import(testlistImportHref());

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

  const shell = document.querySelector(".NewTestList .NewTestShell");
  assert.ok(shell);
  shell.click();

  assert.ok(hrefSnap.includes("testintro.html"));
  assert.ok(hrefSnap.includes(encodeURIComponent(t.id)));
});

test("testlist.js desktop scroll fixes header without mobile margin", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tests: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

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

  await import("../../public/scripts/config.js");
  await import(testlistImportHref());

  const header = document.getElementById("header");
  const headerScroll = document.getElementById("headerScroll");
  assert.ok(header && headerScroll);

  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 9999,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.ok(header.classList.contains("fixed-header"));
  assert.equal(headerScroll.style.marginBottom, "");

  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 0,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(headerScroll.style.marginBottom, "");
});

test("testlist.js treats getTestIndex tests as empty when not an array", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  globalThis.fetch = async () =>
    new Response("should-not-run", { status: 500 });

  await import("../../public/scripts/config.js");
  window.getTestIndex = async () => ({ tests: null });
  await import(testlistImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(document.querySelector(".NewTestList")?.innerHTML.trim(), "");
});

test("testlist.js renders when tags field is not an array", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  const t = minimalPublishedQuizTest("tags-na");
  const row = {
    id: t.id,
    title: t.title,
    path: t.path,
    thumbnail: t.thumbnail,
    tags: "not-an-array",
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    is_published: true,
  };

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tests: [row] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  await import("../../public/scripts/config.js");
  await import(testlistImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(document.body.textContent?.includes(t.title));
});
