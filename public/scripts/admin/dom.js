/** Re-query on access so admin boot works after DOM swap (tests, late HTML). */
export const elements = {
  get metaForm() {
    return document.querySelector("[data-test-meta-form]");
  },
  get questionForm() {
    return document.querySelector("[data-question-form]");
  },
  get questionList() {
    return document.querySelector("[data-question-list]");
  },
  get resultForm() {
    return document.querySelector("[data-result-form]");
  },
  get resultList() {
    return document.querySelector("[data-result-list]");
  },
  get testSelect() {
    return document.querySelector("[data-test-select]");
  },
  get createTestButton() {
    return document.querySelector("[data-create-test]");
  },
  get saveButton() {
    return document.querySelector("[data-save-test]");
  },
  get saveStatus() {
    return document.querySelector("[data-save-status]");
  },
  get bulkUploadButton() {
    return document.querySelector("[data-bulk-result-upload]");
  },
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
