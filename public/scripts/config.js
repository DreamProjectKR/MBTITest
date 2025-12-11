(function () {
  const DEFAULT_ASSETS_BASE =
    "https://pub-9394623df95a4f669f145a4ede63d588.r2.dev";
  const DEFAULT_API_TESTS_BASE = "/api/tests";
  const DEFAULT_TEST_INDEX_PATH = "assets/index.json";
  const DEFAULT_TEST_INDEX_URL =
    "https://pub-9394623df95a4f669f145a4ede63d588.r2.dev/assets/index.json";

  const ASSETS_BASE = window.ASSETS_BASE || DEFAULT_ASSETS_BASE;
  const API_TESTS_BASE = window.API_TESTS_BASE || DEFAULT_API_TESTS_BASE;
  const TEST_INDEX_PATH = window.TEST_INDEX_PATH || DEFAULT_TEST_INDEX_PATH;

  window.ASSETS_BASE = ASSETS_BASE;
  window.API_TESTS_BASE = API_TESTS_BASE;
  window.TEST_INDEX_PATH = TEST_INDEX_PATH;

  window.assetUrl = function assetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const clean = path.replace(/^\.?\/+/, "");
    return `${ASSETS_BASE}/${clean}`;
  };

  // R2에 올라간 index.json URL (기본: `${ASSETS_BASE}/assets/index.json`)
  window.TEST_INDEX_URL =
    window.TEST_INDEX_URL ||
    window.assetUrl(window.TEST_INDEX_PATH) ||
    DEFAULT_TEST_INDEX_URL;

  function getIndexOrigin() {
    try {
      return new URL(window.TEST_INDEX_URL).origin;
    } catch (e) {
      return "";
    }
  }

  // index.json 항목의 `path`(또는 파일 경로)를 테스트 JSON의 절대 URL로 변환한다.
  // - "test-summer/test.json" -> `${ASSETS_BASE}/assets/test-summer/test.json`
  // - "assets/test-summer/test.json" -> `${ASSETS_BASE}/assets/test-summer/test.json`
  // - "https://..." -> 그대로
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
    root.setProperty(
      "--asset-header-bg",
      `url(${window.assetUrl("assets/images/HeaderBackgroundImg.png")})`,
    );
    root.setProperty(
      "--asset-header-bg-non",
      `url(${window.assetUrl("assets/images/HeaderBackgroundImgNon.png")})`,
    );
    root.setProperty(
      "--asset-footer-bg",
      `url(${window.assetUrl("assets/images/FooterBackgroundImg.png")})`,
    );
  }

  // data-asset-* 속성 자동 주입 (img/src, link/href, bg)
  function applyAssetAttributes() {
    const toUrl = (v) => (v ? window.assetUrl(v) : "");

    document.querySelectorAll("[data-asset-src]").forEach((el) => {
      const path = el.getAttribute("data-asset-src");
      if (path) el.src = toUrl(path);
    });

    document.querySelectorAll("[data-asset-href]").forEach((el) => {
      const path = el.getAttribute("data-asset-href");
      if (path) el.href = toUrl(path);
    });

    document.querySelectorAll("[data-asset-bg]").forEach((el) => {
      const path = el.getAttribute("data-asset-bg");
      if (path) el.style.backgroundImage = `url(${toUrl(path)})`;
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", applyAssetAttributes);
    } else {
      applyAssetAttributes();
    }
  }
})();
