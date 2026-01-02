/**
 * Home page controller (`public/index.html` -> `public/scripts/main.js`).
 *
 * What it does:
 * - Fetches the test index from the API (`/api/tests`).
 * - Renders two sections (newest/top) and wires up clicks to `testintro.html?testId=...`.
 * - Handles the sticky header UI on scroll.
 */
const header = document.getElementById("header");
const headerScroll = document.getElementById("headerScroll");
const MainTop = document.getElementById("MainTop");
/**
 * Resolve an asset path into a browser URL.
 * Keep this dynamic because Rocket Loader can delay `config.js`.
 * @param {string} path
 * @returns {string}
 */
function assetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window !== "undefined" && typeof window.assetUrl === "function") {
    return window.assetUrl(path);
  }
  const base = String(
    typeof window !== "undefined" && window.ASSETS_BASE ? window.ASSETS_BASE : "/assets",
  ).replace(/\/+$/, "");
  let clean = String(path).replace(/^\.?\/+/, "");
  clean = clean.replace(/^assets\/+/i, "");
  return `${base}/${clean}`.replace(/\/{2,}/g, "/");
}

function assetResizeUrl(path, options) {
  if (typeof window !== "undefined" && typeof window.assetResizeUrl === "function") {
    return window.assetResizeUrl(path, options || {});
  }
  return assetUrl(path);
}

// 헤더 원래 위치 저장 (스크롤로 fixed 전환 시 기준점)
const headerOffset = header.offsetTop;

window.addEventListener(
  "scroll",
  () => {
  if (window.scrollY > headerOffset) {
    header.classList.add("fixed-header", "bg-on");
  } else {
    header.classList.remove("fixed-header", "bg-on");
  }
  },
  { passive: true },
);

// ----- 유틸: 썸네일 경로 보정 -----
function resolveThumbnailPath(thumbnail) {
  if (!thumbnail) return "#";
  if (thumbnail.startsWith("http")) return thumbnail;
  return assetUrl(thumbnail);
}

// ----- 카드 DOM 생성 -----
function createTestCard(test, variantClass, opts = {}) {
  const shell = document.createElement("div");
  shell.className = `NewTestShell ${variantClass}`;

  const card = document.createElement("div");
  card.className = "NewTest";

  const img = document.createElement("img");
  const size =
    variantClass === "newtest"
      ? { width: 780, quality: 88, fit: "cover", format: "auto" }
      : { width: 520, quality: 78, fit: "cover", format: "auto" };
  // Single place for asset URL building: `config.js` hydrates `data-asset-*` into real URLs.
  if (test.thumbnail) {
    img.setAttribute("data-asset-src", String(test.thumbnail));
    img.setAttribute(
      "data-asset-resize",
      `width=${size.width},quality=${size.quality},fit=${size.fit},format=${size.format}`,
    );
  }
  img.alt = test.title || "테스트 이미지";
  img.decoding = "async";
  try {
    img.loading = opts.isFirst ? "eager" : "lazy";
  } catch (e) {}
  try {
    if (opts.isFirst) img.fetchPriority = "high";
  } catch (e) {}

  const title = document.createElement("h4");
  title.textContent = test.title || "테스트 이름";

  const tagBox = document.createElement("div");
  tagBox.className = "NewTestHashTag";
  const tags = Array.isArray(test.tags) ? test.tags : [];
  tagBox.innerHTML = tags
    .slice(0, 3)
    .map((tag) => `<span class="HashTag">#${tag}</span>`)
    .join("");

  card.appendChild(img);
  card.appendChild(title);
  card.appendChild(tagBox);
  shell.appendChild(card);

  // 카드 클릭 시 이동
  shell.onclick = () => {
    const dest = `testintro.html?testId=${encodeURIComponent(test.id || "")}`;
    window.location.href = dest;
  };

  return shell;
}

// ----- 테스트 목록 불러오기 (default: /api/tests) -----
async function fetchTestsAjax() {
  if (typeof window.getTestIndex === "function") {
    const data = await window.getTestIndex();
    return Array.isArray(data?.tests) ? data.tests : [];
  }
  const url = window.TEST_INDEX_URL || "/api/tests";
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + " 요청 실패: " + res.status);
  const data = await res.json();
  return Array.isArray(data?.tests) ? data.tests : [];
}

// ----- 중복 제거 + 최신순 정렬 -----
function normalizeTests(tests) {
  const seen = new Set();
  const deduped = [];
  for (const t of tests) {
    const key = `${t.id}-${t.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }
  deduped.sort((a, b) => {
    const ad = new Date(a.updatedAt || a.createdAt || 0);
    const bd = new Date(b.updatedAt || b.createdAt || 0);
    return bd - ad; // 최신 우선
  });
  // Keep raw `thumbnail` path (e.g. `assets/test-x/images/thumbnail.png`).
  // `config.js` will resolve and (in production) resize it consistently.
  return deduped;
}

// ----- 섹션별로 순서대로 채우기 -----
function renderSections(tests) {
  const newTestLists = document.querySelectorAll(".NewTestList");
  const newSection = newTestLists[0];
  const topSection = newTestLists[1];

  if (!newSection || !topSection) return;

  const newShellContainer = newSection.querySelector(".NewTestListShell");
  const topShellContainer = topSection.querySelector(".NewTestListShell");

  if (newShellContainer) newShellContainer.innerHTML = "";
  if (topShellContainer) topShellContainer.innerHTML = "";

  // newtest 섹션: 최대 4개
  const newTests = tests.slice(0, Math.min(4, tests.length));
  newTests.forEach((test, idx) => {
    if (newShellContainer) {
      newShellContainer.appendChild(createTestCard(test, "newtest", { isFirst: idx === 0 }));
    }
  });

  // toptest 섹션: 최대 8개
  const topTests = tests.slice(0, Math.min(8, tests.length));
  topTests.forEach((test) => {
    if (topShellContainer) {
      topShellContainer.appendChild(createTestCard(test, "toptest"));
    }
  });
}

// ----- 초기화 -----
function initTestSectionsAjax() {
  fetchTestsAjax()
    .then(normalizeTests)
    .then(renderSections)
    .catch((err) => console.error("테스트 목록 로딩 실패:", err));
}

document.addEventListener("DOMContentLoaded", initTestSectionsAjax);
