const header = document.getElementById("header");
const headerScroll = document.getElementById("headerScroll");
const MainTop = document.getElementById("MainTop");
const API_TESTS_URL = window.API_TESTS_BASE || "/api/tests";

const headerOffset = header.offsetTop; // 헤더 원래 위치 저장

window.addEventListener("scroll", () => {
  if (window.scrollY > headerOffset) {
    header.classList.add("fixed-header", "bg-on");
  } else {
    header.classList.remove("fixed-header", "bg-on");
  }
});

// ----- 유틸: 썸네일 경로 보정 -----
function resolveThumbnailPath(thumbnail) {
  if (!thumbnail) return "#";
  if (thumbnail.startsWith("http")) return thumbnail;
  return window.assetUrl(thumbnail);
}

// ----- 카드 DOM 생성 -----
function createTestCard(test, variantClass) {
  const shell = document.createElement("div");
  shell.className = `NewTestShell ${variantClass}`;

  const card = document.createElement("div");
  card.className = "NewTest";

  const img = document.createElement("img");
  img.src = resolveThumbnailPath(test.thumbnail);
  img.alt = test.title || "테스트 이미지";

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

// ----- 테스트 목록 불러오기 (/api/tests) -----
async function fetchTestsAjax() {
  const res = await fetch(API_TESTS_URL);
  if (!res.ok) throw new Error("/api/tests 요청 실패: " + res.status);
  const data = await res.json();
  return Array.isArray(data.tests) ? data.tests : [];
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
  return deduped.map((t) => ({
    ...t,
    thumbnail: resolveThumbnailPath(t.thumbnail),
  }));
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
  // toptest: 레이아웃을 뷰포트에 따라 조정
  if (topShellContainer) {
    const mq = window.matchMedia("(max-width: 900px)");
    const applyTopLayout = () => {
      if (mq.matches) {
        topShellContainer.style.flexWrap = "nowrap";
        topShellContainer.style.rowGap = "";
        topShellContainer.style.columnGap = "";
      } else {
        topShellContainer.style.flexWrap = "wrap";
        topShellContainer.style.rowGap = "0px";
        topShellContainer.style.columnGap = "0px";
      }
    };
    applyTopLayout();
    mq.addEventListener("change", applyTopLayout);
  }

  // newtest 섹션: 최대 4개
  const newTests = tests.slice(0, Math.min(4, tests.length));
  newTests.forEach((test) => {
    if (newShellContainer) {
      newShellContainer.appendChild(createTestCard(test, "newtest"));
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
