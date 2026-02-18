import { initAdmin } from "./admin/main.js";
import { refreshElements } from "./admin/state.js";

function whenPartialsReady(fn) {
  if (window.partialsReady) {
    fn();
  } else {
    window.addEventListener("partialsReady", fn, { once: true });
  }
}

whenPartialsReady(function () {
  refreshElements();
  initAdmin();
});
