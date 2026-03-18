(function () {
  // Public asset base URL (same-origin `/assets/*` avoids CORS).
  // Override via `window.ASSETS_BASE` / `window.API_TESTS_BASE` before this script.
  const DEFAULT_ASSETS_BASE = "/assets";
  const DEFAULT_API_TESTS_BASE = "/api/tests";

  const ASSETS_BASE = String(window.ASSETS_BASE || DEFAULT_ASSETS_BASE).replace(
    /\/+$/,
    "",
  );
  const API_TESTS_BASE = window.API_TESTS_BASE || DEFAULT_API_TESTS_BASE;

  window.ASSETS_BASE = ASSETS_BASE;
  window.API_TESTS_BASE = API_TESTS_BASE;

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

  /** Pure: append ?v= or &v= to URL. */
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
      typeof window !== "undefined" && window.location ?
        window.location.hostname
      : "";
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

    const basePairs = [
      ["width", options.width || "auto"],
      ["height", options.height || null],
      ["quality", options.quality || "auto"],
      ["fit", options.fit || "cover"],
      ["format", options.format || "auto"],
    ].filter(([, v]) => v != null);
    const extraPairs =
      options?.extra ?
        Object.entries(options.extra).filter(([, v]) => v != null)
      : [];
    const params = [...basePairs, ...extraPairs].map(
      ([key, value]) => `${key}=${value}`,
    );

    if (!params.length) return absoluteUrl;

    const paramString = params.join(",");
    const target =
      typeof absoluteUrl === "string" && absoluteUrl.startsWith("/") ?
        absoluteUrl.replace(/^\/+/, "")
      : absoluteUrl;
    return `/cdn-cgi/image/${paramString}/${target}`;
  };

  // Test index source:
  // - Default: same-origin `/api/tests` (served by Pages Functions using D1).
  // - You can override by setting `window.TEST_INDEX_URL` before this script runs.
  const DEFAULT_TEST_INDEX_URL = String(
    API_TESTS_BASE || DEFAULT_API_TESTS_BASE,
  );
  window.TEST_INDEX_URL = window.TEST_INDEX_URL || DEFAULT_TEST_INDEX_URL;

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
          const isHtml = contentType.includes("text/html");
          const hint =
            isHtml ?
              " API 경로(" +
              url +
              ")가 Worker가 아닌 정적 페이지로 갔습니다. Cloudflare에서 Worker 라우트(*도메인/api/*, *도메인/assets/*)를 연결했는지 확인하세요."
            : " (content-type: " + contentType + ', head: "' + head + '")';
          throw new Error("테스트 목록 응답이 JSON이 아닙니다." + hint);
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
    const resizedHeader = window.assetResizeUrl(
      "assets/images/HeaderBackgroundImg.png",
      {
        width: 1440,
        quality: 72,
        fit: "cover",
        format: "webp",
      },
    );
    const resizedHeaderNon = window.assetResizeUrl(
      "assets/images/HeaderBackgroundImgNon.png",
      {
        width: 1440,
        quality: 72,
        fit: "cover",
        format: "webp",
      },
    );
    const resizedFooter = window.assetResizeUrl(
      "assets/images/FooterBackgroundImg.png",
      {
        width: 1440,
        quality: 72,
        fit: "cover",
        format: "webp",
      },
    );
    root.setProperty("--asset-header-bg", `url(${resizedHeader})`);
    root.setProperty("--asset-header-bg-non", `url(${resizedHeaderNon})`);
    root.setProperty("--asset-footer-bg", `url(${resizedFooter})`);
  }

  // --- Pure: parse resize string to options object ---
  /** Pure: parse "width=1230,quality=85,fit=cover,format=auto" to options (immutable). */
  function parseResizeOptions(raw) {
    const str = String(raw || "").trim();
    if (!str) return {};

    return str.split(",").reduce((acc, pair) => {
      const p = String(pair || "").trim();
      if (!p) return acc;
      const idx = p.indexOf("=");
      if (idx <= 0) return acc;
      const key = p.slice(0, idx).trim();
      const value = p.slice(idx + 1).trim();
      if (!key || !value) return acc;

      if (key === "width" || key === "height") {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? { ...acc, [key]: n } : acc;
      }

      if (key === "minWidth" || key === "maxWidth" || key === "fallbackWidth") {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? { ...acc, [key]: n } : acc;
      }

      if (key === "quality") {
        const n = Number(value);
        return {
          ...acc,
          quality: Number.isFinite(n) && n > 0 ? n : value,
        };
      }

      if (key === "fit") return { ...acc, fit: value };
      if (key === "format") return { ...acc, format: value };
      return acc;
    }, {});
  }
  window.parseResizeOptions = parseResizeOptions;

  /** Build full absolute URL for an asset (for fetch/cache). */
  window.buildAssetUrl = function buildAssetUrl(path, resizeRaw, versionRaw) {
    const p = String(path || "").trim();
    if (!p) return "";
    let href = "";
    if (resizeRaw && typeof window.assetResizeUrl === "function") {
      href = appendVersion(
        window.assetResizeUrl(p, parseResizeOptions(String(resizeRaw))),
        versionRaw,
      );
    } else {
      href = appendVersion(window.assetUrl(p), versionRaw);
    }
    if (!href) return "";
    try {
      return new URL(href, window.location.origin).href;
    } catch (e) {
      return href;
    }
  };

  function computeMeasuredWidthPx(el, options) {
    const minWidth =
      options && typeof options.minWidth === "number" ? options.minWidth : 120;
    const maxWidth =
      options && typeof options.maxWidth === "number" ? options.maxWidth : 960;

    if (!el || typeof el.getBoundingClientRect !== "function") return null;
    const rect = el.getBoundingClientRect();
    const rendered = rect && typeof rect.width === "number" ? rect.width : 0;
    if (!Number.isFinite(rendered) || rendered <= 0) return null;

    const dpr =
      (
        typeof window !== "undefined" &&
        typeof window.devicePixelRatio === "number"
      ) ?
        window.devicePixelRatio
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
    const explicit = String(
      el.getAttribute("data-asset-lazy") || "",
    ).toLowerCase();
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
        typeof window !== "undefined" && window.location ?
          window.location.hostname
        : "";
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
      const widths = list
        .map((item) => {
          const m = item.match(/^(\d+)(w)?$/i);
          if (!m) return null;
          const n = Number(m[1]);
          return Number.isFinite(n) && n > 0 ? n : null;
        })
        .filter((n) => n != null);
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
      if (isLazyAssetElement(el) && !nearViewport(el) && observeLazy(el))
        return;

      if (el.hasAttribute && el.hasAttribute("data-asset-src")) {
        const path = el.getAttribute("data-asset-src");
        const resize = el.getAttribute("data-asset-resize");
        const version = el.getAttribute("data-asset-version");
        const autoWidth = String(
          el.getAttribute("data-asset-auto-width") || "",
        ).toLowerCase();
        maybeApplySrcset(el);
        if (path && !el.getAttribute("src")) {
          // Measured width based resizing (opt-in).
          if (
            !isLocalhost &&
            autoWidth === "true" &&
            typeof window.assetResizeUrl === "function"
          ) {
            const opts = parseResizeOptions(resize);
            const measured = computeMeasuredWidthPx(el, opts);
            if (!measured) {
              // If layout isn't ready yet, retry once on next frame.
              const tries = Number(
                el.getAttribute("data-asset-measure-tries") || "0",
              );
              if (tries < 2) {
                el.setAttribute("data-asset-measure-tries", String(tries + 1));
                requestAnimationFrame(() => applyAssetAttributes(el));
                return;
              }
            }
            const width =
              measured ||
              (typeof opts.fallbackWidth === "number" ?
                opts.fallbackWidth
              : undefined) ||
              (typeof opts.width === "number" ? opts.width : undefined) ||
              420;
            const url = appendVersion(
              window.assetResizeUrl(path, { ...opts, width }),
              version,
            );
            el.setAttribute("src", url);
            return;
          }
          el.setAttribute("src", toUrl(path, resize, version));

          // On resize load error: retry same resize URL once, then fallback to raw `/assets/*`.
          try {
            const isImg =
              el.tagName &&
              String(el.tagName).toLowerCase() === "img" &&
              typeof el.addEventListener === "function";
            const shouldFallback = Boolean(resize) && !isLocalhost && isImg;
            const already =
              el.getAttribute("data-asset-resize-fallback") === "1";
            if (shouldFallback && !already) {
              el.setAttribute("data-asset-resize-fallback", "1");
              el.addEventListener("error", () => {
                try {
                  if (
                    el.getAttribute("data-asset-resize-fallback-done") === "1"
                  )
                    return;
                  const retried =
                    el.getAttribute("data-asset-resize-retried") === "1";
                  if (!retried) {
                    el.setAttribute("data-asset-resize-retried", "1");
                    el.setAttribute("src", toUrl(path, resize, version));
                    return;
                  }
                  el.setAttribute("data-asset-resize-fallback-done", "1");
                  el.removeAttribute("src");
                  el.removeAttribute("srcset");
                  el.removeAttribute("sizes");
                  el.removeAttribute("data-asset-resize");
                  el.setAttribute(
                    "src",
                    appendVersion(window.assetUrl(path), version),
                  );
                } catch (e) {}
              });
            }
          } catch (e) {}
        }
      }
      if (el.hasAttribute && el.hasAttribute("data-asset-href")) {
        const path = el.getAttribute("data-asset-href");
        const version = el.getAttribute("data-asset-version");
        if (path && !el.getAttribute("href"))
          el.setAttribute("href", toUrl(path, null, version));
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
    window.prefetchImageAsset = function prefetchImageAsset(
      path,
      resizeRaw,
      versionRaw,
    ) {
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

        if (typeof requestIdleCallback === "function")
          requestIdleCallback(run, { timeout: 1200 });
        else setTimeout(run, 50);
      } catch (e) {}
    };

    // Promise-based image loader (used for intro "gate" preloading).
    // This actually creates an Image() so callers can await completion.
    window.loadImageAsset = function loadImageAsset(
      path,
      resizeRaw,
      versionRaw,
    ) {
      return new Promise((resolve) => {
        try {
          const p = String(path || "");
          if (!p) return resolve(false);

          const href = (function () {
            if (resizeRaw && typeof window.assetResizeUrl === "function") {
              return appendVersion(
                window.assetResizeUrl(
                  String(p),
                  parseResizeOptions(String(resizeRaw)),
                ),
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
