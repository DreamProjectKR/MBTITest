import assert from "node:assert/strict";
import test from "node:test";
import { installMbtiConfig } from "./config-install.mjs";

import { ADMIN_MINIMAL_HTML } from "./fixtures-admin-html.mjs";
import { createBrowserEnv } from "./setup-happy-dom.mjs";

test("createAdminEffects loadTest shows toast when fetchTestDetail fails", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;

  installMbtiConfig(window, document);

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );

  const toasts = [];
  const store = createStore(adminReducer, {
    ...initialAdminState,
    tests: [
      {
        id: "t1",
        title: "T",
        thumbnail: "",
        tags: [],
        path: "t1/t.json",
        createdAt: "",
        updatedAt: "",
        isPublished: false,
      },
    ],
    activeTestId: "t1",
    loadedTests: {},
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/admin/tests/t1") && !u.includes("/images")) {
      throw new Error("detail failed");
    }
    return new Response("{}", { status: 404 });
  };

  const effects = createAdminEffects(store, {
    showToast: (msg, isErr) => {
      toasts.push({ msg, isErr: Boolean(isErr) });
    },
  });

  await effects.loadTest("t1");

  assert.ok(toasts.some((t) => t.isErr && String(t.msg).includes("detail")));
});

test("createAdminEffects refreshImageList skips sync when active test id mismatches", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;
  installMbtiConfig(window, document);

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );

  const keepThumb = "assets/t1/keep-thumb.png";
  const store = createStore(adminReducer, {
    ...initialAdminState,
    activeTestId: "t1",
    loadedTests: {
      t1: {
        id: "t1",
        title: "T1",
        thumbnail: keepThumb,
        questions: [],
        results: {},
      },
    },
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/admin/tests/t2/images")) {
      return new Response(
        JSON.stringify({
          items: [{ path: "assets/t2/images/thumbnail.png", baseName: "thumbnail" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 404 });
  };

  const effects = createAdminEffects(store, { showToast: () => {} });
  await effects.refreshImageList("t2");

  assert.equal(store.getState().imageList.length, 1);
  assert.equal(store.getState().loadedTests.t1.thumbnail, keepThumb);
});

test("createAdminEffects refreshImageList keeps existing questionImage when list has Q1 file", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;
  installMbtiConfig(window, document);

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );

  const preserved = "assets/t1/preserved-q1.png";
  const store = createStore(adminReducer, {
    ...initialAdminState,
    activeTestId: "t1",
    loadedTests: {
      t1: {
        id: "t1",
        title: "T1",
        thumbnail: "",
        questions: [
          {
            id: "q1",
            label: "Q",
            questionImage: preserved,
            answers: [
              { mbtiAxis: "EI", direction: "E", label: "a" },
              { mbtiAxis: "EI", direction: "I", label: "b" },
            ],
          },
        ],
        results: {},
      },
    },
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/admin/tests/t1/images")) {
      return new Response(
        JSON.stringify({
          items: [{ path: "assets/t1/images/q1.png", baseName: "Q1" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 404 });
  };

  const effects = createAdminEffects(store, { showToast: () => {} });
  await effects.refreshImageList("t1");

  assert.equal(
    store.getState().loadedTests.t1.questions[0].questionImage,
    preserved,
  );
});

test("createAdminEffects refreshImageList catch clears image list", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;
  installMbtiConfig(window, document);

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );

  const store = createStore(adminReducer, {
    ...initialAdminState,
    activeTestId: "t1",
    loadedTests: {
      t1: { id: "t1", title: "x", questions: [], results: {} },
    },
  });

  globalThis.fetch = async () => {
    throw new Error("images down");
  };

  const effects = createAdminEffects(store, { showToast: () => {} });
  await effects.refreshImageList("t1");

  assert.deepEqual(store.getState().imageList, []);
});

test("saveActiveTest validation error sets status and toast", async () => {
  createBrowserEnv();
  document.body.innerHTML = ADMIN_MINIMAL_HTML;
  installMbtiConfig(window, document);

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );

  const toasts = [];
  const store = createStore(adminReducer, {
    ...initialAdminState,
    activeTestId: "t1",
    loadedTests: {
      t1: {
        id: "t1",
        title: "",
        thumbnail: "",
        authorImg: "",
        questions: [],
        results: {},
      },
    },
  });

  const effects = createAdminEffects(store, {
    showToast: (msg, isErr) => {
      toasts.push({ msg, isErr: Boolean(isErr) });
    },
  });

  await effects.saveActiveTest();

  assert.ok(toasts.some((t) => t.isErr));
  assert.equal(store.getState().ui.saveError, true);
});

test("addQuestion with image file uses uploaded path", async () => {
  createBrowserEnv();
  const { File: DomFile } = globalThis.window;
  document.body.innerHTML = ADMIN_MINIMAL_HTML;
  installMbtiConfig(window, document);

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );

  const oneQuestion = {
    id: "q1",
    label: "L",
    questionImage: "assets/t1/q.png",
    answers: [
      { id: "q1_a", mbtiAxis: "EI", direction: "E", label: "a" },
      { id: "q1_b", mbtiAxis: "EI", direction: "I", label: "b" },
    ],
  };

  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url), "http://127.0.0.1").pathname;
    const method = (init && init.method) || "GET";
    if (method === "PUT" && /\/images$/.test(path) && !path.includes("/results")) {
      return new Response(
        JSON.stringify({ path: "assets/t1/from-upload.png" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (method === "GET" && /\/api\/admin\/tests\/[^/]+\/images$/.test(path)) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "nf" }), { status: 404 });
  };

  const store = createStore(adminReducer, {
    ...initialAdminState,
    activeTestId: "t1",
    loadedTests: {
      t1: {
        id: "t1",
        title: "T",
        thumbnail: "",
        authorImg: "",
        questions: [oneQuestion],
        results: {},
      },
    },
  });

  const effects = createAdminEffects(store, { showToast: () => {} });
  const fd = new FormData();
  fd.set("axis", "EI");
  fd.set("questionLabel", "Q2");
  fd.set("questionImage", "");
  fd.set("answerADirection", "positive");
  fd.set("answerAText", "a2");
  fd.set("answerBText", "b2");
  const img = new DomFile([new Uint8Array([1])], "up.png", { type: "image/png" });
  await effects.addQuestion(fd, img);

  assert.equal(store.getState().loadedTests.t1?.questions?.length, 2);
  assert.ok(
    String(
      store.getState().loadedTests.t1?.questions?.[1]?.questionImage || "",
    ).includes("from-upload"),
  );
});

test("addQuestion image upload failure shows error toast", async () => {
  createBrowserEnv();
  const { File: DomFile } = globalThis.window;
  document.body.innerHTML = ADMIN_MINIMAL_HTML;
  installMbtiConfig(window, document);

  const { adminReducer, initialAdminState } = await import(
    "../../public/scripts/admin/reducer.js"
  );
  const { createStore } = await import("../../public/scripts/admin/store.js");
  const { createAdminEffects } = await import(
    "../../public/scripts/admin/effects.js"
  );

  const oneQuestion = {
    id: "q1",
    label: "L",
    questionImage: "assets/t1/q.png",
    answers: [
      { id: "q1_a", mbtiAxis: "EI", direction: "E", label: "a" },
      { id: "q1_b", mbtiAxis: "EI", direction: "I", label: "b" },
    ],
  };

  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url), "http://127.0.0.1").pathname;
    const method = (init && init.method) || "GET";
    if (method === "PUT" && /\/images$/.test(path) && !path.includes("/results")) {
      return new Response(JSON.stringify({ error: "up" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "nf" }), { status: 404 });
  };

  const toasts = [];
  const store = createStore(adminReducer, {
    ...initialAdminState,
    activeTestId: "t1",
    loadedTests: {
      t1: {
        id: "t1",
        title: "T",
        thumbnail: "",
        authorImg: "",
        questions: [oneQuestion],
        results: {},
      },
    },
  });

  const effects = createAdminEffects(store, {
    showToast: (msg, isErr) => {
      toasts.push({ msg: String(msg), isErr: Boolean(isErr) });
    },
  });

  const fd = new FormData();
  fd.set("axis", "EI");
  fd.set("questionLabel", "Q2");
  fd.set("questionImage", "");
  fd.set("answerADirection", "positive");
  fd.set("answerAText", "a2");
  fd.set("answerBText", "b2");
  const img = new DomFile([new Uint8Array([1])], "up.png", { type: "image/png" });
  await effects.addQuestion(fd, img);

  assert.equal(store.getState().loadedTests.t1?.questions?.length, 1);
  assert.ok(toasts.some((t) => t.isErr));
});
