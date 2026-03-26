import assert from "node:assert/strict";
import test from "node:test";
import { installMbtiConfig } from "./config-install.mjs";

import { ADMIN_MINIMAL_HTML } from "./fixtures-admin-html.mjs";
import { createBrowserEnv } from "./setup-happy-dom.mjs";

test("admin forms: meta change on non-INPUT skips image upload handler", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  installMbtiConfig(window, document);

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );
  const { bindForms } = await import("../../public/scripts/admin/forms.js");
  const { elements } = await import("../../public/scripts/admin/dom.js");

  let uploadCalls = 0;
  const store = createStore(adminReducer, {
    ...initialAdminState,
    activeTestId: "t1",
    loadedTests: {
      t1: { id: "t1", title: "T", questions: [], results: {} },
    },
  });
  const effects = createAdminEffects(store, {
    showToast: () => {},
  });
  effects.handleMetaImageUpload = async () => {
    uploadCalls += 1;
  };

  const meta = elements.metaForm;
  assert.ok(meta);
  const sel = document.createElement("select");
  sel.name = "sideChannel";
  const opt = document.createElement("option");
  opt.value = "a";
  sel.appendChild(opt);
  meta.appendChild(sel);

  bindForms({ store, effects });

  sel.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(uploadCalls, 0);
});

test("admin forms: meta change on file input with no file skips upload", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  installMbtiConfig(window, document);

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );
  const { bindForms } = await import("../../public/scripts/admin/forms.js");
  const { elements } = await import("../../public/scripts/admin/dom.js");

  let uploadCalls = 0;
  const store = createStore(adminReducer, {
    ...initialAdminState,
    activeTestId: "t1",
    loadedTests: {
      t1: { id: "t1", title: "T", questions: [], results: {} },
    },
  });
  const effects = createAdminEffects(store, {
    showToast: () => {},
  });
  effects.handleMetaImageUpload = async () => {
    uploadCalls += 1;
  };

  bindForms({ store, effects });

  const thumb = elements.metaForm?.querySelector('[name="thumbnailFile"]');
  assert.ok(thumb);
  thumb.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(uploadCalls, 0);
});
