// src/scripts/legacy/admin.js
var API_TESTS_BASE = window.API_TESTS_BASE || "/api/tests";
var API_ADMIN_TESTS_BASE = window.API_ADMIN_TESTS_BASE || "/api/admin/tests";
var AXIS_MAP = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"]
};
var MBTI_LETTERS = ["E", "I", "S", "N", "T", "F", "J", "P"];
var MBTI_ORDER = [
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
  "ESFP"
];
var elements = {
  metaForm: document.querySelector("[data-test-meta-form]"),
  questionForm: document.querySelector("[data-question-form]"),
  questionList: document.querySelector("[data-question-list]"),
  answerDraftList: document.querySelector("[data-answer-draft-list]"),
  addDraftAnswer: document.querySelector("[data-add-draft-answer]"),
  resultForm: document.querySelector("[data-result-form]"),
  resultList: document.querySelector("[data-result-list]"),
  jsonInput: document.querySelector("[data-json-input]"),
  exportButton: document.querySelector("[data-export-json]"),
  testSelect: document.querySelector("[data-test-select]"),
  createTestButton: document.querySelector("[data-create-test]"),
  saveButton: document.querySelector("[data-save-test]"),
  saveStatus: document.querySelector("[data-save-status]"),
  resultImageCode: document.querySelector("[data-result-image-code]"),
  resultImageFile: document.querySelector("[data-result-image-file]"),
  resultImageSubmit: document.querySelector("[data-result-image-submit]"),
  resultImageFileInline: document.querySelector("[data-result-image-file-inline]"),
  questionDraftImageFile: document.querySelector("[data-question-draft-image-file]"),
  imageBrowser: document.querySelector("[data-image-browser]"),
  thumbnailFile: document.querySelector("[data-thumbnail-file]"),
  thumbnailUpload: document.querySelector("[data-thumbnail-upload]"),
  authorImageFile: document.querySelector("[data-author-image-file]"),
  authorImageUpload: document.querySelector("[data-author-image-upload]"),
  authorImagePath: document.querySelector("[data-author-image-path]"),
  thumbnailPath: document.querySelector("[data-thumbnail-path]")
};
var state = {
  tests: [],
  loadedTests: {},
  activeTestId: null,
  isSaving: false,
  saveMessage: "",
  imageList: [],
  draftAnswers: [],
  pendingQuestionImages: {},
  pendingResultImages: {}
};
var isHydratingMeta = false;
initAdmin();
async function initAdmin() {
  if (!elements.metaForm) return;
  wireStaticEvents();
  setSaveStatus("\uC800\uC7A5 \uC900\uBE44");
  setupForms();
  resetDraftAnswers();
  try {
    const payload = await fetchJson(API_TESTS_BASE);
    applyIndex(payload);
  } catch (error) {
    console.warn("\uCD08\uAE30 \uD14C\uC2A4\uD2B8 \uBAA9\uB85D \uB85C\uB529 \uC2E4\uD328", error);
    refreshActiveTest();
  }
}
function wireStaticEvents() {
  elements.jsonInput?.addEventListener("change", handleJsonUpload);
  elements.exportButton?.addEventListener("click", exportJson);
  elements.createTestButton?.addEventListener("click", createTest);
  elements.testSelect?.addEventListener("change", (event) => {
    setActiveTest(event.target.value);
  });
  elements.saveButton?.addEventListener("click", handleSaveTest);
  elements.addDraftAnswer?.addEventListener("click", () => {
    addDraftAnswer();
  });
  elements.resultImageSubmit?.addEventListener(
    "click",
    handleResultImageUpload
  );
  elements.imageBrowser?.addEventListener("click", handleImageBrowserClick);
  elements.thumbnailUpload?.addEventListener("click", handleThumbnailUpload);
  elements.authorImageUpload?.addEventListener("click", handleAuthorImageUpload);
}
function setupForms() {
  elements.metaForm?.addEventListener("input", handleMetaInput);
  elements.answerDraftList?.addEventListener("input", handleDraftAnswerInput);
  elements.answerDraftList?.addEventListener("click", handleDraftAnswerClick);
  elements.questionForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.questionForm);
    const questionLabel = String(data.get("label") || "").trim();
    const file = elements.questionDraftImageFile?.files?.[0] ?? null;
    if (!questionLabel && !file) {
      alert("\uC9C8\uBB38 \uD14D\uC2A4\uD2B8 \uB610\uB294 \uC774\uBBF8\uC9C0\uB97C \uC785\uB825/\uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    const answers = normalizeDraftAnswersForQuestion();
    if (answers.length < 2) {
      alert("\uB2F5\uBCC0\uC740 \uCD5C\uC18C 2\uAC1C\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    const question = {
      id: crypto.randomUUID?.() ?? `q-${Date.now()}`,
      label: questionLabel,
      prompt: "",
      answers
    };
    const activeTest = getActiveTest();
    if (!activeTest) return;
    activeTest.questions = activeTest.questions ?? [];
    activeTest.questions.push(question);
    if (file) {
      state.pendingQuestionImages = {
        ...state.pendingQuestionImages || {},
        [question.id]: file
      };
      if (elements.questionDraftImageFile) elements.questionDraftImageFile.value = "";
    }
    renderQuestions(activeTest.questions);
    elements.questionForm.reset();
    resetDraftAnswers();
  });
  elements.questionList?.addEventListener("click", (event) => {
    const uploadButton = event.target.closest("[data-upload-question-image]");
    if (uploadButton) {
      uploadQuestionImage(
        uploadButton.dataset.uploadQuestionImage,
        uploadButton.closest("[data-question-item]")
      );
      return;
    }
    const removeButton = event.target.closest("[data-remove-question]");
    if (removeButton) {
      removeQuestion(removeButton.dataset.removeQuestion);
      return;
    }
    const moveButton = event.target.closest("[data-move-question]");
    if (moveButton) {
      reorderQuestion(
        moveButton.dataset.questionId,
        moveButton.dataset.moveQuestion
      );
    }
  });
  elements.resultForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.resultForm);
    const code = data.get("code")?.toUpperCase();
    if (!code) return;
    const activeTest = getActiveTest();
    if (!activeTest) return;
    activeTest.results = activeTest.results ?? {};
    const existing = activeTest.results[code] ?? {};
    const summaryText = String(data.get("summary") || "").trim();
    activeTest.results[code] = {
      // Image path is set by upload button (no manual input).
      image: existing.image || "",
      summary: summaryText
    };
    const file = elements.resultImageFileInline?.files?.[0] ?? null;
    const hasSomeContent = Boolean(summaryText) || Boolean(file) || Boolean(existing.image) || Boolean(existing.summary);
    if (!hasSomeContent) {
      alert("\uACB0\uACFC \uD14D\uC2A4\uD2B8 \uB610\uB294 \uC774\uBBF8\uC9C0\uB97C \uC785\uB825/\uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    if (file) {
      state.pendingResultImages = {
        ...state.pendingResultImages || {},
        [code]: file
      };
      if (elements.resultImageFileInline) elements.resultImageFileInline.value = "";
    }
    renderResults(activeTest.results);
    elements.resultForm.reset();
  });
  elements.resultList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-result]");
    if (!removeButton) return;
    const code = removeButton.dataset.removeResult;
    const activeTest = getActiveTest();
    if (!activeTest?.results) return;
    delete activeTest.results[code];
    renderResults(activeTest.results);
  });
}
async function handleJsonUpload(event) {
  const [file] = event.target.files ?? [];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    applyPayload(json);
  } catch (error) {
    alert("JSON \uD30C\uC2F1\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
    console.error(error);
  } finally {
    event.target.value = "";
  }
}
function applyIndex(payload) {
  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  state.tests = tests.map((meta) => ({
    id: meta.id,
    title: meta.title ?? "",
    thumbnail: meta.thumbnail ?? "",
    tags: Array.isArray(meta.tags) ? [...meta.tags] : [],
    path: meta.path ?? `${meta.id}/test.json`,
    createdAt: meta.createdAt ?? "",
    updatedAt: meta.updatedAt ?? ""
  }));
  state.activeTestId = state.tests[0]?.id ?? null;
  populateTestSelector();
  if (state.activeTestId) {
    loadTest(state.activeTestId);
  } else {
    refreshActiveTest();
  }
}
function applyPayload(payload) {
  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  const normalized = tests.map((test) => {
    const id = test.id ?? `test-${(crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).slice(0, 8)}`;
    return {
      ...test,
      id
    };
  });
  state.loadedTests = normalized.reduce((acc, test) => {
    acc[test.id] = test;
    return acc;
  }, {});
  state.tests = normalized.map((test) => buildMetaFromTest(test));
  state.activeTestId = normalized[0]?.id ?? null;
  populateTestSelector();
  refreshActiveTest();
  refreshImageList(state.activeTestId);
}
function buildMetaFromTest(test) {
  const now = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return {
    id: test.id,
    title: test.title ?? "",
    thumbnail: test.thumbnail ?? "",
    tags: Array.isArray(test.tags) ? [...test.tags] : [],
    path: test.path ?? `${test.id}/test.json`,
    createdAt: test.createdAt ?? now,
    updatedAt: test.updatedAt ?? now
  };
}
function populateTestSelector() {
  if (!elements.testSelect) return;
  elements.testSelect.innerHTML = "";
  state.tests.forEach((test) => {
    const option = document.createElement("option");
    option.value = test.id;
    option.textContent = `${test.title || "\uC81C\uBAA9 \uC5C6\uB294 \uD14C\uC2A4\uD2B8"} (${test.id})`;
    if (test.id === state.activeTestId) {
      option.selected = true;
    }
    elements.testSelect.append(option);
  });
  elements.testSelect.disabled = state.tests.length === 0;
}
function refreshActiveTest() {
  const activeTest = getActiveTest();
  if (!activeTest) {
    hydrateForms(null);
    renderQuestions([]);
    renderResults({});
    return;
  }
  hydrateForms(activeTest);
  renderQuestions(activeTest.questions ?? []);
  renderResults(activeTest.results ?? {});
}
function getActiveTest() {
  const activeId = state.activeTestId;
  if (!activeId) return null;
  return state.loadedTests[activeId] ?? null;
}
function setActiveTest(testId) {
  if (!testId) return;
  state.activeTestId = testId;
  loadTest(testId);
}
async function loadTest(testId) {
  if (!testId) return;
  state.activeTestId = testId;
  refreshActiveTest();
  if (state.loadedTests[testId]) {
    await refreshImageList(testId);
    return;
  }
  try {
    const test = await fetchJson(`${API_ADMIN_TESTS_BASE}/${testId}`);
    state.loadedTests = { ...state.loadedTests, [testId]: test };
    syncMetaEntry(test);
    refreshActiveTest();
  } catch (error) {
    console.error("\uD14C\uC2A4\uD2B8 \uB85C\uB529 \uC2E4\uD328", error);
    alert("\uD14C\uC2A4\uD2B8\uB97C \uB85C\uB4DC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uCF58\uC194\uC744 \uD655\uC778\uD558\uC138\uC694.");
  } finally {
    await refreshImageList(testId);
  }
}
function syncMetaEntry(test) {
  state.tests = state.tests.map((meta) => {
    if (meta.id !== test.id) return meta;
    return {
      ...meta,
      title: test.title ?? meta.title,
      thumbnail: test.thumbnail ?? meta.thumbnail,
      tags: Array.isArray(test.tags) ? [...test.tags] : [...meta.tags]
    };
  });
  populateTestSelector();
}
function createTest() {
  const rawId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const newTest = {
    id: `test-${rawId.slice(0, 8)}`,
    title: "\uC0C8 \uD14C\uC2A4\uD2B8",
    type: "mbti",
    description: "",
    tags: [],
    author: "",
    authorImg: "",
    thumbnail: "",
    questions: [],
    results: {}
  };
  state.loadedTests = { ...state.loadedTests, [newTest.id]: newTest };
  state.tests = [...state.tests, buildMetaFromTest(newTest)];
  state.activeTestId = newTest.id;
  populateTestSelector();
  refreshActiveTest();
  refreshImageList(newTest.id);
}
function hydrateForms(test) {
  if (!elements.metaForm) return;
  const form = elements.metaForm;
  isHydratingMeta = true;
  if (form.elements["type"]) {
    form.elements["type"].value = test?.type ?? "mbti";
  }
  form.elements["title"].value = test?.title ?? "";
  form.elements["description"].value = formatDescriptionForInput(
    test?.description
  );
  form.elements["tags"].value = (Array.isArray(test?.tags) ? test.tags : []).join(", ");
  if (form.elements["author"]) {
    form.elements["author"].value = test?.author ?? "";
  }
  if (elements.authorImagePath) {
    elements.authorImagePath.textContent = test?.authorImg ? `\uD604\uC7AC: ${test.authorImg}` : "\uC5C5\uB85C\uB4DC\uD558\uBA74 D1\uC5D0 \uC790\uB3D9 \uC800\uC7A5\uB429\uB2C8\uB2E4.";
  }
  if (elements.thumbnailPath) {
    elements.thumbnailPath.textContent = test?.thumbnail ? `\uD604\uC7AC: ${test.thumbnail}` : "\uC5C5\uB85C\uB4DC\uD558\uBA74 D1\uC5D0 \uC790\uB3D9 \uC800\uC7A5\uB429\uB2C8\uB2E4.";
  }
  isHydratingMeta = false;
}
function formatDescriptionForInput(description) {
  if (Array.isArray(description)) {
    return description.join("\n");
  }
  return description ?? "";
}
function parseDescriptionInput(value) {
  if (!value) return "";
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "";
  return lines.length === 1 ? lines[0] : lines;
}
function handleMetaInput() {
  if (isHydratingMeta) return;
  const activeTest = getActiveTest();
  if (!activeTest) return;
  const form = elements.metaForm;
  if (form.elements["type"]) {
    activeTest.type = form.elements["type"].value || "mbti";
  }
  activeTest.title = form.elements["title"].value;
  activeTest.description = parseDescriptionInput(
    form.elements["description"].value
  );
  activeTest.tags = form.elements["tags"].value.split(",").map((tag) => tag.trim()).filter(Boolean);
  if (form.elements["author"]) {
    activeTest.author = form.elements["author"].value;
  }
  syncMetaEntry(activeTest);
}
async function handleSaveTest() {
  const testId = state.activeTestId;
  const test = getActiveTest();
  if (!testId || !test) return;
  setSavingState(true);
  try {
    const payloadForSave = normalizeTestForSave(test);
    const response = await fetch(`${API_ADMIN_TESTS_BASE}/${testId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadForSave)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "\uC800\uC7A5 \uC2E4\uD328");
    state.loadedTests[testId] = payload.test;
    syncMetaEntry(payload.test);
    refreshActiveTest();
    await flushPendingUploads(testId);
    setSaveStatus("\uC800\uC7A5 \uC644\uB8CC");
  } catch (error) {
    setSaveStatus(error.message || "\uC800\uC7A5 \uC2E4\uD328", true);
  } finally {
    setSavingState(false);
  }
}
async function flushPendingUploads(testId) {
  const activeTest = getActiveTest();
  if (!testId || !activeTest) return;
  const pendingQ = state.pendingQuestionImages || {};
  const qids = Object.keys(pendingQ);
  for (const qid of qids) {
    const file = pendingQ[qid];
    if (!file) continue;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${API_ADMIN_TESTS_BASE}/${testId}/questions/${encodeURIComponent(qid)}/prompt-image`,
        { method: "PUT", body: formData }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "\uC9C8\uBB38 \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328");
      const q = activeTest.questions?.find((qq) => qq.id === qid);
      if (q) q.prompt = body.path;
      delete pendingQ[qid];
    } catch (e) {
      console.warn("\uC9C8\uBB38 \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328", qid, e);
    }
  }
  state.pendingQuestionImages = pendingQ;
  const pendingR = state.pendingResultImages || {};
  const codes = Object.keys(pendingR);
  for (const code of codes) {
    const file = pendingR[code];
    if (!file) continue;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${API_ADMIN_TESTS_BASE}/${testId}/results/${encodeURIComponent(code)}/image`,
        { method: "PUT", body: formData }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "\uACB0\uACFC \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328");
      activeTest.results = activeTest.results ?? {};
      activeTest.results[code] = { ...activeTest.results[code] ?? {}, image: body.path };
      delete pendingR[code];
    } catch (e) {
      console.warn("\uACB0\uACFC \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328", code, e);
    }
  }
  state.pendingResultImages = pendingR;
  renderQuestions(activeTest.questions ?? []);
  renderResults(activeTest.results ?? {});
}
function setSavingState(isSaving) {
  state.isSaving = isSaving;
  if (elements.saveButton) {
    elements.saveButton.disabled = isSaving || !state.activeTestId;
  }
  if (isSaving) {
    setSaveStatus("\uC800\uC7A5 \uC911\u2026");
  } else if (!state.saveMessage) {
    setSaveStatus("\uC800\uC7A5 \uC900\uBE44");
  }
}
function setSaveStatus(message, isError = false) {
  state.saveMessage = message;
  if (!elements.saveStatus) return;
  elements.saveStatus.textContent = message;
  elements.saveStatus.classList.toggle("save-status--error", isError);
}
async function handleResultImageUpload() {
  const testId = state.activeTestId;
  const code = elements.resultImageCode?.value?.toUpperCase().trim();
  const file = elements.resultImageFile?.files?.[0];
  if (!testId || !code || !file) {
    alert("MBTI \uCF54\uB4DC\uC640 \uC774\uBBF8\uC9C0 \uD30C\uC77C\uC744 \uBAA8\uB450 \uC785\uB825\uD558\uC138\uC694.");
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch(
      `${API_ADMIN_TESTS_BASE}/${testId}/results/${code}/image`,
      { method: "PUT", body: formData }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "\uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328");
    const activeTest = getActiveTest();
    if (activeTest) {
      activeTest.results = activeTest.results ?? {};
      activeTest.results[code] = {
        ...activeTest.results[code] ?? {},
        image: body.path
      };
      renderResults(activeTest.results);
    }
    elements.resultImageFile.value = "";
    await refreshImageList(testId);
  } catch (error) {
    alert(error.message || "\uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328");
  }
}
async function handleThumbnailUpload() {
  const testId = state.activeTestId;
  const file = elements.thumbnailFile?.files?.[0];
  if (!testId || !file) {
    alert("\uC378\uB124\uC77C \uD30C\uC77C\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch(`${API_ADMIN_TESTS_BASE}/${testId}/thumbnail`, {
      method: "PUT",
      body: formData
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "\uC378\uB124\uC77C \uC5C5\uB85C\uB4DC \uC2E4\uD328");
    const activeTest = getActiveTest();
    if (activeTest) {
      activeTest.thumbnail = body.path;
      syncMetaEntry(activeTest);
      refreshActiveTest();
    }
    if (elements.thumbnailFile) elements.thumbnailFile.value = "";
  } catch (error) {
    alert(error.message || "\uC378\uB124\uC77C \uC5C5\uB85C\uB4DC \uC2E4\uD328");
  }
}
async function handleAuthorImageUpload() {
  const testId = state.activeTestId;
  const file = elements.authorImageFile?.files?.[0];
  if (!testId || !file) {
    alert("\uC791\uC131\uC790 \uC774\uBBF8\uC9C0 \uD30C\uC77C\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch(
      `${API_ADMIN_TESTS_BASE}/${testId}/author-image`,
      { method: "PUT", body: formData }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "\uC791\uC131\uC790 \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328");
    const activeTest = getActiveTest();
    if (activeTest) {
      activeTest.authorImg = body.path;
      syncMetaEntry(activeTest);
      refreshActiveTest();
    }
    if (elements.authorImageFile) elements.authorImageFile.value = "";
  } catch (error) {
    alert(error.message || "\uC791\uC131\uC790 \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328");
  }
}
async function uploadQuestionImage(questionId, questionItemEl) {
  const testId = state.activeTestId;
  if (!testId || !questionId || !questionItemEl) return;
  const file = questionItemEl.querySelector("[data-question-image-file]")?.files?.[0];
  if (!file) {
    alert("\uC9C8\uBB38 \uC774\uBBF8\uC9C0 \uD30C\uC77C\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch(
      `${API_ADMIN_TESTS_BASE}/${testId}/questions/${encodeURIComponent(questionId)}/prompt-image`,
      { method: "PUT", body: formData }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(body.error || "\uC9C8\uBB38 \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328 (\uBA3C\uC800 D1 \uC800\uC7A5 \uD544\uC694)");
    const activeTest = getActiveTest();
    if (activeTest?.questions) {
      const q = activeTest.questions.find((qq) => qq.id === questionId);
      if (q) q.prompt = body.path;
      renderQuestions(activeTest.questions);
    }
  } catch (error) {
    alert(error.message || "\uC9C8\uBB38 \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uC2E4\uD328");
  }
}
async function refreshImageList(testId) {
  if (!testId) {
    state.imageList = [];
    renderImageBrowser([]);
    return;
  }
  try {
    const response = await fetch(`${API_ADMIN_TESTS_BASE}/${testId}/images`);
    if (!response.ok) throw new Error("\uC774\uBBF8\uC9C0 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    state.imageList = items;
    renderImageBrowser(items);
  } catch (error) {
    console.error(error);
    state.imageList = [];
    renderImageBrowser([]);
  }
}
function renderImageBrowser(items = []) {
  if (!elements.imageBrowser) return;
  if (!items.length) {
    elements.imageBrowser.innerHTML = '<p class="image-browser__empty">\uC774\uBBF8\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    return;
  }
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "image-browser__item";
    button.dataset.imagePath = item.path;
    button.dataset.imageCode = extractMbtiCode(item.path);
    button.textContent = item.path;
    fragment.append(button);
  });
  elements.imageBrowser.innerHTML = "";
  elements.imageBrowser.append(fragment);
}
function handleImageBrowserClick(event) {
  const target = event.target.closest("[data-image-path]");
  if (!target) return;
  const code = target.dataset.imageCode;
  if (elements.resultImageCode && code) {
    elements.resultImageCode.value = code;
  }
}
function extractMbtiCode(path) {
  if (!path) return "";
  const fileName = path.split("/").pop() ?? "";
  const [name] = fileName.split(".");
  return (name ?? "").replace(/[^A-Z]/gi, "").toUpperCase();
}
function removeQuestion(questionId) {
  const activeTest = getActiveTest();
  if (!activeTest?.questions) return;
  activeTest.questions = activeTest.questions.filter(
    (question) => question.id !== questionId
  );
  renderQuestions(activeTest.questions);
}
function reorderQuestion(questionId, direction) {
  const activeTest = getActiveTest();
  if (!activeTest?.questions) return;
  const index = activeTest.questions.findIndex(
    (question) => question.id === questionId
  );
  if (index === -1) return;
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= activeTest.questions.length) return;
  const [item] = activeTest.questions.splice(index, 1);
  activeTest.questions.splice(targetIndex, 0, item);
  renderQuestions(activeTest.questions);
}
function renderQuestions(questions) {
  if (!elements.questionList) return;
  if (!questions.length) {
    elements.questionList.innerHTML = '<li><div class="ds-alert">\uB4F1\uB85D\uB41C \uBB38\uD56D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uC6B4 \uBB38\uD56D\uC744 \uCD94\uAC00\uD558\uC138\uC694.</div></li>';
    return;
  }
  elements.questionList.innerHTML = "";
  questions.forEach((question, index) => {
    const item = document.createElement("li");
    item.className = "ds-card ds-card--compact";
    item.dataset.questionItem = "1";
    item.dataset.questionId = question.id;
    const content = document.createElement("div");
    const title = document.createElement("strong");
    const labelText = question.label || "(\uD14D\uC2A4\uD2B8 \uC5C6\uC74C)";
    const imgText = question.prompt ? ` / \uC774\uBBF8\uC9C0: ${question.prompt}` : "";
    title.textContent = `${index + 1}. ${labelText}${imgText}`;
    content.append(title);
    const chipRow = document.createElement("div");
    chipRow.className = "ds-chip-row";
    (question.answers ?? []).forEach((answer) => {
      const chip = document.createElement("span");
      chip.className = "ds-chip";
      const label = document.createElement("span");
      label.textContent = answer.label ?? answer.answer ?? "";
      const detail = document.createElement("small");
      const axis = String(answer.mbtiAxis || "").toUpperCase();
      const resolved = resolveMbtiAxisDir(axis, answer.mbtiDir, answer.direction);
      const delta = resolved.mbtiDir === "minus" ? -1 : 1;
      const letter = resolved.letter || "";
      detail.textContent = axis ? `${letter} (${axis} ${resolved.mbtiDir}) (\u0394 ${delta})` : "";
      chip.append(label, detail);
      chipRow.append(chip);
    });
    content.append(chipRow);
    item.append(content);
    const imageControls = document.createElement("div");
    imageControls.className = "admin-upload-row";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.setAttribute("data-question-image-file", "");
    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "ds-button ds-button--secondary ds-button--small";
    uploadBtn.textContent = "\uC9C8\uBB38 \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC";
    uploadBtn.dataset.uploadQuestionImage = question.id;
    const hint = document.createElement("small");
    hint.className = "form-hint";
    hint.textContent = "\uC5C5\uB85C\uB4DC\uD558\uBA74 D1\uC5D0 \uC790\uB3D9 \uC800\uC7A5\uB429\uB2C8\uB2E4. (\uBA3C\uC800 D1 \uC800\uC7A5 \uD544\uC694)";
    imageControls.append(fileInput, uploadBtn);
    content.append(imageControls, hint);
    const controls = document.createElement("div");
    controls.className = "question-item__controls";
    controls.append(
      createQuestionControlButton("\uC704\uB85C", "up", question.id),
      createQuestionControlButton("\uC544\uB798\uB85C", "down", question.id),
      createRemoveQuestionButton(question.id)
    );
    item.append(controls);
    elements.questionList.append(item);
  });
}
function renderResults(results = {}) {
  if (!elements.resultList) return;
  const entries = MBTI_ORDER.filter((code) => Boolean(results[code])).map(
    (code) => [code, results[code]]
  );
  if (!entries.length) {
    elements.resultList.innerHTML = '<li><div class="ds-alert">\uB4F1\uB85D\uB41C \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. 16\uAC1C MBTI\uB97C \uBAA8\uB450 \uCC44\uC6CC\uC8FC\uC138\uC694.</div></li>';
    return;
  }
  elements.resultList.innerHTML = "";
  entries.forEach(([code, detail]) => {
    const item = document.createElement("li");
    item.className = "ds-card ds-card--compact";
    const badge = document.createElement("div");
    badge.className = "ds-badge";
    const media = document.createElement("div");
    media.className = "ds-badge__media";
    const img = document.createElement("img");
    img.src = window.assetUrl ? window.assetUrl(detail.image) : detail.image;
    img.alt = `${code} \uC774\uBBF8\uC9C0`;
    img.loading = "lazy";
    media.append(img);
    badge.append(media);
    const textWrap = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = code;
    const summary = document.createElement("p");
    summary.textContent = detail.summary;
    textWrap.append(strong, summary);
    badge.append(textWrap);
    const controls = document.createElement("div");
    controls.className = "result-item__controls";
    const removeBtn = document.createElement("button");
    removeBtn.className = "ds-button ds-button--ghost ds-button--small";
    removeBtn.type = "button";
    removeBtn.textContent = "\uC0AD\uC81C";
    removeBtn.dataset.removeResult = code;
    controls.append(removeBtn);
    item.append(badge, controls);
    elements.resultList.append(item);
  });
}
function createQuestionControlButton(label, direction, questionId) {
  const button = document.createElement("button");
  button.className = "ds-button ds-button--ghost ds-button--small";
  button.type = "button";
  button.textContent = label;
  button.dataset.moveQuestion = direction;
  button.dataset.questionId = questionId;
  return button;
}
function createRemoveQuestionButton(questionId) {
  const button = document.createElement("button");
  button.className = "ds-button ds-button--ghost ds-button--small";
  button.type = "button";
  button.textContent = "\uC0AD\uC81C";
  button.dataset.removeQuestion = questionId;
  return button;
}
function resetDraftAnswers() {
  state.draftAnswers = [createEmptyDraftAnswer(), createEmptyDraftAnswer()];
  renderDraftAnswers();
}
function addDraftAnswer() {
  state.draftAnswers = [...state.draftAnswers || [], createEmptyDraftAnswer()];
  renderDraftAnswers();
}
function createEmptyDraftAnswer() {
  return {
    id: crypto.randomUUID?.() ?? `a-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: "",
    mbtiLetter: "E"
  };
}
function renderDraftAnswers() {
  if (!elements.answerDraftList) return;
  const list = Array.isArray(state.draftAnswers) ? state.draftAnswers : [];
  elements.answerDraftList.innerHTML = "";
  list.forEach((a, idx) => {
    const row = document.createElement("div");
    row.className = "answer-row";
    row.dataset.draftAnswerId = a.id;
    row.innerHTML = `
      <div class="answer-row__grid">
        <label class="form-field">
          <span>\uB2F5\uBCC0 ${idx + 1}</span>
          <input type="text" value="${escapeHtml(a.label || "")}" data-draft-field="label" />
        </label>
        <label class="form-field">
          <span>MBTI \uBB38\uC790</span>
          <select data-draft-field="mbtiLetter">
            ${MBTI_LETTERS.map((l) => `<option value="${l}" ${String(a.mbtiLetter || "E").toUpperCase() === l ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </label>
        <button class="ds-button ds-button--ghost ds-button--small" type="button" data-remove-draft-answer="${a.id}">
          \uC0AD\uC81C
        </button>
      </div>
      <small class="form-hint">${renderMbtiDeltaHint(a)}</small>
    `;
    elements.answerDraftList.append(row);
  });
}
function renderMbtiDeltaHint(a) {
  const letter = String(a?.mbtiLetter || "E").toUpperCase();
  const resolved = resolveMbtiAxisDir("", "", letter);
  const axis = resolved.axis;
  const dir = resolved.mbtiDir;
  const delta = dir === "minus" ? -1 : 1;
  if (!axis) return "";
  return `\uC800\uC7A5 \uC2DC: ${letter} \u2192 ${axis} \u0394 ${delta} (mbti_answer_effects.delta)`;
}
function normalizeDraftAnswersForQuestion() {
  const list = Array.isArray(state.draftAnswers) ? state.draftAnswers : [];
  return list.map((a) => ({
    id: a.id,
    label: String(a.label || "").trim(),
    ...deriveMbtiAxisDirFromLetter(String(a.mbtiLetter || "E")),
    weight: 1
  })).filter((a) => a.label.length > 0);
}
function handleDraftAnswerInput(event) {
  const row = event.target.closest("[data-draft-answer-id]");
  if (!row) return;
  const id = row.dataset.draftAnswerId;
  const field = event.target.dataset.draftField;
  if (!id || !field) return;
  const list = Array.isArray(state.draftAnswers) ? [...state.draftAnswers] : [];
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const next = { ...list[idx] };
  next[field] = event.target.value;
  list[idx] = next;
  state.draftAnswers = list;
  renderDraftAnswers();
}
function handleDraftAnswerClick(event) {
  const remove = event.target.closest("[data-remove-draft-answer]");
  if (!remove) return;
  const id = remove.dataset.removeDraftAnswer;
  const list = Array.isArray(state.draftAnswers) ? state.draftAnswers : [];
  state.draftAnswers = list.filter((a) => a.id !== id);
  renderDraftAnswers();
}
function escapeHtml(text) {
  return String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error("JSON \uC694\uCCAD \uC2E4\uD328");
    }
    return response.json();
  });
}
function exportJson() {
  const tests = Object.values(state.loadedTests).map(toLegacyExportTest);
  const exportPayload = { tests };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mbti-tests.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
function toLegacyExportTest(test) {
  const out = { ...test };
  out.questions = Array.isArray(test?.questions) ? test.questions.map(toLegacyExportQuestion) : [];
  return out;
}
function toLegacyExportQuestion(q) {
  const out = { ...q };
  out.answers = Array.isArray(q?.answers) ? q.answers.map(toLegacyExportAnswer) : [];
  return out;
}
function toLegacyExportAnswer(a) {
  const axis = String(a?.mbtiAxis || "").trim().toUpperCase();
  const resolved = resolveMbtiAxisDir(axis, a?.mbtiDir, a?.direction);
  const direction = resolved.letter || "";
  return {
    ...a,
    mbtiAxis: axis,
    direction,
    // Keep admin-only fields out of legacy json
    mbtiDir: void 0
  };
}
function deriveMbtiAxisDirFromLetter(letterRaw) {
  const letter = String(letterRaw || "").trim().toUpperCase();
  if (letter === "E") return { mbtiAxis: "EI", mbtiDir: "plus" };
  if (letter === "I") return { mbtiAxis: "EI", mbtiDir: "minus" };
  if (letter === "S") return { mbtiAxis: "SN", mbtiDir: "plus" };
  if (letter === "N") return { mbtiAxis: "SN", mbtiDir: "minus" };
  if (letter === "T") return { mbtiAxis: "TF", mbtiDir: "plus" };
  if (letter === "F") return { mbtiAxis: "TF", mbtiDir: "minus" };
  if (letter === "J") return { mbtiAxis: "JP", mbtiDir: "plus" };
  if (letter === "P") return { mbtiAxis: "JP", mbtiDir: "minus" };
  return { mbtiAxis: "", mbtiDir: "plus" };
}
function resolveMbtiAxisDir(axisRaw, mbtiDirRaw, directionRaw) {
  const axis = String(axisRaw || "").trim().toUpperCase();
  const dirNorm = String(mbtiDirRaw || "").trim().toLowerCase();
  const direction = String(directionRaw || "").trim().toUpperCase();
  if (axis && (dirNorm === "plus" || dirNorm === "minus")) {
    const [pos, neg] = AXIS_MAP[axis] ?? AXIS_MAP.EI;
    return { axis, mbtiDir: dirNorm, letter: dirNorm === "minus" ? neg : pos };
  }
  if (axis && direction) {
    const [pos, neg] = AXIS_MAP[axis] ?? AXIS_MAP.EI;
    const mbtiDir = direction === neg ? "minus" : "plus";
    const letter = direction === neg ? neg : pos;
    return { axis, mbtiDir, letter };
  }
  if (direction) {
    const derived = deriveMbtiAxisDirFromLetter(direction);
    return { axis: derived.mbtiAxis, mbtiDir: derived.mbtiDir, letter: direction };
  }
  return { axis: axis || "", mbtiDir: "plus", letter: "" };
}
function normalizeTestForSave(test) {
  const out = { ...test };
  out.type = out.type || "mbti";
  out.questions = Array.isArray(out.questions) ? out.questions.map((q) => {
    const qq = { ...q };
    qq.answers = Array.isArray(qq.answers) ? qq.answers.map((a) => {
      const aa = { ...a };
      const axis = String(aa.mbtiAxis || "").trim().toUpperCase();
      const resolved = resolveMbtiAxisDir(axis, aa.mbtiDir, aa.direction);
      if (resolved.axis) aa.mbtiAxis = resolved.axis;
      aa.mbtiDir = resolved.mbtiDir;
      aa.weight = Number.isFinite(Number(aa.weight)) ? Math.max(1, Math.floor(Number(aa.weight))) : 1;
      delete aa.direction;
      return aa;
    }) : [];
    return qq;
  }) : [];
  return out;
}
//# sourceMappingURL=admin.js.map
