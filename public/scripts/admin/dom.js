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

const panelSelectors = {
  meta: '[aria-labelledby="test-meta-heading"]',
  questions: '[aria-labelledby="question-builder-heading"]',
  results: '[aria-labelledby="result-heading"]',
};

let metaHydrating = false;

export function getPanelElement(panelKey) {
  const selector = panelSelectors[panelKey];
  return selector ? document.querySelector(selector) : null;
}

export function setMetaHydrating(next) {
  metaHydrating = Boolean(next);
}

export function isMetaHydrating() {
  return metaHydrating;
}
