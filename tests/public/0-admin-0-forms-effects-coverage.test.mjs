import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_MINIMAL_HTML } from "./fixtures-admin-html.mjs";
import { sampleAdminFullTest } from "./sample-test-json.mjs";
import { createBrowserEnv } from "./setup-happy-dom.mjs";

/**
 * Runs before `0-admin-a-effects-branches` so `dom.js` `elements` bind to this HTML first.
 */
function buildAdminFetchMock(overrides = {}) {
  const {
    listTests = [],
    getDetail = () => ({}),
    imageItems = [],
    putImageFail = false,
    putSaveFail = false,
    putResultFail = false,
  } = overrides;
  return async (url, init) => {
    const u = String(url);
    const method = (init && init.method) || "GET";
    const path = new URL(u, "http://127.0.0.1").pathname;

    if (
      method === "GET" &&
      (path === "/api/admin/tests" || path === "/api/admin/tests/")
    ) {
      return new Response(JSON.stringify({ tests: listTests }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (method === "GET" && /\/api\/admin\/tests\/[^/]+\/images$/.test(path)) {
      return new Response(JSON.stringify({ items: imageItems }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (method === "GET" && /\/api\/admin\/tests\/[^/]+$/.test(path)) {
      const id = path.split("/").pop() || "";
      return new Response(JSON.stringify(getDetail(id)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (method === "PUT" && /\/results\/[^/]+\/image$/.test(path)) {
      if (putResultFail) {
        return new Response(JSON.stringify({ error: "ri" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ path: "assets/x/r.png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (method === "PUT" && /\/images$/.test(path) && !path.includes("/results")) {
      if (putImageFail) {
        return new Response(JSON.stringify({ error: "up" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ path: "assets/x/up.png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (method === "PUT" && /\/api\/admin\/tests\/[^/]+$/.test(path)) {
      if (putSaveFail) {
        return new Response(JSON.stringify({ error: "save" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "nf" }), { status: 404 });
  };
}

test("admin forms + createAdminEffects branch coverage (single DOM snapshot)", async () => {
  createBrowserEnv();
  const { DataTransfer, File: DomFile } = globalThis.window;
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  await import("../../public/scripts/config.js");

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );
  const { bindForms, syncAnswerDirectionOptions } = await import(
    "../../public/scripts/admin/forms.js"
  );
  const { elements, setMetaHydrating } = await import(
    "../../public/scripts/admin/dom.js"
  );

  const listMetaApi = {
    id: "t1",
    title: "T1",
    thumbnail: "",
    tags: [],
    path: "t1/t.json",
    createdAt: "a",
    updatedAt: "b",
    is_published: false,
  };
  const listMeta = {
    id: "t1",
    title: "T1",
    thumbnail: "",
    tags: [],
    path: "t1/t.json",
    createdAt: "a",
    updatedAt: "b",
    isPublished: false,
  };

  const detail = sampleAdminFullTest("t1");
  let detailFetchCount = 0;

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: (id) => {
      detailFetchCount += 1;
      if (id === "t1") return detail;
      return { ...detail, id };
    },
    imageItems: [],
  });

  const toasts = [];
  const showToast = (msg, isErr) => {
    toasts.push({ msg: String(msg), isErr: Boolean(isErr) });
  };

  const store = createStore(adminReducer, initialAdminState);
  const effects = createAdminEffects(store, { showToast });

  await effects.bootstrap();
  assert.equal(store.getState().activeTestId, "t1");
  assert.ok(store.getState().tests.length >= 1);

  await effects.refreshImageList("");
  assert.deepEqual(store.getState().imageList, []);

  await effects.createTest();
  assert.ok(toasts.some((t) => !t.isErr && t.msg.includes("새 테스트")));

  detailFetchCount = 0;
  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: (id) => {
      detailFetchCount += 1;
      return id === "t1" ? detail : { ...detail, id };
    },
  });
  const storeLoaded = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effLoaded = createAdminEffects(storeLoaded, { showToast: () => {} });
  await effLoaded.loadTest("t1");
  assert.equal(detailFetchCount, 0);

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
  });
  const storeReload = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effReload = createAdminEffects(storeReload, { showToast: () => {} });
  await effReload.reloadActiveTest();
  assert.equal(storeReload.getState().loadedTests.t1?.title, detail.title);

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
  });
  const storeSaveOk = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effSaveOk = createAdminEffects(storeSaveOk, { showToast });
  await effSaveOk.saveActiveTest();
  assert.ok(toasts.some((t) => !t.isErr && t.msg.includes("저장 완료")));

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
    putSaveFail: true,
  });
  const storeSaveBad = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effSaveBad = createAdminEffects(storeSaveBad, { showToast });
  await effSaveBad.saveActiveTest();
  assert.ok(toasts.some((t) => t.isErr && t.msg.includes("save")));

  const storeMeta = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: {
        ...detail,
        title: "x",
      },
    },
  });
  const effMeta = createAdminEffects(storeMeta, { showToast: () => {} });
  assert.ok(elements.metaForm);
  elements.metaForm.elements.title.value = "next";
  effMeta.updateMetaFromForm(elements.metaForm);
  assert.equal(storeMeta.getState().loadedTests.t1?.title, "next");

  setMetaHydrating(true);
  elements.metaForm.elements.title.value = "hid";
  elements.metaForm.dispatchEvent(
    new Event("input", { bubbles: true, cancelable: true }),
  );
  assert.notEqual(storeMeta.getState().loadedTests.t1?.title, "hid");
  setMetaHydrating(false);

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
  });
  const storeImg = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effImg = createAdminEffects(storeImg, { showToast });
  const thumbInput = elements.metaForm.querySelector(
    'input[name="thumbnailFile"]',
  );
  const f = new DomFile([new Uint8Array([1, 2])], "a.png", { type: "image/png" });
  const dt = new DataTransfer();
  dt.items.add(f);
  thumbInput.files = dt.files;
  await effImg.handleMetaImageUpload("thumbnailFile", f);
  assert.ok(
    String(storeImg.getState().loadedTests.t1?.thumbnail || "").length > 0,
  );

  globalThis.fetch = buildAdminFetchMock({
    putImageFail: true,
  });
  const storeImgFail = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effImgFail = createAdminEffects(storeImgFail, { showToast });
  await effImgFail.handleMetaImageUpload("thumbnailFile", f);
  assert.ok(toasts.some((t) => t.isErr));

  const full12 = sampleAdminFullTest("full12");
  const storeMaxQ = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "full12",
    loadedTests: { full12 },
  });
  const effMaxQ = createAdminEffects(storeMaxQ, { showToast });
  const fdMax = new FormData();
  fdMax.set("axis", "EI");
  fdMax.set("answerADirection", "positive");
  fdMax.set("questionLabel", "L");
  fdMax.set("questionImage", "assets/x/q.png");
  fdMax.set("answerAText", "a");
  fdMax.set("answerBText", "b");
  await effMaxQ.addQuestion(fdMax, null);
  assert.ok(
    toasts.some((t) => t.isErr && t.msg.includes("12") && t.msg.includes("문항")),
  );

  const storeNoImg = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: { ...detail, id: "t1", questions: [] },
    },
  });
  const effNoImg = createAdminEffects(storeNoImg, { showToast });
  const fdNo = new FormData();
  fdNo.set("axis", "EI");
  fdNo.set("answerADirection", "positive");
  fdNo.set("questionLabel", "L");
  fdNo.set("questionImage", "");
  fdNo.set("answerAText", "a");
  fdNo.set("answerBText", "b");
  await effNoImg.addQuestion(fdNo, null);
  assert.ok(toasts.some((t) => t.isErr && t.msg.includes("이미지")));

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => ({ ...detail, id: "t1", questions: [] }),
    putImageFail: true,
  });
  const storeUpFail = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: { ...detail, id: "t1", questions: [] },
    },
  });
  const effUpFail = createAdminEffects(storeUpFail, { showToast });
  const imgF = new DomFile([new Uint8Array([1])], "q.png", { type: "image/png" });
  const fdUp = new FormData();
  fdUp.set("axis", "EI");
  fdUp.set("answerADirection", "positive");
  fdUp.set("questionLabel", "L");
  fdUp.set("questionImage", "");
  fdUp.set("answerAText", "a");
  fdUp.set("answerBText", "b");
  await effUpFail.addQuestion(fdUp, imgF);
  assert.ok(toasts.some((t) => t.isErr && t.msg.includes("업로드")));

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => ({ ...detail, id: "t1", questions: [] }),
  });
  const storeAdd = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: { ...detail, id: "t1", questions: [] },
    },
  });
  const effAdd = createAdminEffects(storeAdd, { showToast: () => {} });
  const fdOk = new FormData();
  fdOk.set("axis", "SN");
  fdOk.set("answerADirection", "negative");
  fdOk.set("questionLabel", "QL");
  fdOk.set("questionImage", "assets/t1/q9.png");
  fdOk.set("answerAText", "aa");
  fdOk.set("answerBText", "bb");
  await effAdd.addQuestion(fdOk, null);
  assert.equal(storeAdd.getState().loadedTests.t1?.questions?.length, 1);

  const storeRmQ = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: {
        ...detail,
        id: "t1",
        questions: [{ id: "q1", label: "x", questionImage: "p", answers: [] }],
      },
    },
  });
  const effRmQ = createAdminEffects(storeRmQ, { showToast: () => {} });
  effRmQ.removeQuestion("q1");
  assert.equal(storeRmQ.getState().loadedTests.t1?.questions?.length, 0);

  const storeBadRes = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effBadRes = createAdminEffects(storeBadRes, { showToast });
  await effBadRes.saveResult(new FormData(), null);
  assert.ok(toasts.some((t) => t.isErr && t.msg.includes("모두")));

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
  });
  const storeRes = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effRes = createAdminEffects(storeRes, { showToast: () => {} });
  const fdRes = new FormData();
  fdRes.set("code", "INTP");
  fdRes.set("summary", "s");
  const rf = new DomFile([new Uint8Array([2])], "x.png", { type: "image/png" });
  await effRes.saveResult(fdRes, rf);
  assert.ok(storeRes.getState().loadedTests.t1?.results?.INTP?.summary === "s");

  globalThis.fetch = buildAdminFetchMock({
    putResultFail: true,
  });
  const storeResFail = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effResFail = createAdminEffects(storeResFail, { showToast });
  const fdRes2 = new FormData();
  fdRes2.set("code", "ENTJ");
  fdRes2.set("summary", "s2");
  const rf2 = new DomFile([new Uint8Array([3])], "y.png", { type: "image/png" });
  await effResFail.saveResult(fdRes2, rf2);
  assert.ok(toasts.some((t) => t.isErr));

  const storeRmR = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: {
        ...detail,
        results: { ...detail.results, INTJ: { image: "i", summary: "s" } },
      },
    },
  });
  const effRmR = createAdminEffects(storeRmR, { showToast: () => {} });
  effRmR.removeResult("INTJ");
  assert.equal(storeRmR.getState().loadedTests.t1?.results?.INTJ, undefined);

  const storeBulkEmpty = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effBulkEmpty = createAdminEffects(storeBulkEmpty, { showToast });
  await effBulkEmpty.handleBulkResultUpload();
  assert.ok(toasts.some((t) => t.isErr && t.msg.includes("선택")));

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
  });
  const storeBulkOk = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: { ...detail, results: {} } },
  });
  const effBulkOk = createAdminEffects(storeBulkOk, { showToast });
  const bulkIn = elements.resultForm?.querySelector(
    'input[name="bulkResultFiles"]',
  );
  assert.ok(bulkIn);
  const dtBulk = new DataTransfer();
  dtBulk.items.add(
    new DomFile([new Uint8Array([1])], "INTJ.png", { type: "image/png" }),
  );
  bulkIn.files = dtBulk.files;
  await effBulkOk.handleBulkResultUpload();
  assert.ok(toasts.some((t) => !t.isErr && t.msg.includes("업로드")));

  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url), "http://127.0.0.1").pathname;
    const method = (init && init.method) || "GET";
    if (
      method === "PUT" &&
      /\/results\/[^/]+\/image$/.test(path) &&
      path.includes("/ENTJ/")
    ) {
      return new Response(JSON.stringify({ error: "bulk-partial" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return buildAdminFetchMock({
      listTests: [listMetaApi],
      getDetail: () => detail,
    })(url, init);
  };
  const storeBulkPartial = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: { ...detail, results: {} } },
  });
  const effBulkPartial = createAdminEffects(storeBulkPartial, {
    showToast: () => {},
  });
  const dtPartial = new DataTransfer();
  dtPartial.items.add(
    new DomFile([new Uint8Array([1])], "INTJ.png", { type: "image/png" }),
  );
  dtPartial.items.add(
    new DomFile([new Uint8Array([2])], "ENTJ.png", { type: "image/png" }),
  );
  bulkIn.files = dtPartial.files;
  await effBulkPartial.handleBulkResultUpload();
  assert.ok(
    storeBulkPartial.getState().loadedTests.t1?.results?.INTJ?.image?.length,
  );

  const storeBulkMiss = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: { ...detail, results: {} } },
  });
  const effBulkMiss = createAdminEffects(storeBulkMiss, { showToast });
  const dtMiss = new DataTransfer();
  dtMiss.items.add(
    new DomFile([new Uint8Array([1])], "zzz.png", { type: "image/png" }),
  );
  bulkIn.files = dtMiss.files;
  await effBulkMiss.handleBulkResultUpload();
  assert.ok(toasts.some((t) => t.isErr && t.msg.includes("파일명")));

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
    imageItems: [
      { path: "assets/t1/images/thumbnail.png", name: "thumbnail" },
    ],
  });
  const storeSync = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: { ...detail, thumbnail: "" } },
  });
  const effSync = createAdminEffects(storeSync, { showToast: () => {} });
  await effSync.refreshImageList("t1");
  assert.ok(
    String(storeSync.getState().loadedTests.t1?.thumbnail || "").includes(
      "thumb",
    ),
  );

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
    imageItems: [{ path: "assets/t1/images/intj.png", name: "x" }],
  });
  const storeMergeIntj = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: {
        ...detail,
        id: "t1",
        results: { INTJ: { summary: "keep", image: "" } },
      },
    },
  });
  await createAdminEffects(storeMergeIntj, { showToast: () => {} }).refreshImageList(
    "t1",
  );
  assert.ok(
    String(
      storeMergeIntj.getState().loadedTests.t1?.results?.INTJ?.image || "",
    ).includes("intj"),
  );
  assert.equal(
    storeMergeIntj.getState().loadedTests.t1?.results?.INTJ?.summary,
    "keep",
  );

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
    imageItems: [{ path: "assets/t1/images/q1.png", name: "x" }],
  });
  const storeSkipQimg = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: {
        ...detail,
        id: "t1",
        questions: [
          {
            id: "q1",
            label: "L",
            questionImage: "already-set.png",
            answers: [],
          },
        ],
      },
    },
  });
  await createAdminEffects(storeSkipQimg, { showToast: () => {} }).refreshImageList(
    "t1",
  );
  assert.equal(
    storeSkipQimg.getState().loadedTests.t1?.questions?.[0]?.questionImage,
    "already-set.png",
  );

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
    imageItems: [{ path: "assets/t1/images/q1.png", name: "x" }],
  });
  const storeMergeQempty = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: {
        ...detail,
        id: "t1",
        questions: [
          {
            id: "q1",
            label: "L",
            questionImage: "",
            answers: [
              { id: "q1_a", mbtiAxis: "EI", direction: "E", label: "a" },
              { id: "q1_b", mbtiAxis: "EI", direction: "I", label: "b" },
            ],
          },
        ],
      },
    },
  });
  await createAdminEffects(storeMergeQempty, { showToast: () => {} }).refreshImageList(
    "t1",
  );
  assert.ok(
    String(
      storeMergeQempty.getState().loadedTests.t1?.questions?.[0]?.questionImage ||
        "",
    ).includes("q1"),
  );

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
    imageItems: [],
  });
  const storeOther = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: { t1: detail },
  });
  const effOther = createAdminEffects(storeOther, { showToast: () => {} });
  await effOther.refreshImageList("t2");
  assert.equal(storeOther.getState().imageList.length, 0);

  const axisSelect = elements.questionForm?.querySelector('select[name="axis"]');
  assert.ok(axisSelect);
  axisSelect.value = "SN";
  syncAnswerDirectionOptions();
  const dirSelect = elements.questionForm?.querySelector(
    'select[name="answerADirection"]',
  );
  assert.ok(String(dirSelect?.options[0]?.textContent || "").includes("S"));

  axisSelect.innerHTML = "<option value=\"ZZ\">ZZ</option>";
  axisSelect.value = "ZZ";
  syncAnswerDirectionOptions();
  const dirFallback = elements.questionForm?.querySelector(
    'select[name="answerADirection"]',
  );
  const fallbackLabel = String(dirFallback?.options[0]?.textContent || "");
  assert.ok(fallbackLabel.includes("E") && fallbackLabel.includes("I"));

  axisSelect.innerHTML =
    '<option value="EI" selected>EI</option><option value="SN">SN</option>';
  axisSelect.value = "EI";
  syncAnswerDirectionOptions();

  const storeBind = createStore(adminReducer, {
    ...initialAdminState,
    tests: [listMeta],
    activeTestId: "t1",
    loadedTests: {
      t1: {
        ...detail,
        id: "t1",
        questions: [
          {
            id: "q1",
            label: "L",
            questionImage: "assets/t1/q.png",
            answers: [
              { id: "q1_a", mbtiAxis: "EI", direction: "E", label: "a" },
              { id: "q1_b", mbtiAxis: "EI", direction: "I", label: "b" },
            ],
          },
        ],
      },
    },
  });
  const effBind = createAdminEffects(storeBind, {
    showToast: () => {},
  });
  bindForms({ store: storeBind, effects: effBind });

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
  });
  const thumbBindIn = elements.metaForm.querySelector(
    'input[name="thumbnailFile"]',
  );
  const dtThumbBind = new DataTransfer();
  dtThumbBind.items.add(
    new DomFile([new Uint8Array([1])], "thumb.png", { type: "image/png" }),
  );
  thumbBindIn.files = dtThumbBind.files;
  thumbBindIn.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(
    String(storeBind.getState().loadedTests.t1?.thumbnail || "").length > 0,
  );

  globalThis.fetch = buildAdminFetchMock({
    listTests: [listMetaApi],
    getDetail: () => detail,
  });
  const qFormEl = elements.questionForm;
  qFormEl.setAttribute("novalidate", "novalidate");
  qFormEl.querySelector('[name="questionLabel"]').value = "Q2";
  qFormEl.querySelector('[name="questionImage"]').value = "assets/t1/q2.png";
  qFormEl.querySelector('[name="answerAText"]').value = "a2";
  qFormEl.querySelector('[name="answerBText"]').value = "b2";
  qFormEl.querySelector('button[type="submit"]')?.click();
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(storeBind.getState().loadedTests.t1?.questions?.length, 2);

  const resFormEl = elements.resultForm;
  resFormEl.setAttribute("novalidate", "novalidate");
  const dtResBind = new DataTransfer();
  dtResBind.items.add(
    new DomFile([new Uint8Array([3])], "r.png", { type: "image/png" }),
  );
  resFormEl.querySelector('[name="resultImageFile"]').files = dtResBind.files;
  resFormEl.elements.code.value = "INTP";
  resFormEl.elements.summary.value = "bind-sum";
  resFormEl.querySelector('button[type="submit"]')?.click();
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(
    storeBind.getState().loadedTests.t1?.results?.INTP?.summary,
    "bind-sum",
  );

  elements.metaForm.elements.title.value = "bound";
  elements.metaForm.dispatchEvent(
    new Event("input", { bubbles: true, cancelable: true }),
  );
  assert.equal(storeBind.getState().loadedTests.t1?.title, "bound");

  const qBtn = elements.questionList?.querySelector("[data-remove-question]");
  assert.ok(qBtn);
  qBtn.dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(storeBind.getState().loadedTests.t1?.questions?.length, 1);

  const rBtn = elements.resultList?.querySelector("[data-remove-result]");
  assert.ok(rBtn);
  rBtn.dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(
    storeBind.getState().loadedTests.t1?.results?.INTJ,
    undefined,
  );
});
