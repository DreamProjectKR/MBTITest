import { Window } from "happy-dom";

/**
 * Install browser-like globals for loading `public/scripts/*.js` under Node.
 * Each test should call `resetDom()` or create a fresh window to avoid cross-test leakage.
 */
export function createBrowserEnv(options = {}) {
  const window = new Window({
    url: options.url || "http://127.0.0.1:8788/",
    width: 1280,
    height: 720,
    ...options.window,
  });

  const define = (key, value) => {
    try {
      Object.defineProperty(globalThis, key, {
        value,
        configurable: true,
        writable: true,
      });
    } catch {
      // ignore
    }
  };

  define("window", window);
  define("document", window.document);
  define("navigator", window.navigator);
  define("location", window.location);
  define("history", window.history);
  define("localStorage", window.localStorage);
  define("sessionStorage", window.sessionStorage);
  define("HTMLElement", window.HTMLElement);
  /** Node's FormData does not accept HTMLFormElement; happy-dom's does (real browser parity). */
  define("FormData", window.FormData);
  define("CustomEvent", window.CustomEvent);
  define("Event", window.Event);
  define("Node", window.Node);
  define("MutationObserver", window.MutationObserver);

  if (!globalThis.fetch) {
    globalThis.fetch = async () => new Response("{}", { status: 404 });
  }

  if (typeof globalThis.crypto === "undefined" && globalThis.window.crypto) {
    globalThis.crypto = globalThis.window.crypto;
  }

  installMatchMedia(window);

  return window;
}

/** `testlist.js` / `testintro.js` use `(max-width: 900px)`. */
function installMatchMedia(window) {
  if (typeof window.matchMedia === "function") return;
  window.matchMedia = (query) => ({
    media: query,
    matches: false,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
}

export function dispatchDomContentLoaded(window) {
  window.document.dispatchEvent(
    new window.Event("DOMContentLoaded", { bubbles: true }),
  );
}
