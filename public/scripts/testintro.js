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

function getTestCacheKey(testId) {
  if (!testId) return "";
  return `${TEST_JSON_CACHE_PREFIX}${testId}`;
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

// NOTE: preloading/prefetching is intentionally removed; `config.js` is the single loader.

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
          : await fetch(window.TEST_INDEX_URL || "/assets/index.json").then((r) =>
              r.json(),
            );
      const tests = Array.isArray(index?.tests) ? index.tests : [];
      const meta = tests.find((t) => String(t?.id || "") === String(testId));
      if (!meta?.path) throw new Error("index.json에 테스트가 없습니다: " + testId);

      const resolveUrl =
        typeof window.resolveTestDataUrl === "function"
          ? window.resolveTestDataUrl
          : (rawPath) => rawPath;
      const url = resolveUrl(meta.path);

      const res2 = await fetch(url);
      if (!res2.ok) throw new Error(`테스트 데이터 로딩 실패: ${res2.status}`);
      data = await res2.json();
    }

    persistTestJson(testId, data);

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
      thumbnailEl.setAttribute("data-asset-sizes", "(max-width: 900px) 92vw, 350px");
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
  startBtn.addEventListener("click", () => {
    window.location.href = targetUrl;
  });
}
