const API_TESTS_BASE = window.API_TESTS_BASE || "/api/tests";
const API_ADMIN_TESTS_BASE = window.API_ADMIN_TESTS_BASE || "/api/admin/tests";
const AXIS_MAP = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};
const MBTI_ORDER = [
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

const elements = {
  metaForm: document.querySelector("[data-test-meta-form]"),
  questionForm: document.querySelector("[data-question-form]"),
  questionList: document.querySelector("[data-question-list]"),
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
  imageBrowser: document.querySelector("[data-image-browser]"),
};

const state = {
  tests: [],
  loadedTests: {},
  activeTestId: null,
  isSaving: false,
  saveMessage: "",
  imageList: [],
};

let isHydratingMeta = false;

initAdmin();

async function initAdmin() {
  if (!elements.metaForm) return;

  wireStaticEvents();
  setSaveStatus("저장 준비");
  setupForms();

  try {
    const payload = await fetchJson(API_TESTS_BASE);
    applyIndex(payload);
  } catch (error) {
    console.warn("초기 테스트 목록 로딩 실패", error);
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
  elements.resultImageSubmit?.addEventListener(
    "click",
    handleResultImageUpload,
  );
  elements.imageBrowser?.addEventListener("click", handleImageBrowserClick);
}

function setupForms() {
  elements.metaForm?.addEventListener("input", handleMetaInput);

  elements.questionForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.questionForm);
    const question = {
      id: crypto.randomUUID?.() ?? `q-${Date.now()}`,
      prompt: data.get("prompt")?.trim() ?? "",
      answers: [buildAnswer("answerA", data), buildAnswer("answerB", data)],
    };

    const activeTest = getActiveTest();
    if (!activeTest) return;
    activeTest.questions = activeTest.questions ?? [];
    activeTest.questions.push(question);
    renderQuestions(activeTest.questions);
    elements.questionForm.reset();
  });

  elements.questionList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-question]");
    if (removeButton) {
      removeQuestion(removeButton.dataset.removeQuestion);
      return;
    }

    const moveButton = event.target.closest("[data-move-question]");
    if (moveButton) {
      reorderQuestion(
        moveButton.dataset.questionId,
        moveButton.dataset.moveQuestion,
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
    activeTest.results[code] = {
      image: data.get("image"),
      summary: data.get("summary"),
    };
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
    alert("JSON 파싱에 실패했습니다.");
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
    updatedAt: meta.updatedAt ?? "",
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
    const id =
      test.id ??
      `test-${(crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now())
      ).slice(0, 8)}`;
    return {
      ...test,
      id,
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
  const now = new Date().toISOString().split("T")[0];
  return {
    id: test.id,
    title: test.title ?? "",
    thumbnail: test.thumbnail ?? "",
    tags: Array.isArray(test.tags) ? [...test.tags] : [],
    path: test.path ?? `${test.id}/test.json`,
    createdAt: test.createdAt ?? now,
    updatedAt: test.updatedAt ?? now,
  };
}

function populateTestSelector() {
  if (!elements.testSelect) return;
  elements.testSelect.innerHTML = "";
  state.tests.forEach((test) => {
    const option = document.createElement("option");
    option.value = test.id;
    option.textContent = `${test.title || "제목 없는 테스트"} (${test.id})`;
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
    const test = await fetchJson(`${API_TESTS_BASE}/${testId}`);
    state.loadedTests = { ...state.loadedTests, [testId]: test };
    syncMetaEntry(test);
    refreshActiveTest();
  } catch (error) {
    console.error("테스트 로딩 실패", error);
    alert("테스트를 로드하지 못했습니다. 콘솔을 확인하세요.");
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
      tags: Array.isArray(test.tags) ? [...test.tags] : [...meta.tags],
    };
  });
  populateTestSelector();
}

function createTest() {
  const rawId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const newTest = {
    id: `test-${rawId.slice(0, 8)}`,
    title: "새 테스트",
    description: "",
    tags: [],
    thumbnail: "",
    questions: [],
    results: {},
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
  form.elements["title"].value = test?.title ?? "";
  form.elements["description"].value = formatDescriptionForInput(
    test?.description,
  );
  form.elements["tags"].value = (
    Array.isArray(test?.tags) ? test.tags : []
  ).join(", ");
  form.elements["thumbnail"].value = test?.thumbnail ?? "";
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
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  return lines.length === 1 ? lines[0] : lines;
}

function handleMetaInput() {
  if (isHydratingMeta) return;
  const activeTest = getActiveTest();
  if (!activeTest) return;
  const form = elements.metaForm;
  activeTest.title = form.elements["title"].value;
  activeTest.description = parseDescriptionInput(
    form.elements["description"].value,
  );
  activeTest.tags = form.elements["tags"].value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  activeTest.thumbnail = form.elements["thumbnail"].value;
  syncMetaEntry(activeTest);
}

async function handleSaveTest() {
  const testId = state.activeTestId;
  const test = getActiveTest();
  if (!testId || !test) return;

  setSavingState(true);
  try {
    const response = await fetch(`${API_ADMIN_TESTS_BASE}/${testId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(test),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "저장 실패");
    state.loadedTests[testId] = payload.test;
    syncMetaEntry(payload.test);
    refreshActiveTest();
    setSaveStatus("저장 완료");
  } catch (error) {
    setSaveStatus(error.message || "저장 실패", true);
  } finally {
    setSavingState(false);
  }
}

function setSavingState(isSaving) {
  state.isSaving = isSaving;
  if (elements.saveButton) {
    elements.saveButton.disabled = isSaving || !state.activeTestId;
  }
  if (isSaving) {
    setSaveStatus("저장 중…");
  } else if (!state.saveMessage) {
    setSaveStatus("저장 준비");
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
    alert("MBTI 코드와 이미지 파일을 모두 입력하세요.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(
      `${API_ADMIN_TESTS_BASE}/${testId}/results/${code}/image`,
      { method: "PUT", body: formData },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "이미지 업로드 실패");

    const activeTest = getActiveTest();
    if (activeTest) {
      activeTest.results = activeTest.results ?? {};
      activeTest.results[code] = {
        ...(activeTest.results[code] ?? {}),
        image: body.path,
      };
      renderResults(activeTest.results);
    }
    elements.resultImageFile.value = "";
    await refreshImageList(testId);
  } catch (error) {
    alert(error.message || "이미지 업로드 실패");
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
    if (!response.ok) throw new Error("이미지 목록을 불러올 수 없습니다.");
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
    elements.imageBrowser.innerHTML =
      '<p class="image-browser__empty">이미지가 없습니다.</p>';
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
    (question) => question.id !== questionId,
  );
  renderQuestions(activeTest.questions);
}

function reorderQuestion(questionId, direction) {
  const activeTest = getActiveTest();
  if (!activeTest?.questions) return;
  const index = activeTest.questions.findIndex(
    (question) => question.id === questionId,
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
    elements.questionList.innerHTML =
      '<li><div class="ds-alert">등록된 문항이 없습니다. 새로운 문항을 추가하세요.</div></li>';
    return;
  }

  elements.questionList.innerHTML = "";
  questions.forEach((question, index) => {
    const item = document.createElement("li");
    item.className = "ds-card ds-card--compact";

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${index + 1}. ${question.prompt}`;
    content.append(title);

    const chipRow = document.createElement("div");
    chipRow.className = "ds-chip-row";
    (question.answers ?? []).forEach((answer) => {
      const chip = document.createElement("span");
      chip.className = "ds-chip";
      const label = document.createElement("span");
      label.textContent = answer.label;
      const detail = document.createElement("small");
      detail.textContent = `${answer.mbtiAxis} → ${answer.direction}`;
      chip.append(label, detail);
      chipRow.append(chip);
    });
    content.append(chipRow);
    item.append(content);

    const controls = document.createElement("div");
    controls.className = "question-item__controls";
    controls.append(
      createQuestionControlButton("위로", "up", question.id),
      createQuestionControlButton("아래로", "down", question.id),
      createRemoveQuestionButton(question.id),
    );
    item.append(controls);

    elements.questionList.append(item);
  });
}

function renderResults(results = {}) {
  if (!elements.resultList) return;
  const entries = MBTI_ORDER.filter((code) => Boolean(results[code])).map(
    (code) => [code, results[code]],
  );

  if (!entries.length) {
    elements.resultList.innerHTML =
      '<li><div class="ds-alert">등록된 결과가 없습니다. 16개 MBTI를 모두 채워주세요.</div></li>';
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
    img.src = detail.image;
    img.alt = `${code} 이미지`;
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
    removeBtn.textContent = "삭제";
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
  button.textContent = "삭제";
  button.dataset.removeQuestion = questionId;
  return button;
}

function buildAnswer(prefix, data) {
  const axis = data.get(`${prefix}Mbti`) || "EI";
  const directionPref = data.get(`${prefix}Pole`) || "positive";
  const [positive, negative] = AXIS_MAP[axis] ?? AXIS_MAP.EI;
  return {
    id: crypto.randomUUID?.() ?? `${prefix}-${Date.now()}`,
    label: data.get(`${prefix}Text`),
    mbtiAxis: axis,
    direction: directionPref === "positive" ? positive : negative,
  };
}

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error("JSON 요청 실패");
    }
    return response.json();
  });
}

function exportJson() {
  const tests = Object.values(state.loadedTests);
  const exportPayload = { tests };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mbti-tests.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
