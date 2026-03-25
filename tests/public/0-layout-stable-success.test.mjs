/**
 * Stable `layout.js` import (no `?v=`) for successful fetch → innerHTML → applyAssetAttributes.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { LAYOUT_PARTIAL_HTML } from "./fixtures-pages.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";
import { stableImportV } from "./stable-import.mjs";

test("layout.js stable URL: ok response applies innerHTML and applyAssetAttributes", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  globalThis.fetch = async () =>
    new Response("<span id='layout-stable-ok'>fragment</span>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  let applyCalls = 0;
  window.applyAssetAttributes = (el) => {
    applyCalls += 1;
    assert.ok(el);
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "loading",
  });

  await import(new URL("../../public/scripts/layout.js", import.meta.url).href);
  assert.equal(
    document.getElementById("layout-stable-ok"),
    null,
    "fetch should not run until DCL",
  );
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(
    document.getElementById("layout-stable-ok")?.textContent,
    "fragment",
  );
  assert.ok(applyCalls >= 1);
});

test("layout.js applies innerHTML when applyAssetAttributes is absent (readyState complete)", async () => {
  createBrowserEnv();
  document.body.innerHTML = LAYOUT_PARTIAL_HTML;
  globalThis.fetch = async () =>
    new Response("<span id='layout-no-apply'>no-fn</span>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  delete window.applyAssetAttributes;
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "complete",
  });
  const u = new URL("../../public/scripts/layout.js", import.meta.url);
  u.searchParams.set("v", `${stableImportV(import.meta.url)}-no-apply`);
  await import(u.href);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(
    document.getElementById("layout-no-apply")?.textContent,
    "no-fn",
  );
});
