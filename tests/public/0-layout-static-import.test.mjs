/**
 * Import `layout.js` without `?v=` so IIFE branches map to the stable file URL
 * in coverage (loading deferral, immediate run, fetch error catch).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { LAYOUT_PARTIAL_HTML } from "./fixtures-pages.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

function layoutHref(v) {
  const u = new URL("../../public/scripts/layout.js", import.meta.url);
  if (v) u.searchParams.set("v", v);
  return u.href;
}

test("layout.js static import: loading + DCL + fetch throw covers defer listener and catch", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  globalThis.fetch = async () => {
    throw new Error("network union");
  };
  window.applyAssetAttributes = () => {};
  const warns = [];
  const prev = console.warn;
  console.warn = (...args) => {
    warns.push(args.map(String).join(" "));
    prev.apply(console, args);
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "loading",
  });
  await import(layoutHref("union-defer-catch"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  console.warn = prev;
  assert.ok(warns.some((w) => w.includes("layout.js") && w.includes("failed")));
});

test("layout.js static import: defers when readyState is loading", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response("<span id='layoutDefer'>ok</span>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  };
  window.applyAssetAttributes = () => {};
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "loading",
  });
  await import(layoutHref());
  assert.equal(fetchCount, 0);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(fetchCount, 1);
  assert.equal(document.getElementById("layoutDefer")?.textContent, "ok");
});

test("layout.js calls applyAssetAttributes on partial root after successful fetch", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  const applied = [];
  globalThis.fetch = async () =>
    new Response("<span id='layoutApply'>ok</span>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  window.applyAssetAttributes = (el) => {
    applied.push(el);
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "complete",
  });
  await import(layoutHref("apply-attr-after-fetch"));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(applied.length, 1);
  assert.equal(applied[0].getAttribute("data-include"), "x");
  assert.equal(document.getElementById("layoutApply")?.textContent, "ok");
});

test("layout.js static import: runs immediately when already complete", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response("<span id='layoutNow'>sync</span>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  };
  window.applyAssetAttributes = () => {};
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "complete",
  });
  await import(layoutHref("complete-branch"));
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(fetchCount, 1);
  assert.equal(document.getElementById("layoutNow")?.textContent, "sync");
});

test("layout.js warns when partial fetch rejects", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  globalThis.fetch = async () =>
    new Response("missing", { status: 404, statusText: "Not Found" });
  window.applyAssetAttributes = () => {};
  const warns = [];
  const prev = console.warn;
  console.warn = (...args) => {
    warns.push(args.map(String).join(" "));
    prev.apply(console, args);
  };
  await import(layoutHref("warn-branch"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  console.warn = prev;
  assert.ok(warns.some((w) => w.includes("layout.js") && w.includes("failed")));
});

test("layout.js static import: innerHTML without applyAssetAttributes when loading defers", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  globalThis.fetch = async () =>
    new Response("<span id='layoutInnerNoApply'>inner</span>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  delete window.applyAssetAttributes;
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "loading",
  });
  await import(layoutHref("inner-no-apply-loading"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(
    document.getElementById("layoutInnerNoApply")?.textContent,
    "inner",
  );
});

test("layout.js warns when partial fetch throws", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  window.applyAssetAttributes = () => {};
  const warns = [];
  const prev = console.warn;
  console.warn = (...args) => {
    warns.push(args.map(String).join(" "));
    prev.apply(console, args);
  };
  await import(layoutHref("warn-throw"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  console.warn = prev;
  assert.ok(warns.some((w) => w.includes("layout.js") && w.includes("failed")));
});
