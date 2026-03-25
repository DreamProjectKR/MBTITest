import {
  fetchImageList,
  fetchTestDetail,
  fetchTestsIndex,
  saveTest,
  uploadResultImage,
  uploadTestImage,
} from "./api.js";
import { elements } from "./dom.js";
import { getActiveTest } from "./selectors.js";
import { AXIS_MAP, MBTI_ORDER, REQUIRED_QUESTION_COUNT } from "./state.js";
import {
  findByBaseName,
  getNextQuestionNo,
  normalizeAssetsPath,
  validateTestForSave,
} from "./validation.js";

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

function normalizeIndexTests(tests) {
  return tests.map((meta) => ({
    id: meta.id,
    title: meta.title ?? "",
    thumbnail: meta.thumbnail ?? "",
    tags: Array.isArray(meta.tags) ? [...meta.tags] : [],
    path: meta.path ?? `${meta.id}/test.json`,
    createdAt: meta.createdAt ?? "",
    updatedAt: meta.updatedAt ?? "",
    isPublished: Boolean(meta.is_published),
  }));
}

function setSaveStatus(store, message, isError = false) {
  store.dispatch({ type: "SET_SAVE_STATUS", message, isError });
}

function setPanelLoading(store, panelKey, value) {
  store.dispatch({ type: "SET_PANEL_LOADING", panelKey, value });
}

function syncLoadedTest(store, test) {
  store.dispatch({ type: "SET_LOADED_TEST", test });
  store.dispatch({ type: "SYNC_TEST_META_FROM_TEST", test });
}

function syncImagesToTest(test, items) {
  if (!test) return null;

  let thumbnail = test.thumbnail;
  let authorImg = test.authorImg;
  const thumb = findByBaseName(items, "thumbnail");
  if (thumb?.path) thumbnail = normalizeAssetsPath(thumb.path);
  const author = findByBaseName(items, "author");
  if (author?.path) authorImg = normalizeAssetsPath(author.path);

  const results = MBTI_ORDER.reduce(
    (acc, code) => {
      const hit = findByBaseName(items, code);
      if (!hit?.path) return acc;
      return {
        ...acc,
        [code]: {
          ...(acc[code] ?? {}),
          image: normalizeAssetsPath(hit.path),
        },
      };
    },
    { ...(test.results ?? {}) },
  );

  const baseQuestions = Array.isArray(test.questions) ? test.questions : [];
  const questions = baseQuestions.map((question) => {
    const qNum = String(question?.id || "").replace(/^q/i, "");
    const hit =
      findByBaseName(items, `Q${qNum}`) || findByBaseName(items, `q${qNum}`);
    if (!hit?.path || String(question?.questionImage || "").trim())
      return question;
    return { ...question, questionImage: normalizeAssetsPath(hit.path) };
  });

  return {
    ...test,
    thumbnail,
    authorImg,
    results,
    questions,
  };
}

export function createAdminEffects(store, { showToast }) {
  return {
    async bootstrap() {
      setSaveStatus(store, "저장 준비");
      const payload = await fetchTestsIndex();
      const tests = Array.isArray(payload?.tests) ? payload.tests : [];
      const normalized = normalizeIndexTests(tests);
      store.dispatch({ type: "SET_TESTS", tests: normalized });
      store.dispatch({
        type: "SET_ACTIVE_TEST",
        testId: normalized[0]?.id ?? null,
      });
      if (normalized[0]?.id) {
        await this.loadTest(normalized[0].id);
      }
    },

    async refreshImageList(testId) {
      if (!testId) {
        store.dispatch({ type: "SET_IMAGE_LIST", items: [] });
        return;
      }
      try {
        const data = await fetchImageList(testId);
        const items = Array.isArray(data?.items) ? data.items : [];
        store.dispatch({ type: "SET_IMAGE_LIST", items });
        const state = store.getState();
        const activeTest = getActiveTest(state);
        if (activeTest?.id !== testId) return;
        const synced = syncImagesToTest(activeTest, items);
        if (!synced) return;
        syncLoadedTest(store, synced);
        store.dispatch({ type: "REQUEST_META_HYDRATE" });
      } catch {
        store.dispatch({ type: "SET_IMAGE_LIST", items: [] });
      }
    },

    async loadTest(testId) {
      if (!testId) return;
      store.dispatch({ type: "SET_ACTIVE_TEST", testId });
      const state = store.getState();
      if (state.loadedTests[testId]) {
        await this.refreshImageList(testId);
        return;
      }

      setPanelLoading(store, "meta", true);
      setPanelLoading(store, "questions", true);
      setPanelLoading(store, "results", true);
      try {
        const test = await fetchTestDetail(testId);
        syncLoadedTest(store, test);
        store.dispatch({ type: "REQUEST_META_HYDRATE" });
      } catch (error) {
        showToast(error?.message || "테스트 로딩 실패", true);
      } finally {
        setPanelLoading(store, "meta", false);
        setPanelLoading(store, "questions", false);
        setPanelLoading(store, "results", false);
        await this.refreshImageList(testId);
      }
    },

    createTest() {
      const rawId =
        crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      const test = {
        id: `test-${rawId.slice(0, 8)}`,
        title: "새 테스트",
        isPublished: false,
        description: [],
        tags: [],
        thumbnail: "",
        author: "",
        authorImg: "",
        questions: [],
        results: MBTI_ORDER.reduce(
          (acc, code) => ({ ...acc, [code]: { image: "", summary: "" } }),
          {},
        ),
      };
      store.dispatch({ type: "ADD_TEST", test, meta: buildMetaFromTest(test) });
      showToast("새 테스트를 만들었습니다.");
    },

    async reloadActiveTest() {
      const state = store.getState();
      const testId = state.activeTestId;
      if (!testId) return;
      const test = await fetchTestDetail(testId);
      syncLoadedTest(store, test);
      store.dispatch({ type: "REQUEST_META_HYDRATE" });
    },

    async saveActiveTest() {
      const state = store.getState();
      const test = getActiveTest(state);
      if (!test || !state.activeTestId) return;
      const error = validateTestForSave(test);
      if (error) {
        setSaveStatus(store, error, true);
        showToast(error, true);
        return;
      }
      store.dispatch({ type: "SET_IS_SAVING", value: true });
      setSaveStatus(store, "저장 중...");
      try {
        await saveTest(state.activeTestId, test);
        await this.reloadActiveTest();
        setSaveStatus(store, "저장 완료");
        showToast("저장 완료");
      } catch (error) {
        const message = error?.message || "저장 실패";
        setSaveStatus(store, message, true);
        showToast(message, true);
      } finally {
        store.dispatch({ type: "SET_IS_SAVING", value: false });
      }
    },

    async handleBulkResultUpload() {
      const state = store.getState();
      const test = getActiveTest(state);
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
      let nextResults = { ...(test.results ?? {}) };
      for (const file of files) {
        const name = String(file.name || "")
          .replace(/\.[^.]+$/, "")
          .toUpperCase();
        if (!MBTI_ORDER.includes(name)) continue;
        try {
          const uploaded = await uploadResultImage(test.id, name, file);
          nextResults = {
            ...nextResults,
            [name]: {
              ...(nextResults[name] ?? {}),
              image: uploaded.path || nextResults[name]?.image || "",
            },
          };
          uploadedCount += 1;
        } catch {
          // Best-effort bulk upload.
        }
      }

      syncLoadedTest(store, { ...test, results: nextResults });
      if (input) input.value = "";
      if (uploadedCount > 0) {
        showToast(`${uploadedCount}개 결과 이미지를 업로드했습니다.`);
        await this.refreshImageList(test.id);
        return;
      }
      showToast("MBTI 파일명(INTJ.png 등)과 일치하는 파일이 없습니다.", true);
    },

    updateMetaFromForm(form) {
      const state = store.getState();
      const activeTest = getActiveTest(state);
      if (!activeTest) return;
      const next = {
        ...activeTest,
        isPublished: form.elements.isPublished.checked,
        author: form.elements.author.value,
        authorImg: form.elements.authorImg.value,
        title: form.elements.title.value,
        description: String(form.elements.description.value || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
        tags: form.elements.tags.value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        thumbnail: form.elements.thumbnail.value,
      };
      syncLoadedTest(store, next);
    },

    async handleMetaImageUpload(fieldName, file) {
      const state = store.getState();
      const activeTest = getActiveTest(state);
      if (!activeTest || !file || !elements.metaForm) return;
      const imageName = fieldName === "thumbnailFile" ? "thumbnail" : "author";
      try {
        setSaveStatus(store, `${imageName} 이미지 업로드 중...`);
        const uploaded = await uploadTestImage(activeTest.id, file, imageName);
        const next =
          imageName === "thumbnail" ?
            { ...activeTest, thumbnail: uploaded.path }
          : { ...activeTest, authorImg: uploaded.path };
        syncLoadedTest(store, next);
        store.dispatch({ type: "REQUEST_META_HYDRATE" });
        showToast("이미지 업로드 완료");
      } catch (error) {
        showToast(error?.message || "이미지 업로드 실패", true);
      }
    },

    async addQuestion(formData, imageFile) {
      const state = store.getState();
      const activeTest = getActiveTest(state);
      if (!activeTest) return;
      const previousQuestions =
        Array.isArray(activeTest.questions) ? activeTest.questions : [];
      if (previousQuestions.length >= REQUIRED_QUESTION_COUNT) {
        showToast(
          `문항은 ${REQUIRED_QUESTION_COUNT}개까지 등록할 수 있습니다.`,
          true,
        );
        return;
      }

      const nextNo = getNextQuestionNo(previousQuestions);
      if (!nextNo) return;
      let imagePath = String(formData.get("questionImage") || "").trim();
      if (imageFile) {
        try {
          const uploaded = await uploadTestImage(
            activeTest.id,
            imageFile,
            `Q${nextNo}`,
          );
          imagePath = uploaded.path;
        } catch (error) {
          showToast(error?.message || "질문 이미지 업로드 실패", true);
          return;
        }
      }
      if (!imagePath) {
        showToast("질문 이미지를 먼저 업로드해주세요.", true);
        return;
      }

      const questionId = `q${nextNo}`;
      const axis = String(formData.get("axis") || "EI");
      const [positive, negative] = AXIS_MAP[axis] ?? AXIS_MAP.EI;
      const preference = String(formData.get("answerADirection") || "positive");
      const answerADirection = preference === "negative" ? negative : positive;
      const answerBDirection = preference === "negative" ? positive : negative;
      const newQuestion = {
        id: questionId,
        label: String(formData.get("questionLabel") || "").trim(),
        questionImage: imagePath,
        answers: [
          {
            id: `${questionId}_a`,
            label: String(formData.get("answerAText") || "").trim(),
            mbtiAxis: axis,
            direction: answerADirection,
          },
          {
            id: `${questionId}_b`,
            label: String(formData.get("answerBText") || "").trim(),
            mbtiAxis: axis,
            direction: answerBDirection,
          },
        ],
      };
      syncLoadedTest(store, {
        ...activeTest,
        questions: [...previousQuestions, newQuestion],
      });
      showToast("문항 추가 완료");
      await this.refreshImageList(activeTest.id);
    },

    removeQuestion(questionId) {
      const state = store.getState();
      const activeTest = getActiveTest(state);
      if (!activeTest) return;
      syncLoadedTest(store, {
        ...activeTest,
        questions: (activeTest.questions || []).filter(
          (question) => question.id !== questionId,
        ),
      });
    },

    async saveResult(formData, file) {
      const state = store.getState();
      const activeTest = getActiveTest(state);
      if (!activeTest) return;
      const code = String(formData.get("code") || "")
        .toUpperCase()
        .trim();
      const summary = String(formData.get("summary") || "").trim();
      if (!code || !summary || !file) {
        showToast("MBTI/요약/이미지를 모두 입력하세요.", true);
        return;
      }
      try {
        const uploaded = await uploadResultImage(activeTest.id, code, file);
        syncLoadedTest(store, {
          ...activeTest,
          results: {
            ...(activeTest.results || {}),
            [code]: {
              image: uploaded.path || activeTest.results?.[code]?.image || "",
              summary,
            },
          },
        });
        showToast("결과 저장 완료");
        await this.refreshImageList(activeTest.id);
      } catch (error) {
        showToast(error?.message || "결과 저장 실패", true);
      }
    },

    removeResult(code) {
      const state = store.getState();
      const activeTest = getActiveTest(state);
      if (!activeTest?.results) return;
      const { [code]: _, ...rest } = activeTest.results;
      syncLoadedTest(store, { ...activeTest, results: rest });
    },
  };
}
