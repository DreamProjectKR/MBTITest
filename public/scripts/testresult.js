const dom = {
  thumbnailEl: document.querySelector('.ResultShellImg img'),
  titleEl: document.querySelector('.ResultShellTextBox h2'),
  startBtn: document.querySelector('.ResultBtnShell .Restart button'),
  shareBtn: document.querySelector('.ResultBtnShell .TestShare button'),
};

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  return value ? decodeURIComponent(value) : '';
}

function deriveBaseDir(path) {
  if (!path) return '';
  const clean = path.replace(/^\.?\/?assets\//, '').replace(/^\.\//, '');
  const parts = clean.split('/');
  parts.pop();
  return parts.join('/');
}

function resolveAssetPath(relative, baseDir) {
  if (!relative) return '';
  if (/^https?:\/\//i.test(relative)) return relative;
  if (/^\.?\/?assets\//i.test(relative)) return relative.replace(/^\.\//, './');

  const clean = relative.replace(/^\.\//, '');
  const prefix = baseDir ? `${baseDir}/` : '';
  return `./assets/${prefix}${clean}`;
}

function renderError(message) {
  if (dom.titleEl) dom.titleEl.textContent = '결과를 불러올 수 없습니다.';
  if (dom.thumbnailEl) dom.thumbnailEl.removeAttribute('src');
}

function setupButtons(testId, mbti, title) {
  const restartUrl = `./testquiz.html?testId=${encodeURIComponent(testId)}`;

  if (dom.startBtn) {
    dom.startBtn.addEventListener('click', () => {
      window.location.href = restartUrl;
    });
  }

  if (dom.shareBtn) {
    dom.shareBtn.addEventListener('click', () => {
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
  alert('링크가 클립보드에 복사되었습니다.');
}

function renderResultPage(data, mbti, baseDir) {
  if (!data || !mbti) {
    renderError('결과 정보를 불러오지 못했습니다.');
    return;
  }

  const resultData = data.results?.[mbti];
  const resultImage = resolveAssetPath(resultData?.image, baseDir);

  if (dom.thumbnailEl) {
    if (resultImage) dom.thumbnailEl.src = resultImage;
    dom.thumbnailEl.alt = mbti ? `${mbti} 결과` : '결과 이미지';
  }

  if (dom.titleEl) {
    const titleText = data.title ? `${data.title} - ${mbti}` : `결과 ${mbti}`;
    dom.titleEl.textContent = titleText;
    document.title = titleText;
  }

  setupButtons(data.id, mbti, data.title);
}

async function loadResultData() {
  const testId = getParam('testId');
  const mbti = getParam('result')?.toUpperCase();

  document.body.classList.add('ResultPage');

  if (!testId || !mbti) {
    renderError('잘못된 접근입니다. 테스트와 결과를 확인해주세요.');
    return;
  }

  try {
    const apiBase = window.API_TESTS_BASE || '/api/tests';
    const dataRes = await fetch(`${apiBase}/${encodeURIComponent(testId)}`);
    if (!dataRes.ok) throw new Error('테스트 데이터 로딩 실패');
    const data = await dataRes.json();

    const baseDir = deriveBaseDir(data.path || '');
    renderResultPage(data, mbti, baseDir);
  } catch (err) {
    console.error('결과 페이지 로딩 오류:', err);
    renderError('결과 정보를 불러오지 못했습니다.');
  }
}

document.addEventListener('DOMContentLoaded', loadResultData);
