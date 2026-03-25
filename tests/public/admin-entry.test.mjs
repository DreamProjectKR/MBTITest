import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_MINIMAL_HTML } from "./fixtures-admin-html.mjs";
import { createBrowserEnv } from "./setup-happy-dom.mjs";
import { scriptHrefWithStableV } from "./stable-import.mjs";

test("admin.js entry runs initAdmin and wires admin UI", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tests: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  await import(scriptHrefWithStableV("../../public/scripts/admin.js", import.meta.url));

  await new Promise((r) => setTimeout(r, 80));

  assert.ok(document.querySelector("[data-save-status]"));
});
