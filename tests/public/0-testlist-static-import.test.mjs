/**
 * Import `testlist.js` without `?v=` so scroll, fetch, and render paths map to one
 * stable module URL in coverage (same pattern as `0-main-static-import.test.mjs`).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TESTLIST_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";
import { stableImportV } from "./stable-import.mjs";

test("testlist.js static import: list fetch, mobile scroll margin, and test1 link", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  const pub = minimalPublishedQuizTest("list-static");
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/tests") || u.includes("/assets/index.json")) {
      return new Response(
        JSON.stringify({
          tests: [
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
  await import(
    new URL("../../public/scripts/testlist.js", import.meta.url).href
  );
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.ok(document.body.textContent?.includes(pub.title));

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

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });
  document.querySelector(".test1")?.click();
  assert.equal(hrefSnap, "testintro.html");
});

test("testlist.js fetch path without config and lazy loading on second card", async () => {
  createBrowserEnv();
  document.body.innerHTML = TESTLIST_PAGE_HTML;

  const a = minimalPublishedQuizTest("list-two-a");
  const b = minimalPublishedQuizTest("list-two-b");
  b.updatedAt = "2026-12-01";

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/assets/index.json") || u.includes("/api/tests")) {
      return new Response(
        JSON.stringify({
          tests: [
            {
              id: a.id,
              title: a.title,
              path: a.path,
              thumbnail: a.thumbnail,
              tags: ["t1", "t2", "t3"],
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
              is_published: true,
            },
            {
              id: b.id,
              title: b.title,
              path: b.path,
              thumbnail: b.thumbnail,
              tags: ["x"],
              createdAt: b.createdAt,
              updatedAt: b.updatedAt,
              is_published: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 404 });
  };

  assert.equal(typeof window.getTestIndex, "undefined");

  const listUrl = new URL("../../public/scripts/testlist.js", import.meta.url);
  listUrl.searchParams.set("v", `${stableImportV(import.meta.url)}-fetch`);
  await import(listUrl.href);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 70));

  assert.ok(document.body.textContent?.includes(a.title));
  assert.ok(document.body.textContent?.includes(b.title));

  const imgs = document.querySelectorAll(".NewTestList .NewTest img");
  assert.ok(imgs.length >= 2, "expected at least two card images");
  assert.equal(imgs[0].getAttribute("loading"), "eager");
  assert.equal(imgs[1].getAttribute("loading"), "lazy");
});
