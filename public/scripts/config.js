(function () {
  // Pages Functions로 /assets/* 를 R2에서 프록시하도록 구성하면
  // 프런트는 같은 도메인(dreamp.org)만 바라보게 되어 CORS/CORP 이슈가 사라진다.
  // Public asset base URL (browser-facing).
  // Production default: same-origin `/assets/*` (served by Pages Functions using the R2 binding).
  // This avoids CORS issues when loading images from R2.
  // You can override by setting `window.ASSETS_BASE` before this script runs.
  // Keep the default explicit so callers can pass clean paths like `images/x.png`.
  const DEFAULT_ASSETS_BASE = "/assets";
  const DEFAULT_API_TESTS_BASE = "/api/tests";
  // Legacy: `assets/index.json` used to be served from R2.
  // New default: fetch test index from D1 via API (`GET /api/tests`).
  const DEFAULT_TEST_INDEX_PATH = "assets/index.json";

  const ASSETS_BASE = String(window.ASSETS_BASE || DEFAULT_ASSETS_BASE).replace(
    /\/+$/,
    "",
  );
  const API_TESTS_BASE = window.API_TESTS_BASE || DEFAULT_API_TESTS_BASE;
  const TEST_INDEX_PATH = window.TEST_INDEX_PATH || DEFAULT_TEST_INDEX_PATH;

  window.ASSETS_BASE = ASSETS_BASE;
  window.API_TESTS_BASE = API_TESTS_BASE;
  window.TEST_INDEX_PATH = TEST_INDEX_PATH;

  window.assetUrl = function assetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    // Accept both:
    // - `assets/images/x.png` (legacy in repo data)
    // - `images/x.png` (cleaner new convention)
    let clean = String(path).replace(/^\.?\/+/, "");
    clean = clean.replace(/^assets\/+/i, "");
    // Avoid accidental `//` joins when ASSETS_BASE is empty or ends with `/`.
    return `${ASSETS_BASE}/${clean}`.replace(/\/{2,}/g, "/");
  };

  function appendVersion(url, versionRaw) {
    const v = String(versionRaw || "").trim();
    if (!v) return url;
    try {
      const u = new URL(url, window.location.origin);
      if (!u.searchParams.has("v")) u.searchParams.set("v", v);
      return u.toString();
    } catch (e) {
      // For relative URLs like "/assets/..." without origin support.
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}v=${encodeURIComponent(v)}`;
    }
  }

  window.assetResizeUrl = function assetResizeUrl(path, options = {}) {
    const base = window.assetUrl(path);
    if (!base) return "";

    // Local dev (wrangler pages dev): `/cdn-cgi/image` is not reliably available.
    // To keep asset loading consistent, disable resize and just return `/assets/...`.
    const host =
      typeof window !== "undefined" && window.location ? window.location.hostname : "";
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    if (isLocalhost) return base;

    // Prefer same-origin relative URLs for `/cdn-cgi/image` so browser preloads match
    // and we don't fetch both `.../assets/x.png` and `.../https://origin/assets/x.png`.
    const absoluteUrl = (() => {
      // If the asset is already a relative path, keep it relative.
      if (typeof base === "string" && base.startsWith("/")) return base;
      try {
        return new URL(base, window.location.origin).toString();
      } catch (err) {
        return base;
      }
    })();

    const params = [];
    const pushParam = (key, defaultValue) => {
      const value = options[key] ?? defaultValue;
      if (value != null) {
        params.push(`${key}=${value}`);
      }
    };

    pushParam("width", options.width || "auto");
    pushParam("height", options.height || null);
    pushParam("quality", options.quality || "auto");
    pushParam("fit", options.fit || "cover");
    pushParam("format", options.format || "auto");

    // Allow passing additional options (e.g., `trim`, `background`).
    if (options?.extra) {
      Object.entries(options.extra).forEach(([key, value]) => {
        if (value != null) {
          params.push(`${key}=${value}`);
        }
      });
    }

    if (!params.length) return absoluteUrl;

    const paramString = params.filter(Boolean).join(",");
    const target =
      typeof absoluteUrl === "string" && absoluteUrl.startsWith("/")
        ? absoluteUrl.replace(/^\/+/, "")
        : absoluteUrl;
    return `/cdn-cgi/image/${paramString}/${target}`;
  };

  // Test index source:
  // - Default: same-origin `/api/tests` (served by Pages Functions using D1).
  // - Legacy fallback: `/assets/index.json` (served by Pages Functions proxy from R2).
  // - You can override by setting `window.TEST_INDEX_URL` before this script runs.
  const DEFAULT_TEST_INDEX_URL = String(API_TESTS_BASE || DEFAULT_API_TESTS_BASE);
  window.TEST_INDEX_URL =
    window.TEST_INDEX_URL || DEFAULT_TEST_INDEX_URL || window.assetUrl(TEST_INDEX_PATH);

  function getIndexOrigin() {
    try {
      return new URL(window.TEST_INDEX_URL, window.location.origin).origin;
    } catch (e) {
      return "";
    }
  }

  // Convert an index `path` field into a usable URL.
  // In current production, test JSON is fetched via the API, so this is mostly a utility.
  window.resolveTestDataUrl = function resolveTestDataUrl(rawPath) {
    if (!rawPath) return "";
    const str = String(rawPath).trim();
    if (/^https?:\/\//i.test(str)) return str;
    const clean = str.replace(/^\.?\/+/, "");
    const normalized = clean.startsWith("assets/") ? clean : `assets/${clean}`;
    const origin = getIndexOrigin();
    if (origin) return `${origin}/${normalized}`;
    return window.assetUrl(normalized);
  };

  // index.json을 한 번만 가져오도록 메모이즈.
  window.getTestIndex = (function createGetTestIndex() {
    let memo = null;
    return async function getTestIndex() {
      if (memo) return memo;
      const url = window.TEST_INDEX_URL;
      memo = fetch(url).then(async (res) => {
        if (!res.ok) throw new Error(url + " 요청 실패: " + res.status);
        const contentType = (
          res.headers.get("content-type") || ""
        ).toLowerCase();
        if (!contentType.includes("application/json")) {
          const text = await res.text();
          const head = text.slice(0, 80).replace(/\s+/g, " ");
          throw new Error(
            "index.json 응답이 JSON이 아닙니다: " +
              url +
              " (content-type: " +
              contentType +
              ', head: "' +
              head +
              '")',
          );
        }
        return res.json();
      });
      return memo;
    };
  })();

  // CSS 변수로도 내려주기 (background-image 등)
  if (typeof document !== "undefined") {
    const root = document.documentElement.style;
    root.setProperty("--ASSETS_BASE", ASSETS_BASE);
    const resizedHeader = window.assetResizeUrl("assets/images/HeaderBackgroundImg.png", {
      width: 1440,
      quality: 72,
      fit: "cover",
      format: "auto",
    });
    const resizedHeaderNon = window.assetResizeUrl(
      "assets/images/HeaderBackgroundImgNon.png",
      {
        width: 1440,
        quality: 72,
        fit: "cover",
        format: "auto",
      },
    );
    const resizedFooter = window.assetResizeUrl("assets/images/FooterBackgroundImg.png", {
      width: 1440,
      quality: 72,
      fit: "cover",
      format: "auto",
    });
    root.setProperty(
      "--asset-header-bg",
      `url(${resizedHeader})`,
    );
    root.setProperty(
      "--asset-header-bg-non",
      `url(${resizedHeaderNon})`,
    );
    root.setProperty(
      "--asset-footer-bg",
      `url(${resizedFooter})`,
    );
  }

  // data-asset-* 속성 자동 주입 (img/src, link/href, bg)
  /**
   * Parse a resize option string like:
   * - "width=1230,quality=85,fit=cover,format=auto"
   * @param {string} raw
   * @returns {{ width?: number, height?: number, quality?: number|string, fit?: string, format?: string }}
   */
  function parseResizeOptions(raw) {
    const out = {};
    const str = String(raw || "").trim();
    if (!str) return out;

    str.split(",").forEach((pair) => {
      const p = String(pair || "").trim();
      if (!p) return;
      const idx = p.indexOf("=");
      if (idx <= 0) return;
      const key = p.slice(0, idx).trim();
      const value = p.slice(idx + 1).trim();
      if (!key || !value) return;

      if (key === "width" || key === "height") {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) out[key] = n;
        return;
      }

      if (key === "minWidth" || key === "maxWidth" || key === "fallbackWidth") {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) out[key] = n;
        return;
      }

      if (key === "quality") {
        const n = Number(value);
        out.quality = Number.isFinite(n) && n > 0 ? n : value;
        return;
      }

      if (key === "fit") out.fit = value;
      if (key === "format") out.format = value;
    });

    return out;
  }

  function computeMeasuredWidthPx(el, options) {
    const minWidth =
      options && typeof options.minWidth === "number" ? options.minWidth : 160;
    const maxWidth =
      options && typeof options.maxWidth === "number" ? options.maxWidth : 1280;

    if (!el || typeof el.getBoundingClientRect !== "function") return null;
    const rect = el.getBoundingClientRect();
    const rendered = rect && typeof rect.width === "number" ? rect.width : 0;
    if (!Number.isFinite(rendered) || rendered <= 0) return null;

    const dpr =
      typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
        ? window.devicePixelRatio
        : 1;
    const target = Math.round(rendered * Math.max(1, dpr));
    const clamped = Math.max(minWidth, Math.min(target, maxWidth));
    return clamped;
  }

  const SUPPORTS_IO =
    typeof IntersectionObserver !== "undefined" &&
    typeof IntersectionObserverEntry !== "undefined";
  const OBSERVED = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  const LAZY_OBSERVER = (() => {
    if (!SUPPORTS_IO) return null;
    try {
      return new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            try {
              LAZY_OBSERVER && LAZY_OBSERVER.unobserve(el);
            } catch (e) {}
            // Re-run hydration now that the element is near the viewport.
            applyAssetAttributes(el);
          });
        },
        { rootMargin: "250px 0px", threshold: 0.01 },
      );
    } catch (e) {
      return null;
    }
  })();

  function isLazyAssetElement(el) {
    if (!el || !el.getAttribute) return false;
    const explicit = String(el.getAttribute("data-asset-lazy") || "").toLowerCase();
    if (explicit === "true") return true;
    const loading = String(el.getAttribute("loading") || "").toLowerCase();
    return loading === "lazy";
  }

  function nearViewport(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return true;
    const rect = el.getBoundingClientRect();
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    return rect.top < h + 250 && rect.bottom > -250;
  }

  function observeLazy(el) {
    if (!LAZY_OBSERVER || !el) return false;
    if (OBSERVED && OBSERVED.has(el)) return true;
    try {
      LAZY_OBSERVER.observe(el);
      OBSERVED && OBSERVED.add(el);
      return true;
    } catch (e) {
      return false;
    }
  }

  function applyAssetAttributes(root) {
    if (typeof document === "undefined") return;
    const scope = root && root.querySelectorAll ? root : document;
    const isLocalhost = (() => {
      const host =
        typeof window !== "undefined" && window.location ? window.location.hostname : "";
      return host === "localhost" || host === "127.0.0.1";
    })();

    const toUrl = (v, resizeRaw, versionRaw) => {
      if (!v) return "";
      let url = "";
      if (resizeRaw && typeof window.assetResizeUrl === "function") {
        url = window.assetResizeUrl(v, parseResizeOptions(resizeRaw));
      } else {
        url = window.assetUrl(v);
      }
      return appendVersion(url, versionRaw);
    };

    const parseSrcsetWidths = (raw) => {
      const list = String(raw || "")
        .split(",")
        .map((x) => String(x || "").trim())
        .filter(Boolean);
      const widths = [];
      for (const item of list) {
        const m = item.match(/^(\d+)(w)?$/i);
        if (!m) continue;
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0) widths.push(n);
      }
      return widths;
    };

    const maybeApplySrcset = (el) => {
      if (!el || !el.getAttribute || !el.setAttribute) return;
      if (isLocalhost) return; // avoid building `/cdn-cgi/image` srcset locally
      if (!el.hasAttribute("data-asset-srcset")) return;
      if (el.getAttribute("srcset")) return;

      const path = el.getAttribute("data-asset-src");
      if (!path) return;

      const widths = parseSrcsetWidths(el.getAttribute("data-asset-srcset"));
      if (!widths.length) return;

      const resizeRaw = el.getAttribute("data-asset-resize") || "";
      const baseOptions = parseResizeOptions(resizeRaw);
      const version = el.getAttribute("data-asset-version");

      const srcset = widths
        .map((w) => {
          const url = appendVersion(
            window.assetResizeUrl(path, { ...baseOptions, width: w }),
            version,
          );
          return `${url} ${w}w`;
        })
        .join(", ");

      el.setAttribute("srcset", srcset);
      const sizes = el.getAttribute("data-asset-sizes");
      if (sizes && !el.getAttribute("sizes")) el.setAttribute("sizes", sizes);
    };

    const maybeApply = (el) => {
      if (!el || el.nodeType !== 1) return;
      if (isLazyAssetElement(el) && !nearViewport(el) && observeLazy(el)) return;

      if (el.hasAttribute && el.hasAttribute("data-asset-src")) {
        const path = el.getAttribute("data-asset-src");
        const resize = el.getAttribute("data-asset-resize");
        const version = el.getAttribute("data-asset-version");
        const autoWidth = String(el.getAttribute("data-asset-auto-width") || "").toLowerCase();
        maybeApplySrcset(el);
        if (path && !el.getAttribute("src")) {
          // Measured width based resizing (opt-in).
          if (!isLocalhost && autoWidth === "true" && typeof window.assetResizeUrl === "function") {
            const opts = parseResizeOptions(resize);
            const measured = computeMeasuredWidthPx(el, opts);
            if (!measured) {
              // If layout isn't ready yet, retry once on next frame.
              const tries = Number(el.getAttribute("data-asset-measure-tries") || "0");
              if (tries < 2) {
                el.setAttribute("data-asset-measure-tries", String(tries + 1));
                requestAnimationFrame(() => applyAssetAttributes(el));
                return;
              }
            }
            const width =
              measured ||
              (typeof opts.fallbackWidth === "number" ? opts.fallbackWidth : undefined) ||
              (typeof opts.width === "number" ? opts.width : undefined) ||
              520;
            const url = appendVersion(
              window.assetResizeUrl(path, { ...opts, width }),
              version,
            );
            el.setAttribute("src", url);
            return;
          }
          el.setAttribute("src", toUrl(path, resize, version));
        }
      }
      if (el.hasAttribute && el.hasAttribute("data-asset-href")) {
        const path = el.getAttribute("data-asset-href");
        const version = el.getAttribute("data-asset-version");
        if (path && !el.getAttribute("href")) el.setAttribute("href", toUrl(path, null, version));
      }
      if (el.hasAttribute && el.hasAttribute("data-asset-bg")) {
        const path = el.getAttribute("data-asset-bg");
        const resize = el.getAttribute("data-asset-resize");
        const version = el.getAttribute("data-asset-version");
        if (path && !el.style?.backgroundImage)
          el.style.backgroundImage = `url(${toUrl(path, resize, version)})`;
      }
    };

    scope.querySelectorAll("[data-asset-src]").forEach((el) => maybeApply(el));
    scope.querySelectorAll("[data-asset-href]").forEach((el) => maybeApply(el));
    scope.querySelectorAll("[data-asset-bg]").forEach((el) => maybeApply(el));
    maybeApply(root);
  }

  // 가능한 한 빨리 src/href를 주입해야 브라우저가 이미지/리소스 다운로드를 빨리 시작한다.
  // - defer 없이 <head>에서 실행되는 경우에도 MutationObserver로 파싱 중 생성되는 노드에 즉시 주입
  if (typeof document !== "undefined") {
    // Expose a tiny hook so other scripts can re-hydrate after setting `data-asset-*`.
    // This keeps URL-building centralized in this file.
    window.applyAssetAttributes = applyAssetAttributes;

    // Centralized image prefetch helper (used by quiz/result for "next" images).
    // Runs in idle time, and uses the same URL resolution rules as hydration.
    window.prefetchImageAsset = function prefetchImageAsset(path, resizeRaw, versionRaw) {
      try {
        if (!path) return;
        // Avoid hitting `/cdn-cgi/image` repeatedly for prefetch. Warm the origin asset cache instead.
        const href = appendVersion(window.assetUrl(String(path)), versionRaw);
        if (!href) return;

        const run = () => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {};
          img.onerror = () => {};
          img.src = href;
        };

        if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 1200 });
        else setTimeout(run, 50);
      } catch (e) {}
    };

    // Promise-based image loader (used for intro "gate" preloading).
    // This actually creates an Image() so callers can await completion.
    window.loadImageAsset = function loadImageAsset(path, resizeRaw, versionRaw) {
      return new Promise((resolve) => {
        try {
          const p = String(path || "");
          if (!p) return resolve(false);

          const href = (function () {
            if (resizeRaw && typeof window.assetResizeUrl === "function") {
              return appendVersion(
                window.assetResizeUrl(String(p), parseResizeOptions(String(resizeRaw))),
                versionRaw,
              );
            }
            return appendVersion(window.assetUrl(String(p)), versionRaw);
          })();
          if (!href) return resolve(false);

          const img = new Image();
          img.decoding = "async";
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = href;
        } catch (e) {
          resolve(false);
        }
      });
    };

    applyAssetAttributes(document);

    try {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes || []) {
            if (!node || node.nodeType !== 1) continue;
            applyAssetAttributes(node);
          }
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (e) {
      // 구형 브라우저 fallback
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () =>
          applyAssetAttributes(document),
        );
      } else {
        applyAssetAttributes(document);
      }
    }
  }
})();
