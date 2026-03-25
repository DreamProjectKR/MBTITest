import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_MINIMAL_HTML } from "./fixtures-admin-html.mjs";
import { createBrowserEnv } from "./setup-happy-dom.mjs";

test("dom helpers after HTML injection", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  const dom = await import("../../public/scripts/admin/dom.js");

  assert.equal(
    dom.getPanelElement("meta")?.getAttribute("aria-labelledby"),
    "test-meta-heading",
  );
  assert.ok(dom.getPanelElement("meta")?.querySelector("h2"));
  assert.equal(dom.getPanelElement("nope"), null);

  dom.setMetaHydrating(true);
  assert.equal(dom.isMetaHydrating(), true);
  dom.setMetaHydrating(false);
  assert.equal(dom.isMetaHydrating(), false);
});
