const dom = {
  thumbnailEl: document.querySelector(".ResultShellImg img"),
  titleEl: document.querySelector(".ResultShellTextBox h2"),
  startBtn: document.querySelector(".ResultBtnShell .Restart button"),
  shareBtn: document.querySelector(".ResultBtnShell .TestShare button"),
};

const ASSETS_BASE =
  window.ASSETS_BASE || "https://pub-9394623df95a4f669f145a4ede63d588.r2.dev";
const assetUrl =
  window.assetUrl ||
  ((path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const clean = String(path).replace(/^\.?\/+/, "");
    return `${ASSETS_BASE}/${clean}`;
  });

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  return value ? decodeURIComponent(value) : "";
}

function resolveAssetPath(relative) {
  return assetUrl(relative);
}

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
  const resultImage = resolveAssetPath(resultData?.image);

  if (dom.thumbnailEl) {
    if (resultImage) dom.thumbnailEl.src = resultImage;
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

  try {
    const index =
      typeof window.getTestIndex === "function"
        ? await window.getTestIndex()
        : await (async () => {
            const indexUrl =
              window.TEST_INDEX_URL ||
              (typeof window.assetUrl === "function"
                ? window.assetUrl("assets/index.json")
                : `${ASSETS_BASE}/assets/index.json`);
            const res = await fetch(indexUrl);
            if (!res.ok)
              throw new Error(indexUrl + " 요청 실패: " + res.status);
            return res.json();
          })();

    const tests = Array.isArray(index?.tests) ? index.tests : [];
    const meta = tests.find((t) => t?.id === testId);
    if (!meta)
      throw new Error("index.json에서 testId를 찾지 못했습니다: " + testId);

    const testUrl =
      typeof window.resolveTestDataUrl === "function"
        ? window.resolveTestDataUrl(meta.path)
        : assetUrl(`assets/${String(meta.path || "").replace(/^\.?\/+/, "")}`);

    const dataRes = await fetch(testUrl);
    if (!dataRes.ok)
      throw new Error("테스트 데이터 로딩 실패: " + dataRes.status);
    const data = await dataRes.json();

    renderResultPage(data, mbti);
  } catch (err) {
    console.error("결과 페이지 로딩 오류:", err);
    renderError("결과 정보를 불러오지 못했습니다.");
  }
}

document.addEventListener("DOMContentLoaded", loadResultData);
