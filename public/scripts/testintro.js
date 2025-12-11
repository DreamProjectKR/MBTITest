const header = document.querySelector(".Head");
const headerScroll = document.querySelector("header");
const headerOffset = header ? header.offsetTop : 0;
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
    if (data.thumbnail) thumbnailEl.src = assetUrl(data.thumbnail);
    if (data.title) thumbnailEl.alt = data.title;
  }

  renderTags(tagsEl, data.tags);

  if (titleEl && data.title) titleEl.textContent = data.title;

  const authorName = data.author;

  if (authorImgEl) {
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
