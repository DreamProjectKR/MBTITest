import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_MINIMAL_HTML,
  ADMIN_NO_TEST_SELECT_HTML,
} from "./fixtures-admin-html.mjs";
import { sampleAdminFullTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";
test("admin main bootstraps with mocked admin API", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  const detail = sampleAdminFullTest("adm1");
  const listMeta = {
    id: detail.id,
    title: detail.title,
    thumbnail: detail.thumbnail,
    tags: detail.tags,
    path: detail.path,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    is_published: false,
  };

  globalThis.fetch = async (url) => {
    const u = String(url);
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
    if (u.includes(`/api/admin/tests/${detail.id}`)) {
      return new Response(JSON.stringify(detail), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "nf" }), { status: 404 });
  };

  await import("../../public/scripts/config.js");
  const { initAdmin } = await import("../../public/scripts/admin/main.js");
  await initAdmin();
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 20));

  const status = document.querySelector("[data-save-status]");
  assert.ok(String(status?.textContent || "").length > 0);
});

test("admin main bootstraps when test select element is absent", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_NO_TEST_SELECT_HTML;

  const detail = sampleAdminFullTest("adm1");
  const listMeta = {
    id: detail.id,
    title: detail.title,
    thumbnail: detail.thumbnail,
    tags: detail.tags,
    path: detail.path,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    is_published: false,
  };

  globalThis.fetch = async (url) => {
    const u = String(url);
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
    if (u.includes(`/api/admin/tests/${detail.id}`)) {
      return new Response(JSON.stringify(detail), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "nf" }), { status: 404 });
  };

  await import("../../public/scripts/config.js");
  const { initAdmin } = await import("../../public/scripts/admin/main.js");
  await initAdmin();
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(document.querySelector("[data-test-select]"), null);
  const status = document.querySelector("[data-save-status]");
  assert.ok(String(status?.textContent || "").length > 0);
});

test("admin main: changing test select loads another test", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  const d1 = sampleAdminFullTest("t1");
  d1.id = "t1";
  d1.path = "t1/test.json";
  d1.title = "First";

  const d2 = sampleAdminFullTest("t2");
  d2.id = "t2";
  d2.path = "t2/test.json";
  d2.title = "Second";

  const meta = (d) => ({
    id: d.id,
    title: d.title,
    thumbnail: d.thumbnail,
    tags: d.tags,
    path: d.path,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    is_published: false,
  });

  const detailLoads = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/admin/tests") && u.includes("/images")) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.endsWith("/api/admin/tests") || u.endsWith("/api/admin/tests/")) {
      return new Response(JSON.stringify({ tests: [meta(d1), meta(d2)] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.includes(`/api/admin/tests/${d1.id}`) && !u.includes("images")) {
      detailLoads.push(d1.id);
      return new Response(JSON.stringify(d1), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.includes(`/api/admin/tests/${d2.id}`) && !u.includes("images")) {
      detailLoads.push(d2.id);
      return new Response(JSON.stringify(d2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "nf" }), { status: 404 });
  };

  await import("../../public/scripts/config.js");
  /** Static URL so `effects.loadTest(event.target.value)` (line 14) maps to the stable module in coverage. */
  const { initAdmin } = await import("../../public/scripts/admin/main.js");
  await initAdmin();
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 80));

  const sel = document.querySelector("[data-test-select]");
  assert.ok(sel);
  assert.ok(
    detailLoads.includes(d1.id),
    "bootstrap should load first test detail",
  );
  sel.selectedIndex = 1;
  const changeEv = new Event("change", { bubbles: true });
  Object.defineProperty(changeEv, "target", {
    configurable: true,
    enumerable: true,
    value: sel,
  });
  sel.dispatchEvent(changeEv);
  await new Promise((r) => setTimeout(r, 120));

  assert.ok(
    detailLoads.includes(d2.id),
    "expected loadTest to fetch detail for selected id",
  );
});

test("admin main: bootstrap failure shows error toast", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  globalThis.fetch = async () => {
    throw new Error("bootstrap-net-fail");
  };

  await import("../../public/scripts/config.js");
  /** Same module URL as other tests in this file so coverage merges `effects.loadTest` (line 14). */
  const { initAdmin } = await import("../../public/scripts/admin/main.js");
  await initAdmin();
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  const toast = document.querySelector(".admin-toast--error");
  assert.ok(toast?.textContent?.includes("bootstrap-net-fail"));
});
