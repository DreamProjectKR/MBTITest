/**
 * Shared header behavior: sticky header + optional mobile margin.
 * Run on pages that use partials/header.html. Reads data-header-margin on body
 * for mobile bottom margin when fixed (e.g. testlist: 45, testintro: 35).
 */
(function () {
  function whenPartialsReady(fn) {
    if (window.partialsReady) {
      fn();
    } else {
      window.addEventListener("partialsReady", fn, { once: true });
    }
  }

  whenPartialsReady(function () {
    var header = document.getElementById("header");
    var headerScroll = document.getElementById("headerScroll");
    if (!header || !headerScroll) return;
    var headerOffset = header.offsetTop;
    var marginPx = document.body.getAttribute("data-header-margin") || "0";

    window.addEventListener(
      "scroll",
      function () {
        var isMobile = window.matchMedia("(max-width: 900px)").matches;
        if (window.scrollY > headerOffset) {
          header.classList.add("fixed-header", "bg-on");
          if (isMobile && marginPx !== "0") {
            headerScroll.style.marginBottom = marginPx + "px";
          }
        } else {
          header.classList.remove("fixed-header", "bg-on");
          headerScroll.style.marginBottom = "";
        }
      },
      { passive: true },
    );
  });
})();
