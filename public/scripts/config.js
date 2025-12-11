(function () {
  const DEFAULT_ASSETS_BASE =
    "https://pub-9394623df95a4f669f145a4ede63d588.r2.dev";
  const DEFAULT_API_TESTS_BASE = "/api/tests";

  const ASSETS_BASE = window.ASSETS_BASE || DEFAULT_ASSETS_BASE;
  const API_TESTS_BASE = window.API_TESTS_BASE || DEFAULT_API_TESTS_BASE;

  window.ASSETS_BASE = ASSETS_BASE;
  window.API_TESTS_BASE = API_TESTS_BASE;

  window.assetUrl = function assetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const clean = path.replace(/^\.?\/+/, "");
    return `${ASSETS_BASE}/${clean}`;
  };

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
