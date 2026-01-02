const API_TESTS_BASE = window.API_TESTS_BASE || "/api/tests";
const API_ADMIN_TESTS_BASE = window.API_ADMIN_TESTS_BASE || "/api/admin/tests";
const AXIS_MAP = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};
const REQUIRED_QUESTION_COUNT = 12;
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
  elements.metaForm?.addEventListener("change", handleMetaFileInputs);

  // Axis-based direction selector (A=E/B=I etc.)
  elements.questionForm
    ?.querySelector('select[name="axis"]')
    ?.addEventListener("change", () => syncAnswerDirectionOptions());
  syncAnswerDirectionOptions();

  elements.questionForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const activeTest = getActiveTest();
    if (!activeTest) return;

    activeTest.questions = Array.isArray(activeTest.questions)
      ? activeTest.questions
      : [];
    if (activeTest.questions.length >= REQUIRED_QUESTION_COUNT) {
      alert(`문항은 ${REQUIRED_QUESTION_COUNT}개까지 등록할 수 있습니다.`);
      return;
    }

    const nextNo = getNextQuestionNo(activeTest.questions);
    if (!nextNo) {
      alert(`문항은 ${REQUIRED_QUESTION_COUNT}개까지 등록할 수 있습니다.`);
      return;
    }

    // Ensure the image is uploaded and the path is available before creating the question.
    uploadQuestionImageIfNeeded(activeTest, nextNo)
      .then(() => {
        const formEl = elements.questionForm;
        if (!formEl) return;
        const data = new FormData(formEl);

        const qId = `q${nextNo}`;
        const questionImage = String(data.get("questionImage") || "").trim();
        if (!questionImage) {
          alert("질문 이미지를 먼저 업로드해주세요.");
          return;
        }

        const axis = String(data.get("axis") || "EI");
        const [positive, negative] = AXIS_MAP[axis] ?? AXIS_MAP.EI;
        const pref = String(data.get("answerADirection") || "positive");
        const aDir = pref === "negative" ? negative : positive;
        const bDir = pref === "negative" ? positive : negative;

        const question = {
          id: qId,
          label: String(data.get("questionLabel") || "").trim(),
          questionImage,
          answers: [
            {
              id: `${qId}_a`,
              label: String(data.get("answerAText") || "").trim(),
              mbtiAxis: axis,
              direction: aDir,
            },
            {
              id: `${qId}_b`,
              label: String(data.get("answerBText") || "").trim(),
              mbtiAxis: axis,
              direction: bDir,
            },
          ],
        };

        activeTest.questions.push(question);
        renderQuestions(activeTest.questions);
        // Reset but keep axis/direction for faster authoring.
        const keepAxis = String(formEl.elements["axis"]?.value || "EI");
        const keepDir = String(
          formEl.elements["answerADirection"]?.value || "positive",
        );
        formEl.reset();
        if (formEl.elements["axis"]) formEl.elements["axis"].value = keepAxis;
        if (formEl.elements["answerADirection"])
          formEl.elements["answerADirection"].value = keepDir;
        syncAnswerDirectionOptions();
        // Keep the hidden readonly path empty after reset.
        formEl.elements["questionImage"].value = "";
      })
      .catch((err) => {
        alert(err?.message || "질문 이미지 업로드 실패");
      });
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
      image: activeTest.results?.[code]?.image ?? "",
      summary: data.get("summary"),
    };
    renderResults(activeTest.results);
    // Keep selected MBTI code; only clear the summary input.
    const formEl = elements.resultForm;
    if (formEl?.elements?.["summary"]) formEl.elements["summary"].value = "";
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
    author: "",
    authorImg: "",
    questions: [],
    results: MBTI_ORDER.reduce((acc, code) => {
      acc[code] = { image: "", summary: "" };
      return acc;
    }, {}),
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
  form.elements["author"].value = test?.author ?? "";
  form.elements["authorImg"].value = test?.authorImg ?? "";
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
  if (!value) return [];
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines;
}

function handleMetaInput() {
  if (isHydratingMeta) return;
  const activeTest = getActiveTest();
  if (!activeTest) return;
  const form = elements.metaForm;
  activeTest.author = form.elements["author"].value;
  activeTest.authorImg = form.elements["authorImg"].value;
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
    const err = validateTestForSave(test);
    if (err) throw new Error(err);

    const response = await fetch(`${API_ADMIN_TESTS_BASE}/${testId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(test),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "저장 실패");
    // Server returns { ok: true }. Reload the merged view from /api/tests/:id.
    await reloadActiveTest();
    setSaveStatus("저장 완료");
  } catch (error) {
    setSaveStatus(error.message || "저장 실패", true);
  } finally {
    setSavingState(false);
  }
}

async function handleMetaFileInputs(event) {
  const form = elements.metaForm;
  const activeTest = getActiveTest();
  if (!form || !activeTest) return;

  const target = event.target;
  if (!target || target.tagName !== "INPUT") return;

  if (target.name === "thumbnailFile") {
    const file = target.files?.[0];
    if (!file) return;
    try {
      setSaveStatus("썸네일 업로드 중…");
      const uploaded = await uploadTestImage(activeTest.id, file, "thumbnail");
      activeTest.thumbnail = uploaded.path;
      form.elements["thumbnail"].value = uploaded.path;
      syncMetaEntry(activeTest);
      setSaveStatus("썸네일 업로드 완료");
    } catch (err) {
      setSaveStatus(err.message || "썸네일 업로드 실패", true);
    } finally {
      target.value = "";
    }
  }

  if (target.name === "authorImgFile") {
    const file = target.files?.[0];
    if (!file) return;
    try {
      setSaveStatus("제작자 이미지 업로드 중…");
      const uploaded = await uploadTestImage(activeTest.id, file, "author");
      activeTest.authorImg = uploaded.path;
      form.elements["authorImg"].value = uploaded.path;
      syncMetaEntry(activeTest);
      setSaveStatus("제작자 이미지 업로드 완료");
    } catch (err) {
      setSaveStatus(err.message || "제작자 이미지 업로드 실패", true);
    } finally {
      target.value = "";
    }
  }
}

async function uploadTestImage(testId, file, name) {
  const formData = new FormData();
  formData.append("file", file);
  if (name) formData.append("name", name);
  const response = await fetch(`${API_ADMIN_TESTS_BASE}/${testId}/images`, {
    method: "PUT",
    body: formData,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "이미지 업로드 실패");
  if (!body?.path) throw new Error("이미지 업로드 응답이 올바르지 않습니다.");
  return body;
}

async function uploadQuestionImageIfNeeded(activeTest, nextNo) {
  const formEl = elements.questionForm;
  if (!formEl) return "";
  const fileInput = formEl.querySelector('input[name="questionImageFile"]');
  const file = fileInput?.files?.[0];
  if (!file) return "";
  const uploadName = `Q${nextNo}`;
  const uploaded = await uploadTestImage(activeTest.id, file, uploadName);
  formEl.elements["questionImage"].value = uploaded.path;
  return uploaded.path;
}

function syncAnswerDirectionOptions() {
  const formEl = elements.questionForm;
  if (!formEl) return;
  const axis = String(formEl.elements["axis"]?.value || "EI");
  const [pos, neg] = AXIS_MAP[axis] ?? AXIS_MAP.EI;
  const select = formEl.elements["answerADirection"];
  if (!select) return;

  const current = String(select.value || "positive");
  select.innerHTML = "";

  const optPos = document.createElement("option");
  optPos.value = "positive";
  optPos.textContent = `A=${pos} / B=${neg}`;
  const optNeg = document.createElement("option");
  optNeg.value = "negative";
  optNeg.textContent = `A=${neg} / B=${pos}`;

  select.append(optPos, optNeg);
  select.value = current === "negative" ? "negative" : "positive";
}

async function reloadActiveTest() {
  const testId = state.activeTestId;
  if (!testId) return;
  const test = await fetchJson(`${API_TESTS_BASE}/${testId}`);
  state.loadedTests = { ...state.loadedTests, [testId]: test };
  syncMetaEntry(test);
  refreshActiveTest();
}

function getNextQuestionNo(questions) {
  const used = new Set(
    (Array.isArray(questions) ? questions : [])
      .map((q) => String(q?.id || ""))
      .map((id) => {
        const m = /^q(\d{1,2})$/i.exec(id);
        return m ? Number(m[1]) : null;
      })
      .filter((n) => Number.isFinite(n)),
  );
  for (let i = 1; i <= REQUIRED_QUESTION_COUNT; i += 1) {
    if (!used.has(i)) return i;
  }
  return 0;
}

function validateTestForSave(test) {
  if (!test?.title || !String(test.title).trim()) return "테스트 제목이 필요합니다.";
  if (!String(test.thumbnail || "").trim()) return "썸네일 이미지를 업로드해주세요.";
  if (!String(test.authorImg || "").trim()) return "제작자 이미지를 업로드해주세요.";
  const questions = Array.isArray(test.questions) ? test.questions : [];
  if (questions.length !== REQUIRED_QUESTION_COUNT)
    return `문항은 반드시 ${REQUIRED_QUESTION_COUNT}개여야 합니다. (현재 ${questions.length}개)`;

  for (const q of questions) {
    if (!q?.label || !String(q.label).trim())
      return "모든 문항에 질문 텍스트(label)가 필요합니다.";
    if (!String(q.questionImage || "").trim())
      return "모든 문항에 질문 이미지(questionImage)가 필요합니다.";
    const answers = Array.isArray(q.answers) ? q.answers : [];
    if (answers.length !== 2) return "각 문항은 2개의 선택지가 필요합니다.";
    const axis = answers[0]?.mbtiAxis;
    if (!axis || !AXIS_MAP[axis]) return "선택지의 mbtiAxis가 올바르지 않습니다.";
    if (answers[1]?.mbtiAxis !== axis)
      return "한 문항의 두 선택지는 같은 축(mbtiAxis)을 가져야 합니다.";
    const [pos, neg] = AXIS_MAP[axis];
    const dirs = new Set([answers[0]?.direction, answers[1]?.direction]);
    if (!(dirs.has(pos) && dirs.has(neg)))
      return "한 문항의 두 선택지는 축의 두 방향(E/I, S/N, T/F, J/P)을 각각 가져야 합니다.";
    if (!String(answers[0]?.label || "").trim() || !String(answers[1]?.label || "").trim())
      return "모든 선택지에 텍스트(label)가 필요합니다.";
  }

  const results = test?.results && typeof test.results === "object" ? test.results : {};
  for (const code of MBTI_ORDER) {
    const r = results[code];
    if (!r) return `결과가 누락되었습니다: ${code}`;
    if (!String(r.summary || "").trim()) return `결과 요약(summary)이 필요합니다: ${code}`;
    if (!String(r.image || "").trim()) return `결과 이미지(image)가 필요합니다: ${code}`;
  }

  return "";
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
    const label = question.label || "";
    title.textContent = `${index + 1}. ${question.id || ""} - ${label}`;
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

    if (question.questionImage) {
      const imgPath = document.createElement("small");
      imgPath.textContent = `image: ${question.questionImage}`;
      content.append(imgPath);
    }
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

// buildAnswer() removed with legacy JSON-import question builder.

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error("JSON 요청 실패");
    }
    return response.json();
  });
}

// JSON import/export was removed:
// This admin page writes directly to R2/D1.
