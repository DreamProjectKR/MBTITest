import { MBTI_ORDER, elements, state } from "./state.js";
import { formatDescriptionForInput } from "./validation.js";

function toImageUrl(path) {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (typeof window.assetUrl === "function") return window.assetUrl(raw);
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function ensureToastRoot() {
  let root = document.querySelector(".admin-toast-root");
  if (root) return root;
  root = document.createElement("div");
  root.className = "admin-toast-root";
  document.body.appendChild(root);
  return root;
}

export function showToast(message, isError = false) {
  const root = ensureToastRoot();
  const item = document.createElement("div");
  item.className = `admin-toast${isError ? " admin-toast--error" : ""}`;
  item.textContent = String(message || "");
  root.appendChild(item);
  window.setTimeout(() => {
    item.classList.add("admin-toast--out");
    window.setTimeout(() => item.remove(), 220);
  }, 2400);
}

export function setSaveStatus(message, isError = false) {
  state.saveMessage = message;
  if (!elements.saveStatus) return;
  elements.saveStatus.textContent = message;
  elements.saveStatus.classList.toggle("save-status--error", Boolean(isError));
}

export function setSavingState(isSaving) {
  state.isSaving = isSaving;
  if (elements.saveButton)
    elements.saveButton.disabled = isSaving || !state.activeTestId;
  if (elements.createTestButton) elements.createTestButton.disabled = isSaving;
  if (!isSaving && !state.saveMessage) setSaveStatus("저장 준비");
}

export function setPanelLoading(panelKey, loading) {
  state.loading[panelKey] = Boolean(loading);
  const selectorByKey = {
    meta: '[aria-labelledby="test-meta-heading"]',
    questions: '[aria-labelledby="question-builder-heading"]',
    results: '[aria-labelledby="result-heading"]',
  };
  const panel = document.querySelector(selectorByKey[panelKey] || "");
  if (!panel) return;
  panel.classList.toggle("is-loading", Boolean(loading));
}

export function populateTestSelector() {
  if (!elements.testSelect) return;
  elements.testSelect.innerHTML = "";
  state.tests.forEach((test) => {
    const option = document.createElement("option");
    option.value = test.id;
    option.textContent = `${test.title || "제목 없는 테스트"} (${test.id})`;
    if (test.id === state.activeTestId) option.selected = true;
    elements.testSelect.appendChild(option);
  });
  elements.testSelect.disabled = state.tests.length === 0;
}

export function hydrateForms(test) {
  if (!elements.metaForm) return;
  const form = elements.metaForm;
  form.elements.isPublished.checked = Boolean(test?.isPublished);
  form.elements.author.value = test?.author ?? "";
  form.elements.authorImg.value = test?.authorImg ?? "";
  form.elements.title.value = test?.title ?? "";
  form.elements.description.value = formatDescriptionForInput(
    test?.description,
  );
  form.elements.tags.value = (Array.isArray(test?.tags) ? test.tags : []).join(
    ", ",
  );
  form.elements.thumbnail.value = test?.thumbnail ?? "";
}

export function renderQuestions(questions) {
  if (!elements.questionList) return;
  const list = Array.isArray(questions) ? questions : [];
  if (!list.length) {
    elements.questionList.innerHTML =
      '<li><div class="ds-alert">등록된 문항이 없습니다. 새로운 문항을 추가하세요.</div></li>';
    return;
  }

  elements.questionList.innerHTML = "";
  list.forEach((question, index) => {
    const item = document.createElement("li");
    item.className = "ds-card ds-card--compact";

    const badge = document.createElement("div");
    badge.className = "ds-badge ds-badge--question";

    const media = document.createElement("div");
    media.className = "ds-badge__media";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = `${question.id || index + 1} 문항 이미지`;
    if (question.questionImage) img.src = toImageUrl(question.questionImage);
    media.append(img);
    badge.append(media);

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${index + 1}. ${question.id || ""} - ${question.label || ""}`;
    content.append(title);

    const chipRow = document.createElement("div");
    chipRow.className = "ds-chip-row";
    (question.answers || []).forEach((answer) => {
      const chip = document.createElement("span");
      chip.className = "ds-chip";
      const label = document.createElement("span");
      label.textContent = answer.label || "";
      const detail = document.createElement("small");
      detail.textContent = `${answer.mbtiAxis || ""} → ${answer.direction || ""}`;
      chip.append(label, detail);
      chipRow.append(chip);
    });
    content.append(chipRow);
    badge.append(content);
    item.append(badge);

    const controls = document.createElement("div");
    controls.className = "question-item__controls";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ds-button ds-button--ghost ds-button--small";
    remove.dataset.removeQuestion = question.id;
    remove.textContent = "삭제";
    controls.append(remove);
    item.append(controls);

    elements.questionList.append(item);
  });
}

export function renderResults(results = {}) {
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
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = `${code} 이미지`;
    img.src = toImageUrl(detail?.image);
    media.append(img);
    badge.append(media);

    const textWrap = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = code;
    const summary = document.createElement("p");
    summary.textContent = detail?.summary || "";
    textWrap.append(strong, summary);
    badge.append(textWrap);
    item.append(badge);

    const controls = document.createElement("div");
    controls.className = "result-item__controls";
    const removeBtn = document.createElement("button");
    removeBtn.className = "ds-button ds-button--ghost ds-button--small";
    removeBtn.type = "button";
    removeBtn.textContent = "삭제";
    removeBtn.dataset.removeResult = code;
    controls.append(removeBtn);
    item.append(controls);

    elements.resultList.append(item);
  });
}

export function refreshActiveView(activeTest) {
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
