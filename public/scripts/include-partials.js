/**
 * Load HTML partials into elements with data-include="path/to/partial.html".
 * Resolves path relative to current page. Dispatches "partialsReady" when all are loaded.
 * @typedef {Window & { partialsReady?: boolean }} WindowWithPartials
 */
(function () {
  /** @type {WindowWithPartials} */
  const win = window;
  const base = document.baseURI || location.href;
  const placeholders = document.querySelectorAll("[data-include]");
  if (!placeholders.length) {
    win.partialsReady = true;
    win.dispatchEvent(new CustomEvent("partialsReady"));
    return;
  }
  let pending = placeholders.length;
  function done() {
    pending -= 1;
    if (pending === 0) {
      win.partialsReady = true;
      win.dispatchEvent(new CustomEvent("partialsReady"));
    }
  }
  placeholders.forEach(function (el) {
    const path = el.getAttribute("data-include");
    if (!path) {
      done();
      return;
    }
    const url = new URL(path, base).href;
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("partial " + path + " " + r.status);
        return r.text();
      })
      .then(function (html) {
        el.outerHTML = html.trim();
        done();
      })
      .catch(function (err) {
        console.error("include-partials:", err);
        done();
      });
  });
})();
