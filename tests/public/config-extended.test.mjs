import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserEnv } from "./setup-happy-dom.mjs";

function scriptHref(rel) {
  const u = new URL(rel, import.meta.url);
  u.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return u.href;
}

test("config: production host uses /cdn-cgi/image for assetResizeUrl", async () => {
  createBrowserEnv({ url: "https://example.com/page" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const out = window.assetResizeUrl("images/x.png", {
    width: 400,
    extra: { gravity: "auto" },
  });
  assert.ok(out.startsWith("/cdn-cgi/image/"));
  assert.ok(out.includes("width=400"));
  assert.ok(out.includes("gravity=auto"));
});

test("config: parseResizeOptions handles pairs and numeric keys", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  assert.deepEqual(window.parseResizeOptions(""), {});
  assert.deepEqual(window.parseResizeOptions("  "), {});
  assert.equal(window.parseResizeOptions("width=120").width, 120);
  assert.equal(window.parseResizeOptions("height=200").height, 200);
  assert.equal(window.parseResizeOptions("minWidth=10").minWidth, 10);
  assert.equal(window.parseResizeOptions("maxWidth=900").maxWidth, 900);
  assert.equal(
    window.parseResizeOptions("fallbackWidth=420").fallbackWidth,
    420,
  );
  assert.equal(window.parseResizeOptions("quality=85").quality, 85);
  assert.equal(window.parseResizeOptions("fit=contain").fit, "contain");
  assert.equal(window.parseResizeOptions("format=webp").format, "webp");
  assert.deepEqual(window.parseResizeOptions("badpair"), {});
  assert.deepEqual(window.parseResizeOptions("=nope"), {});
});

test("config: buildAssetUrl merges resize, version, and empty path", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  assert.equal(window.buildAssetUrl("", null, "1"), "");
  const withResize = window.buildAssetUrl(
    "assets/a.png",
    "width=100,quality=80",
    "v9",
  );
  assert.ok(withResize.includes("v9"));
  assert.ok(withResize.startsWith("https://example.com/"));
  const plain = window.buildAssetUrl("assets/b.png", null, null);
  assert.ok(plain.includes("/assets/"));
});

test("config: getTestIndex memoizes and validates JSON", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ tests: [{ id: "t1" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };
  await import(scriptHref("../../public/scripts/config.js"));
  const a = await window.getTestIndex();
  const b = await window.getTestIndex();
  assert.equal(calls, 1);
  assert.equal(a.tests[0].id, "t1");
  assert.strictEqual(a, b);
});

test("config: getTestIndex rejects non-ok response", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  globalThis.fetch = async () => new Response("", { status: 502 });
  await import(scriptHref("../../public/scripts/config.js"));
  await assert.rejects(() => window.getTestIndex(), /502/);
});

test("config: getTestIndex rejects non-JSON content-type", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  globalThis.fetch = async () =>
    new Response("<!doctype html><title>x</title>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  await import(scriptHref("../../public/scripts/config.js"));
  await assert.rejects(() => window.getTestIndex(), /JSON/);
});

test("config: getTestIndex non-JSON non-HTML hint includes content-type", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  globalThis.fetch = async () =>
    new Response("not json", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  await import(scriptHref("../../public/scripts/config.js"));
  await assert.rejects(
    () => window.getTestIndex(),
    /content-type: text\/plain/,
  );
});

test("config: parseResizeOptions ignores non-finite width and minWidth", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  assert.deepEqual(window.parseResizeOptions("width=nan"), {});
  assert.deepEqual(window.parseResizeOptions("minWidth=0"), {});
});

test("config: parseResizeOptions quality keeps string when not finite", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  assert.equal(window.parseResizeOptions("quality=auto").quality, "auto");
});

test("config: MutationObserver constructor failure uses fallback hydration", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const Orig = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    constructor() {
      throw new Error("no-mo");
    }
  };
  try {
    await import(scriptHref("../../public/scripts/config.js"));
    assert.equal(typeof window.applyAssetAttributes, "function");
  } finally {
    globalThis.MutationObserver = Orig;
  }
});

test("config: prefetchImageAsset uses requestIdleCallback when available", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  let idleRan = false;
  globalThis.requestIdleCallback = (cb) => {
    idleRan = true;
    cb({ didTimeout: false });
  };
  const loads = [];
  globalThis.Image = class MockImage {
    set src(_v) {
      loads.push("set");
    }
  };
  await import(scriptHref("../../public/scripts/config.js"));
  window.prefetchImageAsset("assets/p.png", null, "1");
  assert.ok(idleRan);
  assert.equal(loads.length, 1);
});

test("config: prefetchImageAsset falls back to setTimeout without rIC", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const prevRic = globalThis.requestIdleCallback;
  const prevSt = globalThis.setTimeout;
  delete globalThis.requestIdleCallback;
  globalThis.setTimeout = (fn, _ms) => {
    fn();
    return 0;
  };
  const loads = [];
  globalThis.Image = class MockImage {
    set src(_v) {
      loads.push("set");
    }
  };
  try {
    await import(scriptHref("../../public/scripts/config.js"));
    window.prefetchImageAsset("assets/q.png", null, null);
    assert.equal(loads.length, 1);
  } finally {
    globalThis.requestIdleCallback = prevRic;
    globalThis.setTimeout = prevSt;
  }
});

test("config: loadImageAsset resolves true on load", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  globalThis.Image = class {
    set src(_v) {
      queueMicrotask(() => this.onload && this.onload());
    }
  };
  await import(scriptHref("../../public/scripts/config.js"));
  const ok = await window.loadImageAsset("assets/ok.png", null, "v");
  assert.equal(ok, true);
});

test("config: loadImageAsset resolves false on error", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  globalThis.Image = class {
    set src(_v) {
      queueMicrotask(() => this.onerror && this.onerror());
    }
  };
  await import(scriptHref("../../public/scripts/config.js"));
  const ok = await window.loadImageAsset("assets/bad.png", "width=10", null);
  assert.equal(ok, false);
});

test("config: loadImageAsset empty path resolves false", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const ok = await window.loadImageAsset("  ", null, null);
  assert.equal(ok, false);
});

test("config: applyAssetAttributes sets img src and link href on production", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  document.body.innerHTML = `
    <img id="i" data-asset-src="assets/images/x.png" data-asset-resize="width=640" />
    <a id="l" data-asset-href="assets/doc.pdf" data-asset-version="2"></a>
    <div id="g" data-asset-bg="assets/bg.png" data-asset-resize="width=1200"></div>
  `;
  await import(scriptHref("../../public/scripts/config.js"));
  const img = document.getElementById("i");
  assert.ok(String(img.getAttribute("src") || "").includes("/cdn-cgi/image/"));
  const link = document.getElementById("l");
  assert.ok(link.getAttribute("href").includes("/assets/"));
  assert.ok(link.getAttribute("href").includes("v=2"));
  const bg = document.getElementById("g");
  assert.ok(String(bg.style.backgroundImage || "").includes("url("));
});

test("config: applyAssetAttributes builds srcset when data-asset-srcset is set", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  document.body.innerHTML = `
    <img id="s"
      data-asset-src="assets/images/hero.png"
      data-asset-srcset="400w, 800w"
      data-asset-resize="fit=cover,format=webp"
      data-asset-version="3"
    />
  `;
  await import(scriptHref("../../public/scripts/config.js"));
  const srcset = document.getElementById("s").getAttribute("srcset");
  assert.ok(srcset && srcset.includes("400w"));
  assert.ok(srcset.includes("800w"));
});
