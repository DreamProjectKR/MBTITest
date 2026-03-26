/**
 * Single stable import of `analytics.js` (no `?v=`) so production gtag path
 * (lines after localhost early return) maps to one module URL in coverage.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";
import { stableImportV } from "./stable-import.mjs";

const analyticsV = stableImportV(import.meta.url);

test("analytics.js stable URL: production schedules gtag script", async () => {
  createBrowserEnv({ url: "https://example.com/analytics-stable" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  globalThis.dataLayer = [];
  globalThis.requestIdleCallback = (cb) => {
    cb({ didTimeout: false });
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "complete",
  });

  await import(
    new URL("../../public/scripts/analytics.js", import.meta.url).href
  );
  await new Promise((r) => setTimeout(r, 35));

  assert.equal(window.__gtagLoaded, true);
  const scripts = [...document.head.querySelectorAll("script")].filter((s) =>
    String(s.src).includes("googletagmanager.com/gtag/js"),
  );
  assert.equal(scripts.length, 1);
  const hasConfig = globalThis.dataLayer.some((entry) => {
    if (entry && entry[0] === "config") {
      const opts = entry[2];
      return (
        opts &&
        opts.allow_google_signals === false &&
        opts.allow_ad_personalization_signals === false
      );
    }
    return false;
  });
  assert.ok(hasConfig, "expected gtag config with signals disabled");
});

test("analytics.js stable URL: loading defers run until DOMContentLoaded", async () => {
  createBrowserEnv({ url: "https://example.com/analytics-defer" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  globalThis.dataLayer = [];
  let ricCalls = 0;
  globalThis.requestIdleCallback = (cb) => {
    ricCalls += 1;
    cb({ didTimeout: false });
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "loading",
  });

  const u = new URL("../../public/scripts/analytics.js", import.meta.url);
  u.searchParams.set("v", `${analyticsV}-defer`);
  await import(u.href);
  assert.equal(ricCalls, 0);
  assert.notEqual(window.__gtagLoaded, true);
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(ricCalls, 1);
  assert.equal(window.__gtagLoaded, true);
});

test("analytics.js skips gtag load on localhost hostname", async () => {
  createBrowserEnv({ url: "http://localhost:3000/analytics-local" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  globalThis.dataLayer = [];
  globalThis.requestIdleCallback = (cb) => {
    cb({ didTimeout: false });
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "complete",
  });
  const u = new URL("../../public/scripts/analytics.js", import.meta.url);
  u.searchParams.set("v", `${analyticsV}-localhost-skip`);
  await import(u.href);
  await new Promise((r) => setTimeout(r, 25));
  assert.notEqual(window.__gtagLoaded, true);
  const scripts = [...document.head.querySelectorAll("script")].filter((s) =>
    String(s.src).includes("googletagmanager.com/gtag/js"),
  );
  assert.equal(scripts.length, 0);
});

test("analytics.js skips gtag when no_gtag=1 is in query string", async () => {
  createBrowserEnv({ url: "https://example.com/page?no_gtag=1&x=1" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  globalThis.dataLayer = [];
  globalThis.requestIdleCallback = (cb) => {
    cb({ didTimeout: false });
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "complete",
  });
  const u = new URL("../../public/scripts/analytics.js", import.meta.url);
  u.searchParams.set("v", `${analyticsV}-no-gtag-query`);
  await import(u.href);
  await new Promise((r) => setTimeout(r, 25));
  assert.notEqual(window.__gtagLoaded, true);
  const scripts = [...document.head.querySelectorAll("script")].filter((s) =>
    String(s.src).includes("googletagmanager.com/gtag/js"),
  );
  assert.equal(scripts.length, 0);
});

test("analytics.js uses setTimeout when requestIdleCallback is missing", async () => {
  createBrowserEnv({ url: "https://example.com/analytics-no-ric" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  globalThis.dataLayer = [];
  const prevRic = globalThis.requestIdleCallback;
  const prevSt = globalThis.setTimeout;
  delete globalThis.requestIdleCallback;
  let stCalls = 0;
  globalThis.setTimeout = (fn, _delay) => {
    stCalls += 1;
    fn();
    return 0;
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "complete",
  });
  try {
    const u = new URL("../../public/scripts/analytics.js", import.meta.url);
    u.searchParams.set("v", `${analyticsV}-no-ric`);
    await import(u.href);
    assert.ok(stCalls >= 1);
    assert.equal(window.__gtagLoaded, true);
  } finally {
    globalThis.requestIdleCallback = prevRic;
    globalThis.setTimeout = prevSt;
  }
});
