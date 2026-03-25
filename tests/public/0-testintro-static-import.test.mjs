/**
 * Stable `testintro.js` import (no `?v=`) so the intro load path maps to one module URL.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TESTINTRO_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

test("testintro.js stable URL: renders title from API detail", async () => {
  const t = minimalPublishedQuizTest("intro-stable");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testintro.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTINTRO_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(`/api/tests/${t.id}`)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(
    new URL("../../public/scripts/testintro.js", import.meta.url).href
  );
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(
    document.querySelector(".IntroShellTextBox h2")?.textContent,
    t.title,
  );
});
