import assert from "node:assert/strict";
import test from "node:test";

import { LAYOUT_PARTIAL_HTML } from "./fixtures-pages.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

/** Node caches ESM by URL; a unique query re-evaluates the IIFE (matches browser navigations). */
function scriptHref(relativeToTestFile) {
  const u = new URL(relativeToTestFile, import.meta.url);
  u.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return u.href;
}

test("config.js hydrates globals on localhost", async () => {
  createBrowserEnv({ url: "http://127.0.0.1:8788/" });
  document.documentElement.innerHTML = "<body></body>";
  await import("../../public/scripts/config.js");
  assert.equal(typeof window.assetUrl, "function");
  assert.equal(typeof window.assetResizeUrl, "function");
  const local = window.assetResizeUrl("assets/x.png", { width: 100 });
  assert.ok(local.includes("/assets/"));
});

test("layout.js injects fetched partial HTML", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  globalThis.fetch = async () =>
    new Response("<span id='frag'>ok</span>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  window.applyAssetAttributes = () => {};
  await import(scriptHref("../../public/scripts/layout.js"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(document.getElementById("frag")?.textContent, "ok");
});

test("layout.js logs when partial fetch is not ok", async () => {
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
  await import(scriptHref("../../public/scripts/layout.js"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  console.warn = prev;
  assert.ok(warns.some((w) => w.includes("layout.js") && w.includes("failed")));
});

test("layout.js defers partial fetch until DOMContentLoaded when readyState is loading", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response("<span id='frag2'>late</span>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  };
  window.applyAssetAttributes = () => {};
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "loading",
  });
  await import(scriptHref("../../public/scripts/layout.js"));
  assert.equal(fetchCount, 0);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(fetchCount, 1);
  assert.equal(document.getElementById("frag2")?.textContent, "late");
});

test("layout.js loads partials immediately when document is already complete", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  globalThis.fetch = async () =>
    new Response("<span id='fragImmediate'>sync</span>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  window.applyAssetAttributes = () => {};
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "complete",
  });
  await import(scriptHref("../../public/scripts/layout.js"));
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(document.getElementById("fragImmediate")?.textContent, "sync");
});

test("analytics.js skips gtag on localhost", async () => {
  createBrowserEnv({ url: "http://127.0.0.1:8788/index.html" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  await import(scriptHref("../../public/scripts/analytics.js"));
  assert.equal(typeof window.gtag, "function");
  assert.equal(window.__gtagLoaded, undefined);
});

test("analytics.js skips gtag when no_gtag=1 is in the query string", async () => {
  createBrowserEnv({ url: "https://example.com/app?no_gtag=1" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  globalThis.dataLayer = [];
  globalThis.requestIdleCallback = (cb) => cb({ didTimeout: false });
  await import(scriptHref("../../public/scripts/analytics.js"));
  assert.equal(window.__gtagLoaded, undefined);
});

test("analytics.js defers scheduling until DOMContentLoaded when readyState is loading", async () => {
  createBrowserEnv({ url: "https://example.com/defer" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  globalThis.dataLayer = [];
  globalThis.requestIdleCallback = (cb) => cb({ didTimeout: false });
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "loading",
  });
  await import(scriptHref("../../public/scripts/analytics.js"));
  assert.notEqual(window.__gtagLoaded, true);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(window.__gtagLoaded, true);
});

test("analytics.js schedules gtag script on non-localhost", async () => {
  createBrowserEnv({ url: "https://example.com/page" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  /** `gtag()` references bare `dataLayer`; ensure global binding (matches browser window property). */
  globalThis.dataLayer = [];
  globalThis.requestIdleCallback = (cb) => {
    cb({ didTimeout: false });
  };
  await import(scriptHref("../../public/scripts/analytics.js"));
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 25));
  assert.ok(Array.isArray(globalThis.dataLayer) && globalThis.dataLayer.length >= 1);
  assert.equal(window.__gtagLoaded, true);
  const scripts = [...document.head.querySelectorAll("script")].filter((s) =>
    String(s.src).includes("googletagmanager.com/gtag/js"),
  );
  assert.equal(scripts.length, 1);
});

test("analytics.js uses setTimeout when requestIdleCallback is unavailable", async () => {
  createBrowserEnv({ url: "https://example.com/p" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  globalThis.dataLayer = [];
  const prevRic = globalThis.requestIdleCallback;
  const prevSt = globalThis.setTimeout;
  delete globalThis.requestIdleCallback;
  let timeoutRan = false;
  globalThis.setTimeout = (fn, _delay) => {
    timeoutRan = true;
    fn();
    return 0;
  };
  try {
    await import(scriptHref("../../public/scripts/analytics.js"));
    dispatchDomContentLoaded(window);
    assert.ok(timeoutRan);
    assert.equal(window.__gtagLoaded, true);
  } finally {
    globalThis.requestIdleCallback = prevRic;
    globalThis.setTimeout = prevSt;
  }
});
