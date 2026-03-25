/**
 * Isolated file so `admin.js` loads a fresh module (distinct `?v=` from admin-entry.test.mjs).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_MINIMAL_HTML } from "./fixtures-admin-html.mjs";
import { sampleAdminFullTest } from "./sample-test-json.mjs";
import { createBrowserEnv } from "./setup-happy-dom.mjs";
import { scriptHrefWithStableV } from "./stable-import.mjs";

test("admin.js wires test select change to loadTest", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  const d1 = sampleAdminFullTest("t1");
  const d2 = sampleAdminFullTest("t2");
  const listMeta = (d) => ({
    id: d.id,
    title: d.title,
    thumbnail: d.thumbnail,
    tags: d.tags,
    path: d.path,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    is_published: false,
  });

  const detailIds = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/admin/tests") && u.includes("/images")) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.endsWith("/api/admin/tests") || u.endsWith("/api/admin/tests/")) {
      return new Response(
        JSON.stringify({ tests: [listMeta(d1), listMeta(d2)] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (u.includes("/api/admin/tests/t1") && !u.includes("/images")) {
      detailIds.push("t1");
      return new Response(JSON.stringify(d1), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.includes("/api/admin/tests/t2") && !u.includes("/images")) {
      detailIds.push("t2");
      return new Response(JSON.stringify(d2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "nf" }), { status: 404 });
  };

  await import(scriptHrefWithStableV("../../public/scripts/admin.js", import.meta.url));
  await new Promise((r) => setTimeout(r, 150));

  assert.ok(detailIds.includes("t1"), "bootstrap should load first test detail");

  const sel = document.querySelector("[data-test-select]");
  assert.ok(sel);
  sel.value = "t2";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 150));

  assert.ok(detailIds.includes("t2"), "select change should load second test");
});
