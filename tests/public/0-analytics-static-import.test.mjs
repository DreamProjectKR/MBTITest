/**
 * Import `analytics.js` with a fixed `?v=` so the localhost early-return branch
 * is covered without registering a separate bare-URL module instance (cleaner merges).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserEnv } from "./setup-happy-dom.mjs";

function analyticsLocalHref() {
  const u = new URL("../../public/scripts/analytics.js", import.meta.url);
  u.searchParams.set("v", "local-skip");
  return u.href;
}

test("analytics.js static import: localhost skips gtag load", async () => {
  createBrowserEnv({ url: "http://127.0.0.1:8788/static-analytics.html" });
  document.documentElement.innerHTML = "<head></head><body></body>";
  await import(analyticsLocalHref());
  assert.equal(typeof window.gtag, "function");
  assert.equal(window.__gtagLoaded, undefined);
});
