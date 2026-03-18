/**
 * Google Analytics 4 (gtag).
 *
 * Chrome DevTools → Issues often reports:
 * - Protected Audience API deprecated
 * - Shared Storage API deprecated
 * - StorageType.persistent deprecated
 *
 * Those originate inside **Google’s gtag.js** (feature detection / ads paths),
 * not in MBTI ZOO app code. DevTools may attribute them to `main.js:1` because
 * the page’s module script is listed as a vague “source.”
 *
 * Mitigations implemented here:
 * 1. **localhost / 127.0.0.1 / [::1]**: do not load `googletagmanager.com/gtag/js`
 *    → no GA-related deprecation noise during local DevTools work.
 * 2. **Production**: `allow_google_signals` / `allow_ad_personalization_signals`
 *    disabled to avoid ads personalization paths where possible.
 * 3. **Debug**: add `?no_gtag=1` to skip loading gtag on any host.
 *
 * To remove production warnings entirely, switch to analytics that does not use
 * Privacy Sandbox APIs (e.g. Cloudflare Web Analytics) or wait for Google to
 * ship an updated gtag.
 */
(function () {
  const GA_ID = "G-WGNTDN4MYS";
  const host =
    typeof location !== "undefined" && location.hostname ?
      location.hostname
    : "";
  const isLocalDev =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  const skipByQuery =
    typeof location !== "undefined" &&
    /(?:^|[?&])no_gtag=1(?:&|$)/.test(location.search);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  window.gtag = gtag;

  if (isLocalDev || skipByQuery) {
    return;
  }

  gtag("js", new Date());
  gtag("config", GA_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  function loadGtag() {
    if (window.__gtagLoaded) return;
    window.__gtagLoaded = true;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function run() {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => loadGtag(), { timeout: 3000 });
    } else {
      setTimeout(loadGtag, 1500);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
