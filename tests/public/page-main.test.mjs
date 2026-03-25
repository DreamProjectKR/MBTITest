import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_PAGE_HTML } from "./fixtures-pages.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

function mainImportHref() {
  const u = new URL("../../public/scripts/main.js", import.meta.url);
  u.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return u.href;
}

test("main.js loads index and renders cards from /api/tests", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  const sample = {
    id: "a1",
    title: "A",
    thumbnail: "assets/a1/t.png",
    tags: ["x"],
    path: "a1/test.json",
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
  await import(mainImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 30));

  const shells = document.querySelectorAll(".NewTestShell");
  assert.ok(shells.length >= 1);
});

test("main.js uses window.getTestIndex when available", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  const sample = {
    id: "via-index",
    title: "From getTestIndex",
    thumbnail: "assets/x/t.png",
    tags: ["g"],
    path: "x/test.json",
    updatedAt: "2026-04-01",
  };

  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  window.getTestIndex = async () => ({ tests: [sample] });

  await import(mainImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(fetchCalled, false);
  assert.ok(
    [...document.querySelectorAll(".NewTestShell")].some((el) =>
      el.textContent?.includes("From getTestIndex"),
    ),
  );
});

test("main.js logs when test list fetch fails", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  globalThis.fetch = async () => new Response("", { status: 503 });
  const errs = [];
  const prev = console.error;
  console.error = (...args) => {
    errs.push(args.map(String).join(" "));
    prev.apply(console, args);
  };

  /** No `config.js`: `getTestIndex` is absent so `fetchTestsAjax` uses `fetch` and surfaces errors. */
  await import(mainImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));
  console.error = prev;

  assert.ok(errs.some((e) => e.includes("테스트 목록 로딩 실패")));
});

test("main.js sticky header toggles classes on scroll", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tests: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  await import("../../public/scripts/config.js");
  await import(mainImportHref());

  const header = document.getElementById("header");
  assert.ok(header);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 9999,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.ok(header.classList.contains("fixed-header"));
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => 0,
  });
  window.dispatchEvent(new Event("scroll"));
  assert.equal(header.classList.contains("fixed-header"), false);
});

test("main.js navigates to testintro when a card is clicked", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  const sample = {
    id: "click-id",
    title: "Click me",
    thumbnail: "assets/click-id/t.png",
    tags: ["a"],
    path: "click-id/test.json",
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
  await import(mainImportHref());

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const card = document.querySelector(".NewTestShell");
  assert.ok(card);
  card.click();
  assert.ok(hrefSnap.includes("testintro.html"));
  assert.ok(hrefSnap.includes("click-id"));
});

test("main.js uses local assetUrl when config is not loaded", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  const sample = {
    id: "nocfg",
    title: "No cfg",
    thumbnail: "assets/nocfg/t.png",
    tags: [],
    path: "nocfg/test.json",
    updatedAt: "2026-01-01",
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

  await import(mainImportHref());
  assert.equal(typeof window.assetUrl, "undefined");

  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(document.body.textContent?.includes("No cfg"));
});

test("main.js dedupes same id+path and sorts by updatedAt", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  const older = {
    id: "same",
    title: "Older",
    thumbnail: "",
    tags: [],
    path: "same/test.json",
    updatedAt: "2020-01-01",
  };
  const newer = {
    id: "same",
    title: "Newer",
    thumbnail: "",
    tags: [],
    path: "same/test.json",
    updatedAt: "2026-01-01",
  };

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/tests")) {
      return new Response(JSON.stringify({ tests: [newer, older] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(mainImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.ok(document.body.textContent?.includes("Newer"));
  assert.ok(!document.body.textContent?.includes("Older"));
});

test("main.js uses fetch when getTestIndex is removed", async () => {
  createBrowserEnv();
  document.body.innerHTML = MAIN_PAGE_HTML;

  let fetched = "";
  globalThis.fetch = async (url) => {
    fetched = String(url);
    return new Response(JSON.stringify({ tests: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await import("../../public/scripts/config.js");
  delete window.getTestIndex;
  await import(mainImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 40));

  assert.ok(fetched.includes("/api/tests"));
});
