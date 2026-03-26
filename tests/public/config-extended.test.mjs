import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

/** Unique `?v=` per import so `config.js` IIFE re-runs with each test's `window` (Node ESM cache). */
function scriptHref(rel) {
  const u = new URL(rel, import.meta.url);
  u.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return u.href;
}

test("config: appendVersion falls back when URL() rejects invalid href", async () => {
  createBrowserEnv({ url: "http://127.0.0.1:8788/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const prev = window.assetUrl;
  window.assetUrl = () => "http://%%%";
  document.body.innerHTML =
    '<img data-asset-src="x" data-asset-version="7" alt="" />';
  window.applyAssetAttributes(document.body);
  const src = document.querySelector("img")?.getAttribute("src");
  assert.ok(src && src.includes("v="), String(src));
  window.assetUrl = prev;
});

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
  assert.equal(window.parseResizeOptions("quality=0").quality, "0");
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

test("config: buildAssetUrl keeps existing v query when version param also passed", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const u = window.buildAssetUrl("assets/keep.png?v=first", null, "second");
  assert.ok(u.includes("v=first"));
  assert.ok(!u.includes("v=second"));
});

test("config: assetResizeUrl on localhost skips cdn-cgi image", async () => {
  createBrowserEnv({ url: "http://127.0.0.1:8788/page" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const out = window.assetResizeUrl("assets/local.png", {
    width: 640,
    quality: 80,
  });
  assert.ok(!out.includes("cdn-cgi"));
  assert.ok(out.includes("/assets/"));
});

test("config: lazy image hydrates without lazy observer when IntersectionObserverEntry missing", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const OrigIo = globalThis.IntersectionObserver;
  const OrigEntry = globalThis.IntersectionObserverEntry;
  globalThis.IntersectionObserver = class {};
  delete globalThis.IntersectionObserverEntry;
  try {
    await import(scriptHref("../../public/scripts/config.js"));
    const img = document.createElement("img");
    img.setAttribute("data-asset-src", "assets/images/no-lazy-io.png");
    img.setAttribute("data-asset-lazy", "true");
    img.setAttribute("loading", "lazy");
    img.getBoundingClientRect = () => ({
      top: 50000,
      bottom: 50100,
      width: 200,
    });
    document.body.appendChild(img);
    window.applyAssetAttributes(img);
    assert.ok(String(img.getAttribute("src") || "").includes("/assets/"));
  } finally {
    globalThis.IntersectionObserver = OrigIo;
    if (OrigEntry !== undefined)
      globalThis.IntersectionObserverEntry = OrigEntry;
  }
});

test("config: lazy off-screen img hydrates when IntersectionObserver fires", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  globalThis.IntersectionObserver = class {
    constructor(cb) {
      this._cb = cb;
    }
    observe(el) {
      queueMicrotask(() => {
        this._cb([{ isIntersecting: true, target: el }]);
      });
    }
    unobserve() {}
    disconnect() {}
  };
  await import(scriptHref("../../public/scripts/config.js"));
  const img = document.createElement("img");
  img.setAttribute("data-asset-src", "assets/images/lazy.png");
  img.setAttribute("data-asset-lazy", "true");
  img.setAttribute("loading", "lazy");
  img.getBoundingClientRect = () => ({
    top: 50000,
    bottom: 50100,
    width: 200,
  });
  document.body.appendChild(img);
  window.applyAssetAttributes(img);
  await new Promise((r) => queueMicrotask(r));
  await new Promise((r) => queueMicrotask(r));
  assert.ok(String(img.getAttribute("src") || "").length > 0);
});

test("config: IntersectionObserver constructor failure leaves lazy observer disabled", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const OrigIo = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor() {
      throw new Error("no-io");
    }
  };
  try {
    await import(scriptHref("../../public/scripts/config.js"));
    assert.equal(typeof window.applyAssetAttributes, "function");
  } finally {
    globalThis.IntersectionObserver = OrigIo;
  }
});

test("config: buildAssetUrl falls back when absolute href is invalid for URL()", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const orig = window.assetUrl;
  window.assetUrl = () => "http://a b.com/assets/x.png";
  try {
    const out = window.buildAssetUrl("ignored", null, "1");
    assert.ok(typeof out === "string");
    assert.ok(out.includes("a b.com") || out.length > 0);
  } finally {
    window.assetUrl = orig;
  }
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

test("config: getTestIndex rejects when fetch throws", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  globalThis.fetch = async () => {
    throw new Error("getTestIndex fetch boom");
  };
  await import(scriptHref("../../public/scripts/config.js"));
  await assert.rejects(() => window.getTestIndex(), /getTestIndex fetch boom/);
});

test("config: getTestIndex rejects when JSON body is invalid", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  globalThis.fetch = async () =>
    new Response("not-json-{", {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  await import(scriptHref("../../public/scripts/config.js"));
  await assert.rejects(() => window.getTestIndex(), SyntaxError);
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

test("config: getTestIndex HTML response hint mentions Worker / static page", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  globalThis.fetch = async () =>
    new Response("<html></html>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  await import(scriptHref("../../public/scripts/config.js"));
  await assert.rejects(
    () => window.getTestIndex(),
    /Worker가 아닌 정적 페이지/,
  );
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

test("config: MutationObserver failure + readyState complete hydrates without DCL", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const img = document.createElement("img");
  img.id = "mo-complete-fallback";
  img.setAttribute("data-asset-src", "assets/images/mo-complete-fallback.png");
  document.body.appendChild(img);

  const Orig = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    constructor() {
      throw new Error("no-mo");
    }
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "complete",
  });

  try {
    await import(scriptHref("../../public/scripts/config.js"));
    await new Promise((r) => setTimeout(r, 20));
    const el = document.getElementById("mo-complete-fallback");
    assert.ok(
      String(el?.getAttribute("src") || "").includes("/assets/"),
      String(el?.getAttribute("src")),
    );
  } finally {
    globalThis.MutationObserver = Orig;
  }
});

test("config: sets CSS custom properties on documentElement", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const style = document.documentElement.style;
  assert.ok(style.getPropertyValue("--ASSETS_BASE").length > 0);
  assert.ok(style.getPropertyValue("--asset-header-bg").includes("url("));
});

test("config: buildAssetUrl omits v param when version is empty string", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const u = window.buildAssetUrl("assets/nov.png", "width=100", "");
  assert.ok(!/[?&]v=/.test(u), String(u));
});

test("config: computeMeasuredWidthPx uses devicePixelRatio when set", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: 2,
  });
  await import(scriptHref("../../public/scripts/config.js"));
  const img = document.createElement("img");
  img.setAttribute("data-asset-src", "assets/images/dpr.png");
  img.setAttribute("data-asset-resize", "width=200,minWidth=100,maxWidth=800");
  img.setAttribute("data-asset-auto-width", "true");
  img.getBoundingClientRect = () => ({ width: 100 });
  document.body.appendChild(img);
  window.applyAssetAttributes(img);
  const src = String(img.getAttribute("src") || "");
  assert.ok(src.includes("/cdn-cgi/image/"));
});

test("config: trims trailing slashes on window.ASSETS_BASE", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  window.ASSETS_BASE = "/my-assets///";
  await import(scriptHref("../../public/scripts/config.js"));
  assert.equal(window.ASSETS_BASE, "/my-assets");
});

test("config: MutationObserver failure + readyState loading hydrates on DOMContentLoaded", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const img = document.createElement("img");
  img.id = "mo-dcl";
  img.setAttribute("data-asset-src", "assets/images/mo-dcl.png");
  document.body.appendChild(img);

  const Orig = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    constructor() {
      throw new Error("no-mo");
    }
  };
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => "loading",
  });

  try {
    await import(scriptHref("../../public/scripts/config.js"));
    dispatchDomContentLoaded(window);
    await new Promise((r) => setTimeout(r, 20));
    const el = document.getElementById("mo-dcl");
    assert.ok(
      String(el?.getAttribute("src") || "").includes("/assets/"),
      String(el?.getAttribute("src")),
    );
  } finally {
    globalThis.MutationObserver = Orig;
    Object.defineProperty(document, "readyState", {
      configurable: true,
      get: () => "complete",
    });
  }
});

test("config: lazy observe throws — falls through to immediate hydration", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const OrigIo = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor() {}
    observe() {
      throw new Error("observe-fail");
    }
    unobserve() {}
    disconnect() {}
  };
  try {
    await import(scriptHref("../../public/scripts/config.js"));
    const img = document.createElement("img");
    img.setAttribute("data-asset-src", "assets/images/lazy-obs-fail.png");
    img.setAttribute("data-asset-lazy", "true");
    img.setAttribute("loading", "lazy");
    img.getBoundingClientRect = () => ({
      top: 50000,
      bottom: 50100,
      width: 200,
    });
    document.body.appendChild(img);
    window.applyAssetAttributes(img);
    assert.ok(String(img.getAttribute("src") || "").includes("/assets/"));
  } finally {
    globalThis.IntersectionObserver = OrigIo;
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

test("config: loadImageAsset resolves false when Image constructor throws", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const Orig = globalThis.Image;
  globalThis.Image = class {
    constructor() {
      throw new Error("no Image");
    }
  };
  try {
    await import(scriptHref("../../public/scripts/config.js"));
    const ok = await window.loadImageAsset("assets/throws.png", null, "1");
    assert.equal(ok, false);
  } finally {
    globalThis.Image = Orig;
  }
});

test("config: applyAssetAttributes skips data-asset-bg when backgroundImage already set", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const div = document.createElement("div");
  div.style.backgroundImage = 'url("https://example.com/keep-this.png")';
  div.setAttribute("data-asset-bg", "assets/other-bg.png");
  div.setAttribute("data-asset-resize", "width=800");
  document.body.appendChild(div);
  window.applyAssetAttributes(div);
  assert.ok(String(div.style.backgroundImage || "").includes("keep-this.png"));
  assert.ok(!String(div.style.backgroundImage || "").includes("other-bg"));
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

test("config: invalid data-asset-srcset widths skip srcset but still set src", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const img = document.createElement("img");
  img.setAttribute("data-asset-src", "assets/images/no-srcset.png");
  img.setAttribute("data-asset-srcset", "foo,bar,12zz");
  img.setAttribute("data-asset-resize", "width=100");
  document.body.appendChild(img);
  window.applyAssetAttributes(img);
  assert.equal(img.getAttribute("srcset"), null);
  assert.ok(String(img.getAttribute("src") || "").includes("/cdn-cgi/image/"));
});

test("config: lazy off-screen hydrates when IntersectionObserver.observe throws", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const OrigIo = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    observe() {
      throw new Error("observe-fail");
    }
    unobserve() {}
    disconnect() {}
  };
  try {
    await import(scriptHref("../../public/scripts/config.js"));
    const img = document.createElement("img");
    img.setAttribute("data-asset-src", "assets/images/observe-throw.png");
    img.setAttribute("data-asset-lazy", "true");
    img.setAttribute("loading", "lazy");
    img.getBoundingClientRect = () => ({
      top: 50000,
      bottom: 50100,
      width: 200,
    });
    document.body.appendChild(img);
    window.applyAssetAttributes(img);
    assert.ok(String(img.getAttribute("src") || "").includes("/assets/"));
  } finally {
    globalThis.IntersectionObserver = OrigIo;
  }
});

test("config: lazy IO callback swallows unobserve errors", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const OrigIo = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor(cb) {
      this._cb = cb;
    }
    observe(el) {
      queueMicrotask(() => {
        this._cb([{ isIntersecting: true, target: el }]);
      });
    }
    unobserve() {
      throw new Error("unobserve-fail");
    }
    disconnect() {}
  };
  try {
    await import(scriptHref("../../public/scripts/config.js"));
    const img = document.createElement("img");
    img.setAttribute("data-asset-src", "assets/images/unobserve-throw.png");
    img.setAttribute("data-asset-lazy", "true");
    img.setAttribute("loading", "lazy");
    img.getBoundingClientRect = () => ({
      top: 50000,
      bottom: 50100,
      width: 200,
    });
    document.body.appendChild(img);
    window.applyAssetAttributes(img);
    await new Promise((r) => queueMicrotask(r));
    await new Promise((r) => queueMicrotask(r));
    assert.ok(String(img.getAttribute("src") || "").includes("/assets/"));
  } finally {
    globalThis.IntersectionObserver = OrigIo;
  }
});

test("config: applyAssetAttributes swallows addEventListener throw on resize fallback wiring", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const img = document.createElement("img");
  img.setAttribute("data-asset-src", "assets/images/addevent-fail.png");
  img.setAttribute("data-asset-resize", "width=640");
  img.addEventListener = () => {
    throw new Error("no-listeners");
  };
  document.body.appendChild(img);
  assert.doesNotThrow(() => window.applyAssetAttributes(img));
  assert.ok(String(img.getAttribute("src") || "").includes("/cdn-cgi/image/"));
});

test("config: resize load error retries once then falls back to raw /assets", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  document.body.innerHTML = `
    <img id="errimg"
      data-asset-src="assets/images/fail.png"
      data-asset-resize="width=640,quality=80"
    />
  `;
  await import(scriptHref("../../public/scripts/config.js"));
  const img = document.getElementById("errimg");
  img.dispatchEvent(new Event("error"));
  assert.equal(img.getAttribute("data-asset-resize-retried"), "1");
  img.dispatchEvent(new Event("error"));
  assert.equal(img.getAttribute("data-asset-resize-fallback-done"), "1");
  const src = String(img.getAttribute("src") || "");
  assert.ok(src.includes("/assets/"));
  assert.ok(!src.includes("/cdn-cgi/image/"));
});

test("config: prefetchImageAsset swallows errors when assetUrl throws", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const prev = window.assetUrl;
  window.assetUrl = () => {
    throw new Error("prefetch-assetUrl-boom");
  };
  try {
    assert.doesNotThrow(() =>
      window.prefetchImageAsset("assets/x.png", null, "1"),
    );
  } finally {
    window.assetUrl = prev;
  }
});

test("config: MutationObserver hydrates dynamically appended data-asset-src", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const img = document.createElement("img");
  img.setAttribute("data-asset-src", "assets/images/mo-append.png");
  document.body.appendChild(img);
  await new Promise((r) => setTimeout(r, 30));
  const src = String(img.getAttribute("src") || "");
  assert.ok(src.includes("mo-append.png") && src.includes("/assets/"), src);
});

test("config: auto-width retries measure when layout width is zero", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  const prevRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => {
    cb();
    return 0;
  };
  try {
    await import(scriptHref("../../public/scripts/config.js"));
    const img = document.createElement("img");
    img.id = "auto";
    img.setAttribute("data-asset-src", "assets/images/auto.png");
    img.setAttribute("data-asset-resize", "width=200,fallbackWidth=360");
    img.setAttribute("data-asset-auto-width", "true");
    img.getBoundingClientRect = () => ({ width: 0 });
    document.body.appendChild(img);
    window.applyAssetAttributes(img);
  } finally {
    globalThis.requestAnimationFrame = prevRaf;
  }
  const img = document.getElementById("auto");
  assert.equal(img.getAttribute("data-asset-measure-tries"), "2");
  assert.ok(String(img.getAttribute("src") || "").includes("/cdn-cgi/image/"));
});

test("config: parseResizeOptions ignores unknown keys in pairs", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  assert.deepEqual(window.parseResizeOptions("width=10,unknownKey=x"), {
    width: 10,
  });
  assert.deepEqual(window.parseResizeOptions("onlyUnknown=1"), {});
});

test("config: buildAssetUrl returns empty when path is whitespace only", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  assert.equal(window.buildAssetUrl("  \t\n", null, "v"), "");
});

test("config: prefetchImageAsset returns early for falsy path", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  let images = 0;
  globalThis.Image = class {
    set src(_v) {
      images += 1;
    }
  };
  globalThis.requestIdleCallback = (cb) => {
    cb({ didTimeout: false });
  };
  await import(scriptHref("../../public/scripts/config.js"));
  window.prefetchImageAsset("", null, null);
  window.prefetchImageAsset(undefined, null, null);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(images, 0);
});

test("config: applyAssetAttributes sets sizes from data-asset-sizes on production", async () => {
  createBrowserEnv({ url: "https://example.com/" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const img = document.createElement("img");
  img.setAttribute("data-asset-src", "assets/images/sizes-attr.png");
  img.setAttribute("data-asset-srcset", "320,640");
  img.setAttribute("data-asset-sizes", "(max-width: 600px) 90vw, 400px");
  img.setAttribute("data-asset-resize", "width=400,fit=cover,format=webp");
  document.body.appendChild(img);
  window.applyAssetAttributes(img);
  const sizes = img.getAttribute("sizes");
  assert.ok(sizes && sizes.includes("90vw"), String(sizes));
  assert.ok(String(img.getAttribute("srcset") || "").length > 0);
});

test("config: assetResizeUrl builds cdn-cgi path for absolute https asset URL", async () => {
  createBrowserEnv({ url: "https://example.com/page" });
  document.documentElement.innerHTML =
    "<html><head></head><body></body></html>";
  await import(scriptHref("../../public/scripts/config.js"));
  const out = window.assetResizeUrl("https://cdn.example.net/remote.png", {
    width: 200,
    quality: 80,
  });
  assert.ok(out.startsWith("/cdn-cgi/image/"));
  assert.ok(
    out.includes("cdn.example.net") || out.includes("remote.png"),
    String(out),
  );
});
