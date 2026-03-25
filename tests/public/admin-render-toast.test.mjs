import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserEnv } from "./setup-happy-dom.mjs";

createBrowserEnv();
document.body.innerHTML = "<div></div>";

const render = await import("../../public/scripts/admin/render.js");

test("showToast appends message and ensureToastRoot creates root", () => {
  document.body.innerHTML = "";
  render.showToast("hello", false);
  const root = document.querySelector(".admin-toast-root");
  assert.ok(root);
  assert.ok(root.textContent?.includes("hello"));

  render.showToast("oops", true);
  const items = root.querySelectorAll(".admin-toast");
  assert.ok(items.length >= 2);
  assert.ok(
    [...items].some((el) => el.className.includes("admin-toast--error")),
  );
});
