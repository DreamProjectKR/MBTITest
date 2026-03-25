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

test("main.js static import: renders cards and toggles header on scroll", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  const sample = {
    id: "static1",
    title: "Static",
    thumbnail: "https://example.com/abs.png",
    tags: ["t"],
    path: "static1/test.json",
    updatedAt: "2026-03-01",
  };

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/tests")) {
      return new Response(JSON.stringify({ tests: [sample] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import("../../public/scripts/main.js");
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(document.body.textContent?.includes("Static"));

  const header = document.getElementById("header");
  assert.ok(header);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 9999,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.ok(header.classList.contains("fixed-header"));
});
