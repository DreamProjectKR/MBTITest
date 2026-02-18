/** Constants and single source of state for admin UI. */

export const API_TESTS_BASE = window.API_TESTS_BASE || "/api/tests";
export const API_ADMIN_TESTS_BASE =
  window.API_ADMIN_TESTS_BASE || "/api/admin/tests";

export const AXIS_MAP = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

export const REQUIRED_QUESTION_COUNT = 12;

export const MBTI_ORDER = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISTP",
  "ESTJ",
  "ESTP",
  "ISFJ",
  "ISFP",
  "ESFJ",
  "ESFP",
];

export const elements = {
  metaForm: document.querySelector("[data-test-meta-form]"),
  questionForm: document.querySelector("[data-question-form]"),
  questionList: document.querySelector("[data-question-list]"),
  resultForm: document.querySelector("[data-result-form]"),
  resultList: document.querySelector("[data-result-list]"),
  testSelect: document.querySelector("[data-test-select]"),
  createTestButton: document.querySelector("[data-create-test]"),
  saveButton: document.querySelector("[data-save-test]"),
  saveStatus: document.querySelector("[data-save-status]"),
  bulkUploadButton: document.querySelector("[data-bulk-result-upload]"),
};

/** Single store; updated only via setState/updateLoadedTest/setActiveTest (FP: replace, not mutate). */
export let state = {
  tests: [],
  loadedTests: {},
  activeTestId: null,
  imageList: [],
  isSaving: false,
  saveMessage: "",
  loading: {
    meta: false,
    questions: false,
    results: false,
  },
};

/**
 * Replace top-level state immutably. Merges nested `loading` so one key doesn't wipe others.
 * Builds next in one expression (no mutation of next).
 */
export function setState(update) {
  const next = {
    ...state,
    ...update,
    ...(update.loading != null && typeof update.loading === "object" ?
      { loading: { ...state.loading, ...update.loading } }
    : {}),
  };
  state = next;
}

export function getActiveTest() {
  const activeId = state.activeTestId;
  if (!activeId) return null;
  return state.loadedTests[activeId] ?? null;
}

export function setActiveTest(testId) {
  setState({ activeTestId: testId || null });
}

/**
 * Replace loaded test immutably. Accepts either a new object or a function
 * (prev) => next. Used for FP-style updates without mutating shared refs.
 */
export function updateLoadedTest(testId, nextOrUpdater) {
  const prev = state.loadedTests[testId];
  if (prev == null) return;
  const next =
    typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
  setState({ loadedTests: { ...state.loadedTests, [testId]: next } });
}
