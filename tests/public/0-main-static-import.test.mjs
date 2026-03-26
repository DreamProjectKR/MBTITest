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
  firstShell.dispatchEvent(
    new window.MouseEvent("click", { bubbles: true, cancelable: true }),
  );
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
