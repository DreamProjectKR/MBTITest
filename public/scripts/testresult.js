/**
 * Result page controller (`public/testresult.html` -> `public/scripts/testresult.js`).
 *
 * What it does:
 * - Reads `testId` and `result` (MBTI) from query string.
 * - Fetches test JSON via `GET /api/tests/:id`.
 * - Renders `results[MBTI].image`.
 * - Provides Restart + Share interactions.
 */
const dom = {
  thumbnailEl: document.querySelector(".ResultShellImg img"),
  titleEl: document.querySelector(".ResultShellTextBox h2"),
  startBtn: document.querySelector(".ResultBtnShell .Restart button"),
  shareBtn: document.querySelector(".ResultBtnShell .TestShare button"),
};

// Asset URL building is centralized in `public/scripts/config.js`.
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
    // Ignore private mode/quota issues
  }
}

/**
 * Read a URL query parameter.
 * @param {string} name
 * @returns {string}
 */
function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  return value ? decodeURIComponent(value) : "";
}

/**
 * Render a user-visible error state.
 * @param {string} message
 */
function renderError(message) {
  if (dom.titleEl) dom.titleEl.textContent = "결과를 불러올 수 없습니다.";
  if (dom.thumbnailEl) dom.thumbnailEl.removeAttribute("src");
}

function setupButtons(testId, mbti, title) {
  const restartUrl = `./testquiz.html?testId=${encodeURIComponent(testId)}`;

  if (dom.startBtn) {
    dom.startBtn.addEventListener("click", () => {
      window.location.href = restartUrl;
    });
  }

  if (dom.shareBtn) {
    dom.shareBtn.addEventListener("click", () => {
      shareResult({ mbti, title });
    });
  }
}

async function shareResult({ mbti, title }) {
  const shareUrl = window.location.href;
  const shareTitle = title ? `${title} - ${mbti}` : `MBTI 결과 ${mbti}`;
  if (navigator.share) {
    await navigator.share({
      title: shareTitle,
      text: shareTitle,
      url: shareUrl,
    });
    return;
  }
  await navigator.clipboard.writeText(shareUrl);
  alert("링크가 클립보드에 복사되었습니다.");
}

function renderResultPage(data, mbti) {
  if (!data || !mbti) {
    renderError("결과 정보를 불러오지 못했습니다.");
    return;
  }

  const resultData = data.results?.[mbti];
  const resultImage = resultData?.image ? String(resultData.image) : "";

  if (dom.thumbnailEl) {
    if (resultImage) {
      dom.thumbnailEl.removeAttribute("src");
      dom.thumbnailEl.setAttribute("data-asset-src", resultImage);
      dom.thumbnailEl.setAttribute(
        "data-asset-resize",
        "width=780,quality=90,fit=cover,format=auto",
      );
      hydrateAssetElement(dom.thumbnailEl);
    }
    dom.thumbnailEl.alt = mbti ? `${mbti} 결과` : "결과 이미지";
  }

  if (dom.titleEl) {
    const titleText = data.title ? `${data.title} - ${mbti}` : `결과 ${mbti}`;
    dom.titleEl.textContent = titleText;
    document.title = titleText;
  }

  setupButtons(data.id, mbti, data.title);
}

async function loadResultData() {
  const testId = getParam("testId");
  const mbti = getParam("result")?.toUpperCase();

  document.body.classList.add("ResultPage");

  if (!testId || !mbti) {
    renderError("잘못된 접근입니다. 테스트와 결과를 확인해주세요.");
    return;
  }

  const cached = readCachedTestJson(testId);
  if (cached) {
    renderResultPage(cached, mbti);
    return;
  }

  try {
    const apiBase = window.API_TESTS_BASE || "/api/tests";
    const dataRes = await fetch(`${apiBase}/${encodeURIComponent(testId)}`);
    if (!dataRes.ok) throw new Error("테스트 데이터 로딩 실패");
    const data = await dataRes.json();

    persistTestJson(testId, data);

    renderResultPage(data, mbti);
  } catch (err) {
    console.error("결과 페이지 로딩 오류:", err);
    renderError("결과 정보를 불러오지 못했습니다.");
  }
}

document.addEventListener("DOMContentLoaded", loadResultData);
