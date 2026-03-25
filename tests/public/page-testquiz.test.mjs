import assert from "node:assert/strict";
import test from "node:test";

import { TESTQUIZ_PAGE_HTML } from "./fixtures-pages.mjs";
import { minimalPublishedQuizTest } from "./sample-test-json.mjs";
import {
  createBrowserEnv,
  dispatchDomContentLoaded,
} from "./setup-happy-dom.mjs";

/** Fresh `?v=` so page scripts re-run after each `createBrowserEnv` (DOM refs at module load). */
function testquizImportHref() {
  const u = new URL("../../public/scripts/testquiz.js", import.meta.url);
  u.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return u.href;
}

/** Detail is `/api/tests/:id`; compute is `/api/tests/:id/compute`. Avoid `includes("compute")` — ids may contain that substring. */
function isTestDetailRequest(url, testId) {
  const u = String(url);
  const base = `/api/tests/${encodeURIComponent(testId)}`;
  return u.includes(base) && !u.includes(`${base}/compute`);
}

function isComputeRequest(url, testId) {
  return String(url).includes(
    `/api/tests/${encodeURIComponent(testId)}/compute`,
  );
}

test("testquiz.js answers one question and navigates to result", async () => {
  const t = minimalPublishedQuizTest("quiz1");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  const btn = document.querySelector(".TestSelectBtn button");
  assert.ok(btn);
  btn.click();

  await new Promise((r) => setTimeout(r, 20));

  assert.ok(
    hrefSnap.includes("testresult.html"),
    `expected navigation to result, got ${hrefSnap}`,
  );
  assert.ok(hrefSnap.includes("result="));
});

test("testquiz.js falls back to local compute when edge returns empty mbti", async () => {
  const t = minimalPublishedQuizTest("quiz-empty-mbti");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response(JSON.stringify({ mbti: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const btn = document.querySelector(".TestSelectBtn button");
  assert.ok(btn);
  btn.click();
  await new Promise((r) => setTimeout(r, 40));

  // Answers are shuffled per question; first button may be E or I → ESTJ or ISTJ.
  const result = (() => {
    try {
      return new URL(hrefSnap).searchParams.get("result");
    } catch {
      return "";
    }
  })();
  assert.ok(result === "ESTJ" || result === "ISTJ", `expected ESTJ|ISTJ, got ${result}`);
});

test("testquiz.js uses edge compute MBTI and percent query params when API succeeds", async () => {
  const t = minimalPublishedQuizTest("quiz-edge");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response(
        JSON.stringify({
          mbti: "INTJ",
          percentages: { E: 72, S: 81, T: 40, J: 65 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  const btn = document.querySelector(".TestSelectBtn button");
  assert.ok(btn);
  btn.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.ok(hrefSnap.includes("result=INTJ"));
  assert.ok(hrefSnap.includes("pE=") && hrefSnap.includes("72"));
});

test("testquiz.js shows error when testId is missing", async () => {
  createBrowserEnv({ url: "http://127.0.0.1:8788/testquiz.html" });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 40));

  assert.ok(document.body.textContent?.includes("testId"));
});

test("testquiz.js shows message when question has no answers", async () => {
  const t = minimalPublishedQuizTest("quiz-no-ans");
  t.questions = [
    {
      id: "q1",
      label: "Q1",
      questionImage: `assets/${t.id}/images/q1.png`,
      answers: [],
    },
  ];

  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);

  await new Promise((r) => setTimeout(r, 50));

  assert.ok(
    document.body.textContent?.includes("선택지가 준비되지 않았습니다."),
  );
});

test("testquiz.js advances through two questions then navigates to result", async () => {
  const t = minimalPublishedQuizTest("quiz-two-q");
  t.questions = [
    {
      id: "q1",
      label: "Q1",
      questionImage: `assets/${t.id}/images/q1.png`,
      answers: [
        { mbtiAxis: "EI", direction: "E", label: "E" },
        { mbtiAxis: "EI", direction: "I", label: "I" },
      ],
    },
    {
      id: "q2",
      label: "Q2",
      questionImage: `assets/${t.id}/images/q2.png`,
      answers: [
        { mbtiAxis: "SN", direction: "S", label: "S" },
        { mbtiAxis: "SN", direction: "N", label: "N" },
      ],
    },
  ];

  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const firstBtn = document.querySelector(".TestSelectBtn button");
  assert.ok(firstBtn);
  firstBtn.click();
  await new Promise((r) => setTimeout(r, 45));

  assert.ok(
    !hrefSnap.includes("testresult.html"),
    "should stay on quiz after first answer",
  );

  const secondBtn = document.querySelector(".TestSelectBtn button");
  assert.ok(secondBtn);
  secondBtn.click();
  await new Promise((r) => setTimeout(r, 45));

  assert.ok(hrefSnap.includes("testresult.html"));
  assert.ok(hrefSnap.includes("result="));
});

test("testquiz.js shows error when detail API body is not valid JSON", async () => {
  const t = minimalPublishedQuizTest("quiz-bad-json-body");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response("{{{not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(
    document.body.textContent?.includes("테스트 정보를 불러오지 못했습니다."),
  );
});

test("testquiz.js uses sessionStorage cache without fetching detail JSON", async () => {
  const t = minimalPublishedQuizTest("quiz-cache-hit");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  window.sessionStorage.setItem(
    `mbtitest:testdata:${t.id}`,
    JSON.stringify(t),
  );
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  let detailFetches = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      detailFetches += 1;
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  assert.equal(detailFetches, 0);
  assert.ok(document.querySelector(".TestSelectBtn button"));
});

test("testquiz.js still renders when sessionStorage.setItem throws (persist)", async () => {
  const t = minimalPublishedQuizTest("quiz-persist-throw");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  const storage = window.sessionStorage;
  const orig = storage.setItem.bind(storage);
  storage.setItem = () => {
    throw new Error("quota");
  };

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  try {
    await import("../../public/scripts/config.js");
    await import(testquizImportHref());
    dispatchDomContentLoaded(window);
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(document.querySelector(".TestSelectBtn button"));
  } finally {
    storage.setItem = orig;
  }
});

test("testquiz.js falls back to local MBTI when compute response.json rejects", async () => {
  const t = minimalPublishedQuizTest("quiz-compute-json-reject");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      const res = new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      res.json = () => Promise.reject(new SyntaxError("bad json"));
      return res;
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const btn = document.querySelector(".TestSelectBtn button");
  assert.ok(btn);
  btn.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.ok(hrefSnap.includes("testresult.html"));
  assert.ok(hrefSnap.includes("result="));
});

test("testquiz.js falls back to local compute when edge compute fetch throws", async () => {
  const t = minimalPublishedQuizTest("quiz-compute-throw");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      throw new Error("network");
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const btn = document.querySelector(".TestSelectBtn button");
  assert.ok(btn);
  btn.click();
  await new Promise((r) => setTimeout(r, 40));

  assert.ok(hrefSnap.includes("testresult.html"));
  assert.ok(hrefSnap.includes("result="));
});

test("testquiz.js image onerror clears src after fallback", async () => {
  const t = minimalPublishedQuizTest("quiz-img-err");
  t.questions = [
    {
      id: "q1",
      label: "Q1",
      questionImage: `assets/${t.id}/images/q1.png`,
      answers: [
        { mbtiAxis: "EI", direction: "E", label: "E" },
        { mbtiAxis: "EI", direction: "I", label: "I" },
      ],
    },
  ];

  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const img = document.querySelector(".TestImg img");
  assert.ok(img);
  img.dispatchEvent(new Event("error"));
  await new Promise((r) => setTimeout(r, 10));
  img.dispatchEvent(new Event("error"));
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(img.getAttribute("src"), null);
});

test("testquiz.js shuffles with Math.random when global crypto is unavailable", async () => {
  const t = minimalPublishedQuizTest("quiz-no-crypto");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  let hrefSnap = "";
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => String(window.location),
    set: (v) => {
      hrefSnap = String(v);
    },
  });

  const prevCrypto = globalThis.crypto;
  try {
    delete globalThis.crypto;
  } catch {
    /* ignore */
  }

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  try {
    await import("../../public/scripts/config.js");
    await import(testquizImportHref());
    dispatchDomContentLoaded(window);
    await new Promise((r) => setTimeout(r, 50));

    const btn = document.querySelector(".TestSelectBtn button");
    assert.ok(btn);
    btn.click();
    await new Promise((r) => setTimeout(r, 40));

    assert.ok(hrefSnap.includes("testresult.html"));
    assert.ok(hrefSnap.includes("result="));
  } finally {
    if (prevCrypto !== undefined) globalThis.crypto = prevCrypto;
  }
});

test("testquiz.js invalid sessionStorage cache JSON triggers fetch of test detail", async () => {
  const t = minimalPublishedQuizTest("quiz-bad-cache");
  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;
  window.sessionStorage.setItem(`mbtitest:testdata:${t.id}`, "{not-json");

  let fetchDetail = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      fetchDetail += 1;
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(fetchDetail, 1);
  assert.ok(document.querySelector(".TestSelectBtn button"));
});

test("testquiz.js uses convention image paths when questionImage is absent", async () => {
  const t = minimalPublishedQuizTest("quiz-conv-img");
  t.questions = [
    {
      id: "q1",
      label: "Q1",
      answers: [
        { mbtiAxis: "EI", direction: "E", label: "E" },
        { mbtiAxis: "EI", direction: "I", label: "I" },
      ],
    },
  ];

  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const img = document.querySelector(".TestImg img");
  assert.ok(img);
  assert.ok(
    String(img.getAttribute("data-asset-src") || "").includes(
      `assets/${t.id}/images/q1`,
    ),
  );
});

test("testquiz.js resolves question image from image alias field", async () => {
  const t = minimalPublishedQuizTest("quiz-img-alias");
  const ip = `assets/${t.id}/images`;
  t.questions = [
    {
      id: "q1",
      label: "Q1",
      image: `${ip}/from-image-field.png`,
      answers: [
        { mbtiAxis: "EI", direction: "E", label: "E" },
        { mbtiAxis: "EI", direction: "I", label: "I" },
      ],
    },
  ];

  createBrowserEnv({
    url: `http://127.0.0.1:8788/testquiz.html?testId=${encodeURIComponent(t.id)}`,
  });
  document.body.innerHTML = TESTQUIZ_PAGE_HTML;

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (isTestDetailRequest(u, t.id)) {
      return new Response(JSON.stringify(t), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isComputeRequest(u, t.id)) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 404 });
  };

  await import("../../public/scripts/config.js");
  await import(testquizImportHref());
  dispatchDomContentLoaded(window);
  await new Promise((r) => setTimeout(r, 50));

  const img = document.querySelector(".TestImg img");
  assert.ok(img);
  assert.equal(img.getAttribute("data-asset-src"), `${ip}/from-image-field.png`);
});
