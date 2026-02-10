/**
 * Test list page controller (`public/testlist.html` -> `public/scripts/testlist.js`).
 *
 * What it does:
 * - Fetches test metadata from `GET /api/tests`.
 * - Renders a grid of cards (4 per row).
 * - On click, navigates to `testintro.html?testId=...`.
 */
const header = document.getElementById("header");
const headerScroll = document.getElementById("headerScroll");
const MainTop = document.getElementById("MainTop");
// Asset URLs are resolved centrally by `public/scripts/config.js` via `data-asset-*`.

const headerOffset = header.offsetTop; // 헤더 원래 위치 저장

window.addEventListener(
  "scroll",
  () => {
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (window.scrollY > headerOffset) {
      header.classList.add("fixed-header", "bg-on");
      if (isMobile && headerScroll) {
        headerScroll.style.marginBottom = "45px";
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

document.querySelector(".test1").onclick = function () {
  window.location.href = "testintro.html";
};

// index.json을 AJAX로 읽어와 테스트 카드 목록을 구성한다.
(function () {
  // ----- AJAX: /api/tests 로드 -----
  /**
   * Fetch the test list used to build the cards.
   * @returns {Promise<any[]>} Array of test metadata objects
   */
  async function fetchTestIndex() {
    if (typeof window.getTestIndex === "function") {
      const data = await window.getTestIndex();
      return Array.isArray(data?.tests) ? data.tests : [];
    }

    const url = window.TEST_INDEX_URL || "/assets/index.json";
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + " 요청 실패: " + res.status);
    const data = await res.json();
    return Array.isArray(data?.tests) ? data.tests : [];
  }

  // ----- 데이터 정규화: 중복 제거 + 최신순 정렬 -----
  /**
   * De-duplicate and sort tests (newest first).
   * @param {any[]} tests
   * @returns {any[]}
   */
  function normalizeTests(tests) {
    const seen = new Set();
    const deduped = [];
    tests.forEach((t) => {
      // Filter out unpublished tests (unless we are in some debug mode, but for now strict)
      if (!t.is_published) return;

      const key = `${t.id}-${t.path}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(t);
    });
    deduped.sort((a, b) => {
      const ad = new Date(a.updatedAt || a.createdAt || 0);
      const bd = new Date(b.updatedAt || b.createdAt || 0);
      return bd - ad; // 최신 먼저
    });
    return deduped;
  }

  // NOTE: we intentionally avoid JS-driven image preloads/prefetches here.
  // Static assets are hydrated by `config.js`; thumbnails are sized by `data-asset-resize`.

  // ----- 태그 DOM 생성 -----
  /**
   * Build hashtag DOM nodes (up to 3 tags).
   * @param {string[]} tags
   * @returns {DocumentFragment}
   */
  function buildTags(tags) {
    const frag = document.createDocumentFragment();
    if (!Array.isArray(tags)) return frag;
    tags.slice(0, 3).forEach((tag) => {
      const span = document.createElement("span");
      span.className = "HashTag";
      span.textContent = `#${tag}`;
      frag.appendChild(span);
    });
    return frag;
  }

  // ----- 카드 DOM 생성 -----
  /**
   * Build a single test card.
   * @param {any} test
   * @param {{ isFirst?: boolean }} [opts]
   */
  function buildCard(test, opts = {}) {
    const shell = document.createElement("div");
    shell.className = "NewTestShell";

    const card = document.createElement("div");
    card.className = "NewTest";

    const img = document.createElement("img");
    const sizeOptions = {
      width: opts.isFirst ? 640 : 520,
      quality: opts.isFirst ? 82 : 78,
      fit: "cover",
      format: "auto",
    };
    if (test.thumbnail) {
      img.setAttribute("data-asset-src", String(test.thumbnail));
      img.setAttribute(
        "data-asset-resize",
        `width=${sizeOptions.width},quality=${sizeOptions.quality},fit=${sizeOptions.fit},format=${sizeOptions.format},minWidth=240,maxWidth=720,fallbackWidth=${sizeOptions.width}`,
      );
      img.setAttribute("data-asset-auto-width", "true");
      img.setAttribute("data-asset-srcset", "320,480,520,640");
      img.setAttribute("data-asset-sizes", "(max-width: 900px) 72vw, 22vw");
      if (test.updatedAt) {
        img.setAttribute("data-asset-version", String(test.updatedAt));
      }
    }
    img.alt = test.title || "테스트 이미지";
    img.decoding = "async";
    // First card is most likely above the fold: prioritize it.
    if (opts.isFirst) {
      try {
        img.loading = "eager";
      } catch (e) {}
      try {
        img.fetchPriority = "high";
      } catch (e) {}
      try {
        img.setAttribute("fetchpriority", "high");
      } catch (e) {}
    } else {
      // Avoid competing with LCP for offscreen cards.
      try {
        img.loading = "lazy";
      } catch (e) {}
    }

    const title = document.createElement("h4");
    title.textContent = test.title || "테스트 이름";

    const tagBox = document.createElement("div");
    tagBox.className = "NewTestHashTag";
    tagBox.appendChild(buildTags(test.tags));

    card.appendChild(img);
    card.appendChild(title);
    card.appendChild(tagBox);
    shell.appendChild(card);

    shell.onclick = () => {
      const dest = `testintro.html?testId=${encodeURIComponent(test.id || "")}`;
      window.location.href = dest;
    };

    return shell;
  }

  // ----- 4개씩 행(row)으로 렌더링 -----
  function renderTests(tests) {
    const root = document.querySelector(".NewTestList");
    if (!root) return;

    root.innerHTML = "";

    const chunkSize = 4;
    let rendered = 0;
    for (let i = 0; i < tests.length; i += chunkSize) {
      const row = document.createElement("div");
      row.className = "NewTestListShell";

      tests.slice(i, i + chunkSize).forEach((test) => {
        const isFirst = rendered === 0;
        row.appendChild(buildCard(test, { isFirst }));
        rendered += 1;
      });

      root.appendChild(row);
    }
  }

  // ----- 초기 구동 -----
  function initTestList() {
    fetchTestIndex()
      .then(normalizeTests)
      .then((tests) => {
        renderTests(tests);
      })
      .catch((err) => console.error("테스트 목록 로딩 실패:", err));
  }

  document.addEventListener("DOMContentLoaded", initTestList);
})();
