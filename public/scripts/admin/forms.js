import { elements, isMetaHydrating } from "./dom.js";
import { getActiveTest } from "./selectors.js";
import { AXIS_MAP, REQUIRED_QUESTION_COUNT } from "./state.js";
import { parseDescriptionInput } from "./validation.js";

/** Form bindings and DOM for question/result/meta forms. */

export function syncAnswerDirectionOptions() {
  const formEl = elements.questionForm;
  if (!formEl) return;
  const axis = String(formEl.elements.axis?.value || "EI");
  const [pos, neg] = AXIS_MAP[axis] ?? AXIS_MAP.EI;
  const select = formEl.elements.answerADirection;
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

/** Pure: next available question number 1..REQUIRED_QUESTION_COUNT. */
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

export function bindForms({ store, effects }) {
  elements.metaForm?.addEventListener("input", () => {
    if (isMetaHydrating() || !elements.metaForm) return;
    effects.updateMetaFromForm(elements.metaForm);
  });

  elements.metaForm?.addEventListener("change", async (event) => {
    const activeTest = getActiveTest(store.getState());
    if (!activeTest || !elements.metaForm) return;
    const target = event.target;
    if (!target || target.tagName !== "INPUT") return;

    if (target.name === "thumbnailFile" || target.name === "authorImgFile") {
      const file = target.files?.[0];
      if (!file) return;
      try {
        await effects.handleMetaImageUpload(target.name, file);
      } finally {
        target.value = "";
      }
    }
  });

  elements.questionForm
    ?.querySelector('select[name="axis"]')
    ?.addEventListener("change", () => syncAnswerDirectionOptions());
  syncAnswerDirectionOptions();

  elements.questionForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!elements.questionForm) return;
    const imageFile = elements.questionForm.querySelector(
      'input[name="questionImageFile"]',
    )?.files?.[0];
    await effects.addQuestion(new FormData(elements.questionForm), imageFile);
    elements.questionForm.reset();
    syncAnswerDirectionOptions();
  });

  elements.questionList?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-remove-question]");
    if (!btn) return;
    effects.removeQuestion(btn.dataset.removeQuestion);
  });

  elements.resultForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!elements.resultForm) return;
    const file = elements.resultForm.querySelector(
      'input[name="resultImageFile"]',
    )?.files?.[0];
    await effects.saveResult(new FormData(elements.resultForm), file);
    const fileInput = elements.resultForm.querySelector(
      'input[name="resultImageFile"]',
    );
    if (fileInput) fileInput.value = "";
    elements.resultForm.elements.summary.value = "";
  });

  elements.resultList?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-remove-result]");
    if (!btn) return;
    effects.removeResult(btn.dataset.removeResult);
  });
}
