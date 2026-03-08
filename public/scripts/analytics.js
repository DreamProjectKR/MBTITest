/**
 * Deferred Google Analytics loader.
 * Loads gtag after DOMContentLoaded + idle to avoid Protected Audience API,
 * Shared Storage API, and StorageType.persistent deprecation warnings during
 * initial page load (these come from gtag.js; we cannot fix Google's code).
 */
(function () {
  const GA_ID = "G-WGNTDN4MYS";

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID);

  function loadGtag() {
    if (window.__gtagLoaded) return;
    window.__gtagLoaded = true;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function scheduleLoad() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
  }

  function run() {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => loadGtag(), { timeout: 3000 });
    } else {
      setTimeout(loadGtag, 1500);
    }
  }

  scheduleLoad();
})();
