/**
 * Quiz page controller (`public/testquiz.html` -> `public/scripts/testquiz.js`).
 *
 * High-level flow:
 * - Load test JSON via `GET /api/tests/:id`
 * - Shuffle questions/answers (optional)
 * - Render question prompt image + two answer buttons
 * - Track scores and compute MBTI
 * - Navigate to `testresult.html?testId=...&result=MBTI`
 */
const state = {
  test: null,
  currentIndex: 0,
  totalQuestions: 0,
  scores: {},
  answers: [],
};

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

// `config.js` usually defines `window.ASSETS_BASE` and `window.assetUrl`.
// Production default: same-origin `/assets/*` (served by Pages Functions proxy).
const ASSETS_BASE = window.ASSETS_BASE || "";
const assetUrl =
  window.assetUrl ||
  ((path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    let clean = String(path).replace(/^\.?\/+/, "");
    clean = clean.replace(/^assets\/+/i, "");
    return `${ASSETS_BASE}/${clean}`.replace(/\/{2,}/g, "/");
  });
const ICONS = {
  instagram: assetUrl("assets/images/instagram.png"),
  katalk: assetUrl("assets/images/katalk.png"),
  naver: assetUrl("assets/images/naver.png"),
  mail: assetUrl("assets/images/mail.png"),
};

const TEST_JSON_CACHE_PREFIX = "mbtitest:testdata:";

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

/**
 * Generate a random integer in [0, maxExclusive).
 * Uses `crypto.getRandomValues` when available for better randomness.
 * @param {number} maxExclusive
 * @returns {number}
 */
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

/**
 * In-place Fisher-Yates shuffle.
 * @template T
 * @param {T[]} list
 * @returns {T[]}
 */
function shuffleInPlace(list) {
  if (!Array.isArray(list) || list.length <= 1) return list;
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

/**
 * Clone questions/answers and shuffle them so each run feels fresh.
 * @param {any[]} questions
 * @returns {any[]}
 */
function buildShuffledQuestions(questions) {
  const base = Array.isArray(questions) ? questions : [];
  const copied = base.map((q) => {
    const answers = Array.isArray(q?.answers) ? [...q.answers] : [];
    return { ...q, answers };
  });

  shuffleInPlace(copied);
  copied.forEach((q) => shuffleInPlace(q.answers));
  return copied;
}

function goToResultPage(mbti) {
  const testId = state.test?.id;
  if (!testId || !mbti) {
    renderError("결과를 계산하지 못했습니다.");
    return;
  }

  const url = new URL("./testresult.html", window.location.href);
  url.searchParams.set("testId", testId);
  url.searchParams.set("result", mbti);
  window.location.href = url.toString();
}

function getTestIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("testId");
  return id ? decodeURIComponent(id) : "";
}

function resolveAssetPath(relative) {
  return assetUrl(relative);
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

function updateProgressBar(index, total) {
  const fill = ensureProgressFill();
  if (!fill || !dom.progress) return;
  const percent =
    total === 0 ? 0 : Math.min(100, Math.round(((index + 1) / total) * 100));
  fill.style.width = `${percent}%`;
  fill.style.setProperty("--quiz-progress", `${percent}%`);
  dom.progress.setAttribute("aria-valuemin", "0");
  dom.progress.setAttribute("aria-valuemax", "100");
  dom.progress.setAttribute("aria-valuenow", String(percent));
  dom.progress.title = `진행률 ${percent}%`;
}

function renderQuestion() {
  const question =
    Array.isArray(state.test?.questions) &&
    state.test.questions[state.currentIndex]
      ? state.test.questions[state.currentIndex]
      : null;

  if (!question) {
    renderError("질문 데이터를 찾지 못했습니다.");
    return;
  }

  toggleResultFooter(false);
  setProgressVisibility(true);
  updateProgressBar(state.currentIndex, state.totalQuestions);

  if (dom.image) {
    dom.image.src = resolveAssetPath(question.prompt) || "#";
    dom.image.alt = question.id || `문항 ${state.currentIndex + 1}`;
  }

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
    btn.textContent = answer.label || `문항 ${idx + 1}`;
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

  state.test = { ...testJson, questions };
  state.totalQuestions = total;
  state.currentIndex = 0;
  state.scores = {};
  state.answers = [];

  renderQuestion();
  return true;
}

function recordScore(answer) {
  const axis = answer.mbtiAxis;
  const dir = answer.direction;
  if (!axis || !dir) return;

  if (!state.scores[axis]) state.scores[axis] = {};
  state.scores[axis][dir] = (state.scores[axis][dir] || 0) + 1;
}

function handleAnswer(answer) {
  state.answers.push(answer);
  recordScore(answer);

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.totalQuestions) {
    renderResult();
    return;
  }

  state.currentIndex = nextIndex;
  renderQuestion();
}

function computeMbti() {
  const axes = [
    ["E", "I"],
    ["S", "N"],
    ["T", "F"],
    ["J", "P"],
  ];

  let result = "";
  axes.forEach(([first, second]) => {
    const key = `${first}${second}`;
    const scores = state.scores[key] || {};
    const firstScore = scores[first] || 0;
    const secondScore = scores[second] || 0;
    result += firstScore >= secondScore ? first : second;
  });

  return result;
}

function renderResult() {
  const mbti = computeMbti();
  if (!mbti) {
    renderError("결과를 계산하지 못했습니다.");
    return;
  }

  goToResultPage(mbti);
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
