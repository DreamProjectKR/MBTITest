import assert from "node:assert/strict";
import test from "node:test";

import {
  adminReducer,
  initialAdminState,
} from "../../public/scripts/admin/reducer.js";
import {
  getActiveTest,
  shouldHydrateMeta,
} from "../../public/scripts/admin/selectors.js";

test("admin reducer stores added test and selects it", () => {
  const testPayload = {
    id: "test-a",
    title: "Test A",
    questions: [],
    results: {},
  };
  const next = adminReducer(initialAdminState, {
    type: "ADD_TEST",
    test: testPayload,
    meta: {
      id: "test-a",
      title: "Test A",
      thumbnail: "",
      tags: [],
      path: "test-a/test.json",
      createdAt: "2026-03-07",
      updatedAt: "2026-03-07",
      isPublished: false,
    },
  });

  assert.equal(next.activeTestId, "test-a");
  assert.equal(getActiveTest(next).id, "test-a");
  assert.equal(next.ui.metaHydrationKey, 1);
});

test("meta hydration selector reacts to active test changes", () => {
  const previousState = {
    ...initialAdminState,
    activeTestId: "test-a",
    ui: { ...initialAdminState.ui, metaHydrationKey: 0 },
  };
  const nextState = {
    ...previousState,
    activeTestId: "test-b",
  };

  assert.equal(shouldHydrateMeta(nextState, previousState), true);
});
