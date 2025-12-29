// src/scripts/legacy/testresult.js
var dom = {
  thumbnailEl: document.querySelector(".ResultShellImg img"),
  titleEl: document.querySelector(".ResultShellTextBox h2"),
  startBtn: document.querySelector(".ResultBtnShell .Restart button"),
  shareBtn: document.querySelector(".ResultBtnShell .TestShare button")
};
var ASSETS_BASE = window.ASSETS_BASE || "";
var assetUrl = window.assetUrl || ((path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  let clean = String(path).replace(/^\.?\/+/, "");
  clean = clean.replace(/^assets\/+/i, "");
  return `${ASSETS_BASE}/${clean}`.replace(/\/{2,}/g, "/");
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
  if (dom.titleEl) dom.titleEl.textContent = "\uACB0\uACFC\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";
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
  const shareTitle = title ? `${title} - ${mbti}` : `MBTI \uACB0\uACFC ${mbti}`;
  if (navigator.share) {
    await navigator.share({
      title: shareTitle,
      text: shareTitle,
      url: shareUrl
    });
    return;
  }
  await navigator.clipboard.writeText(shareUrl);
  alert("\uB9C1\uD06C\uAC00 \uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
}
function renderResultPage(data, mbti) {
  const code = mbti;
  if (!data || !code) {
    renderError("\uACB0\uACFC \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    return;
  }
  const resultData = data.outcome;
  const resultImage = resolveAssetPath(resultData?.image);
  if (dom.thumbnailEl) {
    if (resultImage) dom.thumbnailEl.src = resultImage;
    dom.thumbnailEl.alt = code ? `${code} \uACB0\uACFC` : "\uACB0\uACFC \uC774\uBBF8\uC9C0";
  }
  if (dom.titleEl) {
    const titleText = data.title ? `${data.title} - ${code}` : `\uACB0\uACFC ${code}`;
    dom.titleEl.textContent = titleText;
    document.title = titleText;
  }
  setupButtons(data.id, code, data.title);
}
async function loadResultData() {
  const testId = getParam("testId");
  const mbti = (getParam("code") || getParam("result") || "").trim();
  document.body.classList.add("ResultPage");
  if (!testId || !mbti) {
    renderError("\uC798\uBABB\uB41C \uC811\uADFC\uC785\uB2C8\uB2E4. \uD14C\uC2A4\uD2B8\uC640 \uACB0\uACFC\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.");
    return;
  }
  try {
    const apiBase = window.API_TESTS_BASE || "/api/tests";
    const url = new URL(`${apiBase}/${encodeURIComponent(testId)}/outcome`, window.location.href);
    url.searchParams.set("code", mbti);
    const dataRes = await fetch(url.toString());
    if (!dataRes.ok) throw new Error("\uD14C\uC2A4\uD2B8 \uB370\uC774\uD130 \uB85C\uB529 \uC2E4\uD328");
    const data = await dataRes.json();
    renderResultPage(data, mbti);
  } catch (err) {
    console.error("\uACB0\uACFC \uD398\uC774\uC9C0 \uB85C\uB529 \uC624\uB958:", err);
    renderError("\uACB0\uACFC \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
}
document.addEventListener("DOMContentLoaded", loadResultData);
//# sourceMappingURL=testresult.js.map
