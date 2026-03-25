/**
 * Isolated `?v=` so `admin.js` / `main.js` wireHeaderEvents run once for this file.
 * Covers createTest, saveActiveTest, handleBulkResultUpload (empty files) click paths.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_MINIMAL_HTML } from "./fixtures-admin-html.mjs";
import { sampleAdminFullTest } from "./sample-test-json.mjs";
import { createBrowserEnv } from "./setup-happy-dom.mjs";
import { scriptHrefWithStableV } from "./stable-import.mjs";

test("admin header wires save, create test, and bulk upload (no files)", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  const d1 = sampleAdminFullTest("t1");
  const listMeta = {
    id: d1.id,
    title: d1.title,
    thumbnail: d1.thumbnail,
    tags: d1.tags,
    path: d1.path,
    createdAt: d1.createdAt,
    updatedAt: d1.updatedAt,
    is_published: false,
  };

  let putCount = 0;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    const method = opts?.method || "GET";
    if (u.includes("/api/admin/tests") && u.includes("/images")) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.endsWith("/api/admin/tests") || u.endsWith("/api/admin/tests/")) {
      return new Response(JSON.stringify({ tests: [listMeta] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (
      method === "PUT" &&
      u.includes(`/api/admin/tests/${d1.id}`) &&
      !u.includes("/images")
    ) {
      putCount += 1;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.includes(`/api/admin/tests/${d1.id}`) && !u.includes("/images")) {
      return new Response(JSON.stringify(d1), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "nf" }), { status: 404 });
  };

  await import(scriptHrefWithStableV("../../public/scripts/admin.js", import.meta.url));
  await new Promise((r) => setTimeout(r, 150));

  document.querySelector("[data-save-test]")?.click();
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(putCount, 1, "save should issue PUT for active test");

  const optionsBefore = document.querySelectorAll("[data-test-select] option").length;
  document.querySelector("[data-create-test]")?.click();
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(
    document.querySelectorAll("[data-test-select] option").length >
      optionsBefore,
    "create test should append a new option",
  );

  document.querySelector("[data-bulk-result-upload]")?.click();
  await new Promise((r) => setTimeout(r, 80));
  const toastTexts = [...document.querySelectorAll(".admin-toast")].map((el) =>
    String(el.textContent || ""),
  );
  assert.ok(
    toastTexts.some((t) => t.includes("일괄 업로드할")),
    `expected bulk toast among: ${JSON.stringify(toastTexts)}`,
  );
});
