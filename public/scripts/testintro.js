/**
 * Test intro page controller (`public/testintro.html` -> `public/scripts/testintro.js`).
 *
 * What it does:
 * - Reads `testId` from the query string.
 * - Fetches test JSON via `GET /api/tests/:id`.
 * - Renders thumbnail/tags/author/description and wires Start/Share buttons.
 * - Renders intro UI and navigates to quiz.
 */
const header = document.querySelector(".Head");
const headerScroll = document.querySelector("header");
const headerOffset = header ? header.offsetTop : 0;
// Asset URL building is centralized in `public/scripts/config.js`.
// This file only sets `data-asset-*` and asks config.js to hydrate.

function hydrateAssetElement(el) {
  if (!el) return;
  if (typeof window.applyAssetAttributes === "function") {
    window.applyAssetAttributes(el);
  }
}

const TEST_JSON_CACHE_PREFIX = "mbtitest:testdata:";
let lastLoadedTest = null;
const preloadState = { started: false, criticalPromise: null };

// Preload raw assets (no `/cdn-cgi/image`) so we can reuse them as fallback
// if Image Resizing returns intermittent 503s.
const QUESTION_RESIZE_RAW = "";
const RESULT_RESIZE_RAW = "";

function getTestCacheKey(testId) {
  if (!testId) return "";
  return `${TEST_JSON_CACHE_PREFIX}${testId}`;
}

function readCachedTestJson(testId) {
  if (!testId || typeof window === "undefined") return null;
  try {
    const storage = window.sessionStorage;
    if (!storage) return null;
    const raw = storage.getItem(getTestCacheKey(testId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function persistTestJson(testId, data) {
  if (!testId || !data) return;
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    if (!storage) return;
    storage.setItem(getTestCacheKey(testId), JSON.stringify(data));
  } catch (err) {
    // Ignore storage errors (private mode/quota)
  }
}

function setOverlayVisible(visible) {
  const overlay = document.getElementById("preloadOverlay");
  if (!overlay) return;
  if (visible) {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  } else {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
  }
}

function updateOverlayProgress(done, total) {
  const bar = document.querySelector("[data-preload-progress]");
  const text = document.querySelector("[data-preload-text]");
  const pct =
    total > 0
      ? Math.max(0, Math.min(100, Math.round((done / total) * 100)))
      : 0;
  if (bar && bar.style) bar.style.width = `${pct}%`;
  if (text) text.textContent = `테스트 준비 중... (${pct}%)`;
}

function promiseWithTimeout(promise, timeoutMs) {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), ms)),
  ]);
}

function normalizeImagePath(p) {
  const s = String(p || "").trim();
  return s ? s : "";
}

function getQuestionImageCandidates(testId, question) {
  const raw =
    question?.questionImage ||
    question?.image ||
    question?.questionImg ||
    question?.question_image;
  if (raw) return [normalizeImagePath(raw)].filter(Boolean);

  const qid = String(question?.id || "").trim();
  if (!testId || !qid) return [];
  const base = `assets/${testId}/images/`;
  const upper = qid.toUpperCase();
  const qPrefix = qid.replace(/^q/i, "Q");
  const list = [
    `${base}${qid}.png`,
    `${base}${qid}.jpg`,
    `${base}${qid}.jpeg`,
    `${base}${upper}.png`,
    `${base}${upper}.jpg`,
    `${base}${upper}.jpeg`,
    `${base}${qPrefix}.png`,
    `${base}${qPrefix}.jpg`,
    `${base}${qPrefix}.jpeg`,
  ];
  return list.map(normalizeImagePath).filter(Boolean);
}

function extractImagePaths(test) {
  const testId = test?.id ? String(test.id) : "";
  const questions = Array.isArray(test?.questions) ? test.questions : [];
  const resultsObj =
    test?.results && typeof test.results === "object" ? test.results : null;

  const questionPaths = [];
  for (const q of questions) {
    const candidates = getQuestionImageCandidates(testId, q);
    if (candidates.length) questionPaths.push(candidates[0]);
  }

  const resultPaths = [];
  if (resultsObj) {
    Object.values(resultsObj).forEach((r) => {
      const img = r && typeof r === "object" ? r.image : null;
      const p = normalizeImagePath(img);
      if (p) resultPaths.push(p);
    });
  }

  return { questionPaths, resultPaths };
}

async function preloadImages(paths, resizeRaw, version, opts) {
  const list = Array.isArray(paths) ? paths.filter(Boolean) : [];
  const total = list.length;
  if (!total) return { loaded: 0, failed: 0, total: 0 };

  const concurrency =
    opts && Number.isFinite(Number(opts.concurrency))
      ? Number(opts.concurrency)
      : 4;
  const onProgress =
    opts && typeof opts.onProgress === "function" ? opts.onProgress : null;

  let loaded = 0;
  let failed = 0;
  let index = 0;

  const worker = async () => {
    while (index < list.length) {
      const i = index;
      index += 1;
      const p = list[i];
      if (!p) continue;

      let ok = false;
      if (typeof window.loadImageAsset === "function") {
        // eslint-disable-next-line no-await-in-loop
        ok = await window.loadImageAsset(p, resizeRaw, version);
      } else if (typeof window.prefetchImageAsset === "function") {
        window.prefetchImageAsset(p, resizeRaw, version);
        ok = true;
      }

      if (ok) loaded += 1;
      else failed += 1;
      if (onProgress) onProgress({ loaded, failed, total });
    }
  };

  const workers = [];
  const n = Math.max(1, Math.min(concurrency, total));
  for (let i = 0; i < n; i += 1) workers.push(worker());
  await Promise.all(workers);
  return { loaded, failed, total };
}

function startBackgroundPrefetch(test) {
  if (!test || preloadState.started) return;
  preloadState.started = true;

  const version = test.updatedAt ? String(test.updatedAt) : "";
  const { questionPaths, resultPaths } = extractImagePaths(test);

  const criticalQuestions = questionPaths.slice(0, 3);
  const rest = questionPaths.slice(3);

  const runCritical = () =>
    Promise.all([
      preloadImages(criticalQuestions, QUESTION_RESIZE_RAW, version, {
        concurrency: 2,
      }),
      preloadImages(resultPaths, RESULT_RESIZE_RAW, version, {
        concurrency: 2,
      }),
    ]);
  const runRest = () =>
    preloadImages(rest, QUESTION_RESIZE_RAW, version, { concurrency: 2 });

  // Phase 1 quickly; Phase 2 in idle time.
  preloadState.criticalPromise = (function () {
    if (typeof requestIdleCallback === "function") {
      return new Promise((resolve) => {
        requestIdleCallback(
          () => {
            runCritical().then(resolve);
          },
          { timeout: 1200 },
        );
      });
    }
    return runCritical();
  })().then(() => {
    try {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => runRest(), { timeout: 2000 });
      } else {
        setTimeout(() => runRest(), 50);
      }
    } catch (e) {}
    return null;
  });
}

async function ensureCriticalPreloaded(test, timeoutMs) {
  if (!test) return;
  if (!preloadState.started) startBackgroundPrefetch(test);

  const version = test.updatedAt ? String(test.updatedAt) : "";
  const { questionPaths, resultPaths } = extractImagePaths(test);
  const criticalQuestions = questionPaths.slice(0, 3);
  const total = criticalQuestions.length + resultPaths.length;

  let qDone = 0;
  let rDone = 0;
  updateOverlayProgress(0, total);

  const p = Promise.all([
    preloadImages(criticalQuestions, QUESTION_RESIZE_RAW, version, {
      concurrency: 4,
      onProgress: ({ loaded, failed }) => {
        qDone = loaded + failed;
        updateOverlayProgress(qDone + rDone, total);
      },
    }),
    preloadImages(resultPaths, RESULT_RESIZE_RAW, version, {
      concurrency: 4,
      onProgress: ({ loaded, failed }) => {
        rDone = loaded + failed;
        updateOverlayProgress(qDone + rDone, total);
      },
    }),
  ]);

  await promiseWithTimeout(p, timeoutMs);
}

// NOTE: preloading/prefetching is intentionally removed elsewhere; this file uses config.js helpers.

window.addEventListener(
  "scroll",
  () => {
    if (!header) return;
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (window.scrollY > headerOffset) {
      header.classList.add("fixed-header", "bg-on");
      if (isMobile && headerScroll) {
        headerScroll.style.marginBottom = "35px";
      }
    } else {
      header.classList.remove("fixed-header", "bg-on");
      if (headerScroll) {
        headerScroll.style.marginBottom = "";
      }
    }
  },
  { passive: true },
);

function getTestIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("testId");
  return id ? decodeURIComponent(id) : "";
}

/**
 * Render a user-visible error state on the intro page.
 * @param {string} message
 */
function renderIntroError(message) {
  const titleEl = document.querySelector(".IntroShellTextBox h2");
  const descEl = document.querySelector(".IntroDescription");
  if (titleEl) titleEl.textContent = "테스트를 불러올 수 없습니다.";
  if (descEl) descEl.textContent = message || "테스트 정보를 찾을 수 없습니다.";
}

// 테스트 인트로 데이터를 JSON에서 로딩해 화면에 주입
async function loadIntroData() {
  const testId = getTestIdFromQuery();
  if (!testId) {
    renderIntroError("testId 파라미터가 없습니다.");
    return;
  }
  setupStartButton(testId);

  try {
    // 1) Try API first (fast path when Functions routes are available)
    // 2) If API is missing (404) or fails, fall back to index.json -> assets/<id>/test.json
    const apiBase = window.API_TESTS_BASE || "/api/tests";
    let data = null;

    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(testId)}`);
      if (res.ok) {
        data = await res.json();
      } else {
        // If the API route isn't deployed (common Pages misconfig), fall back.
        throw new Error(`API ${res.status}`);
      }
    } catch (e) {
      // Fallback: index.json을 읽어서 test.json 경로를 찾고, /assets 프록시로 불러온다.
      const index =
        typeof window.getTestIndex === "function"
          ? await window.getTestIndex()
          : await fetch(window.TEST_INDEX_URL || "/assets/index.json").then(
              (r) => r.json(),
            );
      const tests = Array.isArray(index?.tests) ? index.tests : [];
      const meta = tests.find((t) => String(t?.id || "") === String(testId));
      if (!meta?.path)
        throw new Error("index.json에 테스트가 없습니다: " + testId);

      const path = String(meta.path || "").trim();
      const url =
        typeof window.assetUrl === "function" ? window.assetUrl(path) : path;

      const res2 = await fetch(url);
      if (!res2.ok) throw new Error(`테스트 데이터 로딩 실패: ${res2.status}`);
      data = await res2.json();
    }

    persistTestJson(testId, data);
    lastLoadedTest = data;
    startBackgroundPrefetch(data);

    setupShareButton(data);
    renderIntro(data);
  } catch (err) {
    console.error("테스트 인트로 로딩 오류:", err);
    renderIntroError("테스트 정보를 불러오지 못했습니다.");
  }
}

// 태그를 DOM으로 생성해 스타일 클래스(HashTag)를 그대로 사용
function renderTags(tagsEl, tags) {
  if (!tagsEl) return;
  tagsEl.innerHTML = "";
  if (!Array.isArray(tags)) return;

  const frag = document.createDocumentFragment();
  tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "HashTag";
    span.textContent = `#${tag}`;
    frag.appendChild(span);
  });
  tagsEl.appendChild(frag);
}

// 설명이 배열이면 줄마다 <p>로 만들어 CSS는 유지하고 내용만 채움
function renderDescription(descEl, description) {
  if (!descEl) return;
  descEl.innerHTML = "";

  const lines = Array.isArray(description)
    ? description
    : description
      ? [description]
      : [];

  const frag = document.createDocumentFragment();
  lines.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    frag.appendChild(p);
  });

  if (frag.childNodes.length) descEl.appendChild(frag);
}

function renderIntro(data) {
  if (!data) return;

  const thumbnailEl = document.querySelector(".IntroShellImg img");
  const tagsEl = document.querySelector(".IntroShellImg .NewTestHashTag");
  const titleEl = document.querySelector(".IntroShellTextBox h2");
  const authorImgEl = document.querySelector(".Creator img");
  const authorNameEl = document.querySelector(".CreatorName");
  const descEl = document.querySelector(".IntroDescription");
  const version = data.updatedAt ? String(data.updatedAt) : "";

  if (thumbnailEl) {
    if (data.thumbnail) {
      thumbnailEl.removeAttribute("src");
      thumbnailEl.setAttribute("data-asset-src", String(data.thumbnail));
      thumbnailEl.setAttribute(
        "data-asset-resize",
        "width=480,quality=82,fit=cover,format=auto",
      );
      thumbnailEl.setAttribute("data-asset-srcset", "360,480,720");
      thumbnailEl.setAttribute(
        "data-asset-sizes",
        "(max-width: 900px) 92vw, 350px",
      );
      if (version) thumbnailEl.setAttribute("data-asset-version", version);
      hydrateAssetElement(thumbnailEl);
    }
    if (data.title) thumbnailEl.alt = data.title;
  }

  renderTags(tagsEl, data.tags);

  if (titleEl && data.title) titleEl.textContent = data.title;

  const authorName = data.author;

  if (authorImgEl) {
    if (data.authorImg) {
      authorImgEl.removeAttribute("src");
      authorImgEl.setAttribute("data-asset-src", String(data.authorImg));
      authorImgEl.setAttribute(
        "data-asset-resize",
        "width=200,quality=85,fit=cover,format=auto",
      );
      if (version) authorImgEl.setAttribute("data-asset-version", version);
      hydrateAssetElement(authorImgEl);
    }
    if (authorName) authorImgEl.alt = `제작자 ${authorName}`;
  }

  if (authorNameEl && authorName)
    authorNameEl.textContent = `제작자 : ${authorName}`;

  renderDescription(descEl, data.description);
}

document.addEventListener("DOMContentLoaded", loadIntroData);

function setupShareButton(test) {
  const shareBtn = document.querySelector(".TestShare button");
  if (!shareBtn) return;
  shareBtn.addEventListener("click", () => {
    shareCurrentTest(test);
  });
}

async function shareCurrentTest(test) {
  const shareUrl = window.location.href;
  const title = test?.title || "MBTI ZOO 테스트";
  if (navigator.share) {
    await navigator.share({
      title,
      text: title,
      url: shareUrl,
    });
    return;
  }
  await navigator.clipboard.writeText(shareUrl);
  alert("링크가 클립보드에 복사되었습니다.");
}

function setupStartButton(testId) {
  const startBtn = document.querySelector(".TestStart button");
  if (!startBtn) return;
  const targetUrl = `./testquiz.html?testId=${encodeURIComponent(testId)}`;
  startBtn.addEventListener("click", async () => {
    setOverlayVisible(true);
    try {
      const test = lastLoadedTest ||
        readCachedTestJson(testId) || {
          id: testId,
          questions: [],
          results: {},
        };
      await ensureCriticalPreloaded(test, 2500);
    } catch (e) {
      // Ignore preload errors; proceed.
    } finally {
      window.location.href = targetUrl;
    }
  });
}
