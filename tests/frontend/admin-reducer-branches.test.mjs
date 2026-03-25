import assert from "node:assert/strict";
import test from "node:test";

import {
  adminReducer,
  initialAdminState,
} from "../../public/scripts/admin/reducer.js";
import { createStore } from "../../public/scripts/admin/store.js";

test("SET_IS_SAVING and SET_PANEL_LOADING", () => {
  let s = adminReducer(initialAdminState, {
    type: "SET_IS_SAVING",
    value: true,
  });
  assert.equal(s.ui.isSaving, true);
  s = adminReducer(s, { type: "SET_IS_SAVING", value: false });
  assert.equal(s.ui.isSaving, false);

  s = adminReducer(s, {
    type: "SET_PANEL_LOADING",
    panelKey: "meta",
    value: true,
  });
  assert.equal(s.ui.loading.meta, true);
});

test("adminReducer default returns same structure for unknown action", () => {
  const s = adminReducer(initialAdminState, { type: "UNKNOWN" });
  assert.deepEqual(s, initialAdminState);
});

test("SYNC_TEST_META_FROM_TEST updates existing meta row", () => {
  const state = {
    ...initialAdminState,
    tests: [
      {
        id: "a",
        title: "Old",
        thumbnail: "",
        tags: [],
        path: "a/t.json",
        createdAt: "",
        updatedAt: "",
        isPublished: false,
      },
    ],
  };
  const next = adminReducer(state, {
    type: "SYNC_TEST_META_FROM_TEST",
    test: {
      id: "a",
      title: "New",
      thumbnail: "assets/t.png",
      tags: ["x"],
      path: "a/t.json",
      createdAt: "d1",
      updatedAt: "d2",
      isPublished: true,
    },
  });
  assert.equal(next.tests[0].title, "New");
  assert.equal(next.tests[0].isPublished, true);
});

test("createStore subscribe is called on dispatch", () => {
  const store = createStore(adminReducer, initialAdminState);
  let calls = 0;
  store.subscribe(() => {
    calls += 1;
  });
  store.dispatch({ type: "SET_TESTS", tests: [] });
  assert.equal(calls, 1);
  const unsub = store.subscribe(() => {});
  unsub();
});

test("createStore dispatch no-op does not notify when state unchanged", () => {
  const store = createStore(adminReducer, initialAdminState);
  let calls = 0;
  store.subscribe(() => {
    calls += 1;
  });
  store.dispatch({ type: "NOPE" });
  assert.equal(calls, 0);
});
