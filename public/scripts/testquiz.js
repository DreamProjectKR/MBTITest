/**
 * Quiz page controller (`public/testquiz.html` -> `public/scripts/testquiz.js`).
 *
 * High-level flow:
 * - Load test JSON via `GET /api/tests/:id`
 * - Shuffle questions/answers (optional)
 * - Render question questionImage image + two answer buttons
 * - Track scores and compute MBTI
 * - Navigate to `testresult.html?testId=...&result=MBTI`
 */

// --- State (single source of truth; updated only via setQuizState) ---
let state = {
  test: null,
  currentIndex: 0,
  totalQuestions: 0,
  scores: {},
  answers: [],
};

function setQuizState(update) {
  state = { ...state, ...update };
}

// Quiz question images often include text; avoid cropping.
// format=webp: faster encode than AVIF, reduces 400~800ms cold latency (Image.md B.2)
/** Single display width + webp only — avoids 320/480 double fetch + format split (Solution.md §5). */
const QUESTION_IMAGE_RESIZE = "width=480,quality=82,fit=contain,format=webp";
const QUESTION_IMAGE_RESIZE_BASE = "quality=82,fit=contain,format=webp";

/**
 * Cached DOM references for render/update.
 * @type {{ progress: HTMLElement|null, image: HTMLImageElement|null, options: HTMLElement|null, pageShell: HTMLElement|null }}
 */
const dom = {
  progress: document.querySelector(".Progress"),
  image: document.querySelector(".TestImg img"),
  options: document.querySelector(".TestSelectBtn"),
  pageShell: document.querySelector(".PageShell"),
};

// --- DOM / side effects ---
function hydrateAssetElement(el) {
  if (!el) return;
  if (typeof window.applyAssetAttributes === "function") {
    window.applyAssetAttributes(el);
  }
}

const TEST_JSON_CACHE_PREFIX = "mbtitest:testdata:";

/** Pure: cache key for test JSON. */
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
  if (!testId || !data || typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    if (!storage) return;
    storage.setItem(getTestCacheKey(testId), JSON.stringify(data));
  } catch (err) {
    // Ignore storage failures (quota/private mode)
  }
}

/** Pure: random integer in [0, maxExclusive). Uses crypto.getRandomValues when available. */
function randomInt(maxExclusive) {
  const max = Math.floor(Number(maxExclusive));
  if (!Number.isFinite(max) || max <= 0) return 0;

  // Prefer cryptographically-strong randomness when available.
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const uint32 = new Uint32Array(1);
    crypto.getRandomValues(uint32);
    return uint32[0] % max;
  }

  return Math.floor(Math.random() * max);
}

/** Pure: Fisher-Yates shuffle; returns new array, does not mutate input. */
function shuffleCopy(list) {
  if (!Array.isArray(list) || list.length <= 1) return [...(list || [])];
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pure: clone questions/answers and shuffle (new arrays, input unchanged). */
function buildShuffledQuestions(questions) {
  const base = Array.isArray(questions) ? questions : [];
  const copied = base.map((q) => {
    const answers = Array.isArray(q?.answers) ? [...q.answers] : [];
    return { ...q, answers };
  });
  const shuffled = shuffleCopy(copied).map((q) => ({
    ...q,
    answers: shuffleCopy(q.answers || []),
  }));
  return shuffled;
}

function goToResultPage(mbti, percentages) {
  const testId = state.test?.id;
  if (!testId || !mbti) {
    renderError("결과를 계산하지 못했습니다.");
    return;
  }

  const url = new URL("./testresult.html", window.location.href);
  url.searchParams.set("testId", testId);
  url.searchParams.set("result", mbti);
  const p = percentages && typeof percentages === "object" ? percentages : null;
  if (p) {
    if (Number.isFinite(Number(p.E))) url.searchParams.set("pE", String(p.E));
    if (Number.isFinite(Number(p.S))) url.searchParams.set("pS", String(p.S));
    if (Number.isFinite(Number(p.T))) url.searchParams.set("pT", String(p.T));
    if (Number.isFinite(Number(p.J))) url.searchParams.set("pJ", String(p.J));
  }
  window.location.href = url.toString();
}

/** Pure: read testId from current URL query. */
function getTestIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("testId");
  return id ? decodeURIComponent(id) : "";
}

/** Pure: normalize relative path string. */
function resolveAssetPath(relative) {
  return String(relative || "");
}

/**
 * Pure: build candidate image paths for a question (given testId + question).
 * Handles field name differences and convention-based paths under assets/<testId>/images/.
 *
 * @param {string} testId
 * @param {any} question
 * @returns {string[]}
 */
function getQuestionImageUrlCandidates(testId, question) {
  const raw =
    question?.questionImage ||
    question?.image ||
    question?.questionImg ||
    question?.question_image;

  if (raw) {
    const p = resolveAssetPath(raw);
    return p ? [p] : [];
  }

  const questionId = String(question?.id || "").trim();
  if (!testId || !questionId) return [];

  const base = `assets/${testId}/images/`;
  const upperId = questionId.toUpperCase();
  const qPrefixId = questionId.replace(/^q/i, "Q");

  const candidates = [
    `${base}${questionId}.png`,
    `${base}${questionId}.jpg`,
    `${base}${questionId}.jpeg`,
    `${base}${upperId}.png`,
    `${base}${upperId}.jpg`,
    `${base}${upperId}.jpeg`,
    `${base}${qPrefixId}.png`,
    `${base}${qPrefixId}.jpg`,
    `${base}${qPrefixId}.jpeg`,
  ];

  return candidates
    .map((p) => resolveAssetPath(p))
    .filter((u) => typeof u === "string" && u.length > 0);
}

/**
 * Set an <img> src with a single raw fallback.
 * @param {HTMLImageElement|null} imgEl
 * @param {string[]} urls
 * @param {string} alt
 */
function setImageWithFallback(imgEl, paths, alt) {
  if (!imgEl) return;
  const list = Array.isArray(paths) ? paths.filter(Boolean) : [];
  const primaryPath = list[0] || "";
  imgEl.alt = alt || "";
  if (!primaryPath) {
    imgEl.removeAttribute("src");
    imgEl.removeAttribute("data-asset-src");
    return;
  }

  const version = state.test?.updatedAt ? String(state.test.updatedAt) : "";
  let fallbackTried = false;
  imgEl.onerror = () => {
    if (fallbackTried) {
      imgEl.removeAttribute("src");
      imgEl.removeAttribute("data-asset-src");
      return;
    }
    fallbackTried = true;
    imgEl.removeAttribute("src");
    imgEl.removeAttribute("data-asset-resize");
    imgEl.removeAttribute("srcset");
    imgEl.removeAttribute("sizes");
    imgEl.setAttribute("data-asset-src", primaryPath);
    if (version) imgEl.setAttribute("data-asset-version", version);
    hydrateAssetElement(imgEl);
  };

  imgEl.removeAttribute("src");
  imgEl.removeAttribute("srcset");
  imgEl.removeAttribute("sizes");
  imgEl.setAttribute("data-asset-src", primaryPath);
  if (version) imgEl.setAttribute("data-asset-version", version);
  imgEl.setAttribute("data-asset-resize", QUESTION_IMAGE_RESIZE);
  imgEl.setAttribute("data-asset-srcset", "480");
  imgEl.setAttribute("data-asset-sizes", "(max-width: 476px) 70vw, 350px");
  imgEl.setAttribute("loading", "eager");
  imgEl.setAttribute("fetchpriority", "high");
  hydrateAssetElement(imgEl);
}

function renderError(message) {
  if (dom.image) {
    dom.image.alt = message || "오류";
    dom.image.removeAttribute("src");
  }
  if (dom.options) {
    dom.options.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = message || "테스트를 불러올 수 없습니다.";
    dom.options.appendChild(p);
  }
}

function ensureProgressFill() {
  if (!dom.progress) return null;
  let fill = dom.progress.querySelector(".ProgressFill");
  if (!fill) {
    fill = document.createElement("div");
    fill.className = "ProgressFill";
    dom.progress.innerHTML = "";
    dom.progress.appendChild(fill);
  }
  return fill;
}

function setProgressVisibility(show) {
  if (!dom.progress) return;
  const container = dom.progress.closest(".ProgressBar");
  const target = container || dom.progress;
  target.style.display = show ? "" : "none";
}

function toggleResultFooter(show) {
  const shouldShow = Boolean(show);
  const footer =
    document.querySelector(".QuizFooter") || document.querySelector("footer");
  if (!footer) return;
  footer.style.display = shouldShow ? "" : "none";
}

/** Pure: progress percent from current index and total. */
function computeProgressPercent(index, total) {
  if (total === 0) return 0;
  return Math.min(100, Math.round(((index + 1) / total) * 100));
}

function updateProgressBar(index, total) {
  const fill = ensureProgressFill();
  if (!fill || !dom.progress) return;
  const percent = computeProgressPercent(index, total);
  fill.style.width = `${percent}%`;
  fill.style.setProperty("--quiz-progress", `${percent}%`);
  dom.progress.setAttribute("aria-valuemin", "0");
  dom.progress.setAttribute("aria-valuemax", "100");
  dom.progress.setAttribute("aria-valuenow", String(percent));
  dom.progress.title = `진행률 ${percent}%`;
}

function renderQuestion() {
  const question =
    (
      Array.isArray(state.test?.questions) &&
      state.test.questions[state.currentIndex]
    ) ?
      state.test.questions[state.currentIndex]
    : null;

  if (!question) {
    renderError("질문 데이터를 찾지 못했습니다.");
    return;
  }

  toggleResultFooter(false);
  setProgressVisibility(true);
  updateProgressBar(state.currentIndex, state.totalQuestions);

  if (dom.image) {
    const alt = question.id || `문항 ${state.currentIndex + 1}`;
    const candidates = getQuestionImageUrlCandidates(state.test?.id, question);
    setImageWithFallback(dom.image, candidates, alt);
  }

  // NOTE: We intentionally avoid aggressive prefetching here.
  // Some environments can return 503 for `/cdn-cgi/image` under bursty loads.

  if (!dom.options) return;
  dom.options.innerHTML = "";

  const answers = Array.isArray(question.answers) ? question.answers : [];

  if (!answers.length) {
    const empty = document.createElement("p");
    empty.textContent = "선택지가 준비되지 않았습니다.";
    dom.options.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  answers.forEach((answer, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `select${idx + 1}`;
    // Backward compatible with legacy data fields.
    btn.textContent = answer.answer || answer.label || `문항 ${idx + 1}`;
    btn.addEventListener("click", () => handleAnswer(answer));
    frag.appendChild(btn);
  });
  dom.options.appendChild(frag);
}

function initializeStateFromTestJson(testJson) {
  if (!testJson) {
    renderError("테스트 데이터를 찾을 수 없습니다.");
    return false;
  }

  const questions = buildShuffledQuestions(testJson.questions);
  const total = Array.isArray(questions) ? questions.length : 0;

  if (!total) {
    renderError("문항이 없습니다.");
    return false;
  }

  setQuizState({
    test: { ...testJson, questions },
    totalQuestions: total,
    currentIndex: 0,
    scores: {},
    answers: [],
  });

  injectFirstQuestionPreload();

  renderQuestion();
  return true;
}

/** Inject preload for first question image to improve LCP (Image.md B.1). */
function injectFirstQuestionPreload() {
  try {
    const firstQuestion = state.test?.questions?.[0];
    if (!firstQuestion || typeof document === "undefined") return;
    const firstPath = getQuestionImageUrlCandidates(
      state.test?.id,
      firstQuestion,
    )[0];
    if (!firstPath) return;
    const version = state.test?.updatedAt ? String(state.test.updatedAt) : "";
    const resizeRaw = `width=480,${QUESTION_IMAGE_RESIZE_BASE}`;
    const url =
      typeof window.buildAssetUrl === "function" ?
        window.buildAssetUrl(firstPath, resizeRaw, version)
      : "";
    if (!url) return;
    const key = `quiz-first:${firstPath}|${version}`;
    const already = [
      ...document.querySelectorAll("link[data-preload-key]"),
    ].some((el) => el.getAttribute("data-preload-key") === key);
    if (already) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = url;
    link.setAttribute("data-preload-key", key);
    try {
      link.fetchPriority = "high";
    } catch (e) {}
    document.head.appendChild(link);
  } catch (e) {
    // Best-effort only.
  }
}

function recordScore(answer) {
  const axis = answer.mbtiAxis;
  const dir = answer.direction;
  if (!axis || !dir) return;

  const prevAxis = state.scores[axis] || {};
  const prevCount = prevAxis[dir] || 0;
  setQuizState({
    scores: {
      ...state.scores,
      [axis]: { ...prevAxis, [dir]: prevCount + 1 },
    },
  });
}

function handleAnswer(answer) {
  setQuizState({ answers: [...state.answers, answer] });
  recordScore(answer);

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.totalQuestions) {
    void renderResult();
    return;
  }

  setQuizState({ currentIndex: nextIndex });
  renderQuestion();
}

/** Pure: derive 4-letter MBTI from state.scores (no mutation). */
function computeMbti() {
  const axes = [
    ["E", "I"],
    ["S", "N"],
    ["T", "F"],
    ["J", "P"],
  ];
  return axes
    .map(([first, second]) => {
      const key = `${first}${second}`;
      const scores = state.scores[key] || {};
      const firstScore = scores[first] || 0;
      const secondScore = scores[second] || 0;
      return firstScore >= secondScore ? first : second;
    })
    .join("");
}

/** Pure: E/S/T/J percentages from state.scores (immutable build). */
function computePercentagesFromScores() {
  const pairs = [
    ["EI", "E", "I"],
    ["SN", "S", "N"],
    ["TF", "T", "F"],
    ["JP", "J", "P"],
  ];
  return pairs.reduce(
    (acc, [axis, first, second]) => {
      const scores = state.scores[axis] || {};
      const firstScore = Number(scores[first] || 0);
      const secondScore = Number(scores[second] || 0);
      const total = firstScore + secondScore;
      if (total <= 0) return acc;
      return {
        ...acc,
        [first]: Math.round((firstScore / total) * 100),
      };
    },
    { E: 50, S: 50, T: 50, J: 50 },
  );
}

async function computeMbtiOnEdge() {
  const testId = state.test?.id;
  if (!testId || !Array.isArray(state.answers) || !state.answers.length)
    return null;
  const payload = {
    answers: state.answers.map((answer) => ({
      mbtiAxis: answer?.mbtiAxis,
      direction: answer?.direction,
    })),
  };
  try {
    const response = await fetch(
      `/api/tests/${encodeURIComponent(testId)}/compute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) return null;
    const body = await response.json();
    return {
      mbti: typeof body?.mbti === "string" ? body.mbti : "",
      percentages:
        body?.percentages && typeof body.percentages === "object" ?
          body.percentages
        : null,
    };
  } catch (err) {
    return null;
  }
}

async function renderResult() {
  const edgeComputed = await computeMbtiOnEdge();
  const mbti = edgeComputed?.mbti || computeMbti();
  if (!mbti) {
    renderError("결과를 계산하지 못했습니다.");
    return;
  }

  const percentages =
    edgeComputed?.percentages || computePercentagesFromScores();
  goToResultPage(mbti, percentages);
}

async function shareCurrentTest(test) {
  const shareUrl = window.location.href;
  const title = test?.title || "MBTI ZOO 테스트";
  try {
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
  } catch (err) {
    console.error("공유하기 실패:", err);
    alert("공유하기를 진행할 수 없습니다. 링크를 직접 복사해주세요.");
  }
}

async function loadTestData() {
  const testId = getTestIdFromQuery();
  if (!testId) {
    renderError("testId 파라미터가 없습니다.");
    return;
  }

  const cached = readCachedTestJson(testId);
  if (cached && initializeStateFromTestJson(cached)) {
    return;
  }

  try {
    const apiBase = window.API_TESTS_BASE || "/api/tests";
    const dataRes = await fetch(`${apiBase}/${encodeURIComponent(testId)}`);
    if (!dataRes.ok) throw new Error("테스트 데이터 로딩 실패");
    const data = await dataRes.json();

    persistTestJson(testId, data);
    initializeStateFromTestJson(data);
  } catch (error) {
    console.error("테스트 퀴즈 로딩 오류:", error);
    renderError("테스트 정보를 불러오지 못했습니다.");
  }
}

document.addEventListener("DOMContentLoaded", loadTestData);
