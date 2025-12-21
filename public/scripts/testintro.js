/**
 * Test intro page controller (`public/testintro.html` -> `public/scripts/testintro.js`).
 *
 * What it does:
 * - Reads `testId` from the query string.
 * - Fetches test JSON via `GET /api/tests/:id`.
 * - Renders thumbnail/tags/author/description and wires Start/Share buttons.
 * - Warms browser cache by preloading images referenced in the test JSON.
 */
const header = document.querySelector(".Head");
const headerScroll = document.querySelector("header");
const headerOffset = header ? header.offsetTop : 0;
// NOTE: `config.js` defines `window.ASSETS_BASE` and `window.assetUrl()`.
// Production default: same-origin `/assets/*` (served by Pages Functions proxy).
const ASSETS_BASE = window.ASSETS_BASE ?? "";
const assetUrl =
  window.assetUrl ||
  ((path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const clean = String(path).replace(/^\.?\/+/, "");
    return `${ASSETS_BASE}/${clean}`;
  });

function isProbablyImagePath(v) {
  if (!v) return false;
  const s = String(v).trim();
  // Keep this conservative: only preload known image extensions.
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(s);
}

/**
 * Collect any strings that look like image paths inside a nested JSON structure.
 * This is used to preload question/result images after the intro renders.
 * @param {any} value
 * @param {Set<string>} out
 */
function collectImagePathsDeep(value, out) {
  if (!out) return;
  if (!value) return;

  if (typeof value === "string") {
    if (isProbablyImagePath(value)) out.add(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((v) => collectImagePathsDeep(v, out));
    return;
  }

  if (typeof value === "object") {
    Object.keys(value).forEach((k) => collectImagePathsDeep(value[k], out));
  }
}

function scheduleIdle(fn) {
  if (typeof window === "undefined") return;
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(fn, { timeout: 1200 });
    return;
  }
  window.setTimeout(fn, 0);
}

/**
 * Preload a list of image paths by creating `new Image()` objects.
 * This warms cache for later pages (quiz/result) without blocking initial render.
 * @param {string[]} imagePaths
 * @param {{ limit?: number }} [opts]
 */
function preloadImages(imagePaths, { limit = 60 } = {}) {
  const list = Array.isArray(imagePaths) ? imagePaths : [];
  if (!list.length) return;

  // Keep strong references so the browser doesn't GC preloads before they start.
  if (!window.__MBTI_PRELOADED_IMAGES__) window.__MBTI_PRELOADED_IMAGES__ = [];

  const max = Math.min(limit, list.length);
  for (let i = 0; i < max; i += 1) {
    const raw = list[i];
    const url = assetUrl(raw);
    if (!url) continue;
    const img = new Image();
    img.decoding = "async";
    try {
      // Hint: these are warming the cache, not critical render.
      img.fetchPriority = "low";
    } catch (e) {
      // Safari/older browsers
    }
    img.src = url;
    window.__MBTI_PRELOADED_IMAGES__.push(img);
  }
}

/**
 * Mark an <img> as critical so the browser prioritizes its fetch/decoding.
 * Best-effort: different browsers support either the property or the attribute.
 * @param {HTMLImageElement | null} imgEl
 */
function markHighPriorityImage(imgEl) {
  if (!imgEl) return;
  // Above-the-fold images: start early and decode off the main thread when possible.
  try {
    imgEl.loading = "eager";
  } catch (e) {}
  try {
    imgEl.decoding = "async";
  } catch (e) {}
  try {
    imgEl.fetchPriority = "high";
  } catch (e) {}
  try {
    imgEl.setAttribute("fetchpriority", "high");
  } catch (e) {}
}

function warmTestImagesFromTestJson(testJson) {
  // `testJson` is the parsed contents of `test.json` (fetched via /api/tests/:id on this page).
  const set = new Set();
  collectImagePathsDeep(testJson, set);
  const paths = Array.from(set);
  if (!paths.length) return;

  // Stage the preload work so the intro UI renders smoothly first.
  scheduleIdle(() => preloadImages(paths, { limit: 80 }));
}

window.addEventListener("scroll", () => {
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
});

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
    const apiBase = window.API_TESTS_BASE || "/api/tests";
    const res = await fetch(`${apiBase}/${encodeURIComponent(testId)}`);
    if (!res.ok) throw new Error("테스트 데이터 로딩 실패");
    const data = await res.json();

    setupShareButton(data);
    renderIntro(data);
    // When users land on the intro page, warm the images referenced inside test.json
    // so quiz/result screens can render without cold image fetches.
    warmTestImagesFromTestJson(data);
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

  if (thumbnailEl) {
    // LCP candidate on this page.
    markHighPriorityImage(thumbnailEl);
    if (data.thumbnail) thumbnailEl.src = assetUrl(data.thumbnail);
    if (data.title) thumbnailEl.alt = data.title;
  }

  renderTags(tagsEl, data.tags);

  if (titleEl && data.title) titleEl.textContent = data.title;

  const authorName = data.author;

  if (authorImgEl) {
    // Above-the-fold avatar: prioritize so the creator row doesn't pop in late.
    markHighPriorityImage(authorImgEl);
    if (data.authorImg) authorImgEl.src = assetUrl(data.authorImg);
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
  startBtn.addEventListener("click", () => {
    window.location.href = targetUrl;
  });
}
