import { AXIS_MAP, elements, REQUIRED_QUESTION_COUNT } from "./state.js";
import { parseDescriptionInput } from "./validation.js";

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

export function bindForms({
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
}) {
  elements.metaForm?.addEventListener("input", () => {
    if (setMetaHydratingFlag()) return;
    const activeTest = getActiveTest();
    if (!activeTest || !elements.metaForm) return;
    const form = elements.metaForm;
    activeTest.author = form.elements.author.value;
    activeTest.authorImg = form.elements.authorImg.value;
    activeTest.title = form.elements.title.value;
    activeTest.description = parseDescriptionInput(
      form.elements.description.value,
    );
    activeTest.tags = form.elements.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    activeTest.thumbnail = form.elements.thumbnail.value;
    syncMetaEntry(activeTest);
  });

  elements.metaForm?.addEventListener("change", async (event) => {
    const activeTest = getActiveTest();
    if (!activeTest || !elements.metaForm) return;
    const target = event.target;
    if (!target || target.tagName !== "INPUT") return;

    if (target.name === "thumbnailFile" || target.name === "authorImgFile") {
      const file = target.files?.[0];
      if (!file) return;
      const imageName =
        target.name === "thumbnailFile" ? "thumbnail" : "author";
      try {
        setSaveStatus(`${imageName} 이미지 업로드 중...`);
        const uploaded = await uploadTestImage(activeTest.id, file, imageName);
        if (imageName === "thumbnail") {
          activeTest.thumbnail = uploaded.path;
          elements.metaForm.elements.thumbnail.value = uploaded.path;
        } else {
          activeTest.authorImg = uploaded.path;
          elements.metaForm.elements.authorImg.value = uploaded.path;
        }
        syncMetaEntry(activeTest);
        showToast("이미지 업로드 완료");
      } catch (err) {
        showToast(err?.message || "이미지 업로드 실패", true);
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
    const activeTest = getActiveTest();
    if (!activeTest || !elements.questionForm) return;
    activeTest.questions = Array.isArray(activeTest.questions)
      ? activeTest.questions
      : [];
    if (activeTest.questions.length >= REQUIRED_QUESTION_COUNT) {
      showToast(
        `문항은 ${REQUIRED_QUESTION_COUNT}개까지 등록할 수 있습니다.`,
        true,
      );
      return;
    }
    const nextNo = getNextQuestionNo(activeTest.questions);
    if (!nextNo) return;

    const formData = new FormData(elements.questionForm);
    const imageFile = elements.questionForm.querySelector(
      'input[name="questionImageFile"]',
    )?.files?.[0];
    let imagePath = String(formData.get("questionImage") || "").trim();
    if (imageFile) {
      try {
        const uploaded = await uploadTestImage(
          activeTest.id,
          imageFile,
          `Q${nextNo}`,
        );
        imagePath = uploaded.path;
      } catch (err) {
        showToast(err?.message || "질문 이미지 업로드 실패", true);
        return;
      }
    }
    if (!imagePath) {
      showToast("질문 이미지를 먼저 업로드해주세요.", true);
      return;
    }

    const qId = `q${nextNo}`;
    const axis = String(formData.get("axis") || "EI");
    const [positive, negative] = AXIS_MAP[axis] ?? AXIS_MAP.EI;
    const pref = String(formData.get("answerADirection") || "positive");
    const aDir = pref === "negative" ? negative : positive;
    const bDir = pref === "negative" ? positive : negative;
    activeTest.questions.push({
      id: qId,
      label: String(formData.get("questionLabel") || "").trim(),
      questionImage: imagePath,
      answers: [
        {
          id: `${qId}_a`,
          label: String(formData.get("answerAText") || "").trim(),
          mbtiAxis: axis,
          direction: aDir,
        },
        {
          id: `${qId}_b`,
          label: String(formData.get("answerBText") || "").trim(),
          mbtiAxis: axis,
          direction: bDir,
        },
      ],
    });
    renderQuestions(activeTest.questions);
    elements.questionForm.reset();
    syncAnswerDirectionOptions();
    showToast("문항 추가 완료");
    await refreshImageList(activeTest.id);
  });

  elements.questionList?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-remove-question]");
    if (!btn) return;
    const activeTest = getActiveTest();
    if (!activeTest) return;
    activeTest.questions = (activeTest.questions || []).filter(
      (q) => q.id !== btn.dataset.removeQuestion,
    );
    renderQuestions(activeTest.questions);
  });

  elements.resultForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const activeTest = getActiveTest();
    if (!activeTest || !elements.resultForm) return;
    const data = new FormData(elements.resultForm);
    const code = String(data.get("code") || "")
      .toUpperCase()
      .trim();
    const summary = String(data.get("summary") || "").trim();
    const file = elements.resultForm.querySelector(
      'input[name="resultImageFile"]',
    )?.files?.[0];
    if (!code || !summary || !file) {
      showToast("MBTI/요약/이미지를 모두 입력하세요.", true);
      return;
    }
    try {
      const uploaded = await uploadResultImage(activeTest.id, code, file);
      activeTest.results = activeTest.results || {};
      activeTest.results[code] = {
        image: uploaded.path || activeTest.results?.[code]?.image || "",
        summary,
      };
      renderResults(activeTest.results);
      showToast("결과 저장 완료");
      elements.resultForm.querySelector('input[name="resultImageFile"]').value =
        "";
      elements.resultForm.elements.summary.value = "";
      await refreshImageList(activeTest.id);
    } catch (err) {
      showToast(err?.message || "결과 저장 실패", true);
    }
  });

  elements.resultList?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-remove-result]");
    if (!btn) return;
    const activeTest = getActiveTest();
    if (!activeTest?.results) return;
    delete activeTest.results[btn.dataset.removeResult];
    renderResults(activeTest.results);
  });
}
