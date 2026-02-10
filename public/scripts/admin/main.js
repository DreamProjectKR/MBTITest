import {
  fetchImageList,
  fetchTestDetail,
  fetchTestsIndex,
  saveTest,
  uploadResultImage,
  uploadTestImage,
} from "./api.js";
import { bindForms } from "./forms.js";
import {
  hydrateForms,
  populateTestSelector,
  refreshActiveView,
  renderQuestions,
  renderResults,
  setPanelLoading,
  setSaveStatus,
  setSavingState,
  showToast,
} from "./render.js";
import {
  MBTI_ORDER,
  REQUIRED_QUESTION_COUNT,
  elements,
  setActiveTest,
  state,
} from "./state.js";
import {
  findByBaseName,
  normalizeAssetsPath,
  validateTestForSave,
} from "./validation.js";

let isHydratingMeta = false;

function getActiveTest() {
  const id = state.activeTestId;
  if (!id) return null;
  return state.loadedTests[id] ?? null;
}

function setMetaHydratingFlag(next) {
  if (typeof next === "boolean") {
    isHydratingMeta = next;
    return isHydratingMeta;
  }
  return isHydratingMeta;
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
    isPublished: Boolean(test.isPublished),
  };
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

function hydrateMetaForm(test) {
  setMetaHydratingFlag(true);
  hydrateForms(test);
  setMetaHydratingFlag(false);
}

async function refreshImageList(testId) {
  if (!testId) {
    state.imageList = [];
    return;
  }
  try {
    const data = await fetchImageList(testId);
    const items = Array.isArray(data?.items) ? data.items : [];
    state.imageList = items;
    syncImagesToActiveTestFromStore(items);
  } catch (err) {
    state.imageList = [];
  }
}

function syncImagesToActiveTestFromStore(items = []) {
  const active = getActiveTest();
  if (!active || !elements.metaForm) return;

  const thumb = findByBaseName(items, "thumbnail");
  if (thumb?.path) {
    const v = normalizeAssetsPath(thumb.path);
    active.thumbnail = v;
    elements.metaForm.elements.thumbnail.value = v;
  }

  const author = findByBaseName(items, "author");
  if (author?.path) {
    const v = normalizeAssetsPath(author.path);
    active.authorImg = v;
    elements.metaForm.elements.authorImg.value = v;
  }

  active.results = active.results ?? {};
  MBTI_ORDER.forEach((code) => {
    const hit = findByBaseName(items, code);
    if (!hit?.path) return;
    active.results[code] = {
      ...(active.results[code] ?? {}),
      image: normalizeAssetsPath(hit.path),
    };
  });

  const questions = Array.isArray(active.questions) ? active.questions : [];
  for (let i = 1; i <= REQUIRED_QUESTION_COUNT; i += 1) {
    const hit =
      findByBaseName(items, `Q${i}`) || findByBaseName(items, `q${i}`);
    if (!hit?.path) continue;
    const question = questions.find((q) => String(q?.id || "") === `q${i}`);
    if (question && !String(question.questionImage || "").trim()) {
      question.questionImage = normalizeAssetsPath(hit.path);
    }
  }

  refreshActiveView(active);
}

async function loadTest(testId) {
  if (!testId) return;
  setActiveTest(testId);
  if (state.loadedTests[testId]) {
    refreshActiveView(state.loadedTests[testId]);
    await refreshImageList(testId);
    return;
  }
  setPanelLoading("meta", true);
  setPanelLoading("questions", true);
  setPanelLoading("results", true);
  try {
    const test = await fetchTestDetail(testId);
    state.loadedTests = { ...state.loadedTests, [testId]: test };
    syncMetaEntry(test);
    hydrateMetaForm(test);
    refreshActiveView(test);
  } catch (err) {
    showToast(err?.message || "테스트 로딩 실패", true);
  } finally {
    setPanelLoading("meta", false);
    setPanelLoading("questions", false);
    setPanelLoading("results", false);
    await refreshImageList(testId);
  }
}

function createTest() {
  const rawId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const newTest = {
    id: `test-${rawId.slice(0, 8)}`,
    title: "새 테스트",
    isPublished: false,
    description: [],
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
  setActiveTest(newTest.id);
  populateTestSelector();
  hydrateMetaForm(newTest);
  refreshActiveView(newTest);
  showToast("새 테스트를 만들었습니다.");
}

async function reloadActiveTest() {
  const testId = state.activeTestId;
  if (!testId) return;
  const test = await fetchTestDetail(testId);
  state.loadedTests = { ...state.loadedTests, [testId]: test };
  syncMetaEntry(test);
  hydrateMetaForm(test);
  refreshActiveView(test);
}

async function saveActiveTest() {
  const test = getActiveTest();
  if (!test || !state.activeTestId) return;
  const error = validateTestForSave(test);
  if (error) {
    showToast(error, true);
    setSaveStatus(error, true);
    return;
  }
  setSavingState(true);
  setSaveStatus("저장 중...");
  try {
    await saveTest(state.activeTestId, test);
    await reloadActiveTest();
    setSaveStatus("저장 완료");
    showToast("저장 완료");
  } catch (err) {
    setSaveStatus(err?.message || "저장 실패", true);
    showToast(err?.message || "저장 실패", true);
  } finally {
    setSavingState(false);
  }
}

async function handleBulkResultUpload() {
  const test = getActiveTest();
  if (!test || !elements.resultForm) return;
  const input = elements.resultForm.querySelector(
    'input[name="bulkResultFiles"]',
  );
  const files = Array.from(input?.files || []);
  if (!files.length) {
    showToast("일괄 업로드할 이미지를 선택해주세요.", true);
    return;
  }

  let uploadedCount = 0;
  for (const file of files) {
    const name = String(file.name || "")
      .replace(/\.[^.]+$/, "")
      .toUpperCase();
    if (!MBTI_ORDER.includes(name)) continue;
    try {
      const uploaded = await uploadResultImage(test.id, name, file);
      test.results = test.results ?? {};
      test.results[name] = {
        ...(test.results[name] ?? {}),
        image: uploaded.path || test.results[name]?.image || "",
      };
      uploadedCount += 1;
    } catch (err) {
      // Continue best-effort uploads.
    }
  }

  renderResults(test.results);
  input.value = "";
  if (uploadedCount > 0) {
    showToast(`${uploadedCount}개 결과 이미지를 업로드했습니다.`);
    await refreshImageList(test.id);
  } else {
    showToast("MBTI 파일명(INTJ.png 등)과 일치하는 파일이 없습니다.", true);
  }
}

function wireHeaderEvents() {
  elements.createTestButton?.addEventListener("click", createTest);
  elements.testSelect?.addEventListener("change", (event) => {
    loadTest(event.target.value);
  });
  elements.saveButton?.addEventListener("click", saveActiveTest);
  elements.bulkUploadButton?.addEventListener("click", handleBulkResultUpload);
}

export async function initAdmin() {
  if (!elements.metaForm) return;

  setSaveStatus("저장 준비");
  wireHeaderEvents();
  bindForms({
    getActiveTest,
    setMetaHydratingFlag,
    setSaveStatus,
    renderQuestions,
    renderResults,
    syncMetaEntry,
    refreshImageList,
    uploadTestImage,
    uploadResultImage,
    showToast,
  });

  try {
    const payload = await fetchTestsIndex();
    const tests = Array.isArray(payload?.tests) ? payload.tests : [];
    state.tests = tests.map((meta) => ({
      id: meta.id,
      title: meta.title ?? "",
      thumbnail: meta.thumbnail ?? "",
      tags: Array.isArray(meta.tags) ? [...meta.tags] : [],
      path: meta.path ?? `${meta.id}/test.json`,
      createdAt: meta.createdAt ?? "",
      updatedAt: meta.updatedAt ?? "",
      isPublished: Boolean(meta.is_published), // D1 returns snake_case
    }));
    setActiveTest(state.tests[0]?.id ?? null);
    populateTestSelector();
    if (state.activeTestId) await loadTest(state.activeTestId);
  } catch (err) {
    showToast(err?.message || "초기 목록 로딩 실패", true);
    refreshActiveView(null);
  }
}
