/**
 * Loads HTML partials into elements that have data-include and data-include-src.
 * Runs after DOM is ready; calls window.applyAssetAttributes on injected nodes if available.
 */
(function () {
  function loadPartials() {
    var nodes = document.querySelectorAll("[data-include][data-include-src]");
    nodes.forEach(function (el) {
      var src = el.getAttribute("data-include-src");
      if (!src) return;
      var url = new URL(src, document.baseURI || window.location.href).href;
      fetch(url)
        .then(function (res) {
          return res.ok ?
              res.text()
            : Promise.reject(new Error(res.statusText));
        })
        .then(function (html) {
          el.innerHTML = html;
          if (typeof window.applyAssetAttributes === "function") {
            window.applyAssetAttributes(el);
          }
        })
        .catch(function (err) {
          console.warn("layout.js: failed to load partial " + src, err);
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPartials);
  } else {
    loadPartials();
  }
})();
