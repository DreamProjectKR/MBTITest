/**
 * Local dev only: remove noisy image preloads (see index.html).
 * Kept as an external file so strict CSP (no inline scripts) can still be used.
 */
(function () {
  var h = typeof location !== "undefined" && location.hostname;
  if (h === "localhost" || h === "127.0.0.1") {
    document
      .querySelectorAll('link[rel="preload"][data-skip-local="true"]')
      .forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
  }
})();
