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

function buildDataUrl(relativePath) {
  if (!relativePath) return null;
  const cleanPath = relativePath
    .replace(/^\.?\/?assets\//, '')
    .replace(/^\.\//, '');
  return `./assets/${cleanPath}`;
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
  try {
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
  } catch (err) {
    console.error('결과 공유 실패:', err);
    alert('공유를 진행할 수 없습니다. 링크를 직접 복사해주세요.');
  }
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
    const indexRes = await fetch('./assets/index.json');
    if (!indexRes.ok) throw new Error('테스트 목록 로딩 실패');
    const indexData = await indexRes.json();

    const tests = Array.isArray(indexData?.tests) ? indexData.tests : [];
    const targetTest = tests.find((item) => item.id === testId);

    if (!targetTest || !targetTest.path) {
      renderError('해당 테스트를 찾을 수 없습니다.');
      return;
    }

    const dataUrl = buildDataUrl(targetTest.path);
    if (!dataUrl) {
      renderError('테스트 데이터 경로가 없습니다.');
      return;
    }

    const dataRes = await fetch(dataUrl);
    if (!dataRes.ok) throw new Error('테스트 데이터 로딩 실패');
    const data = await dataRes.json();

    const mergedData = {
      ...targetTest,
      ...data,
      author: targetTest.author ?? data.author,
      authorImg: targetTest.authorImg ?? data.authorImg,
    };

    const baseDir = deriveBaseDir(targetTest.path);
    renderResultPage(mergedData, mbti, baseDir);
  } catch (err) {
    console.error('결과 페이지 로딩 오류:', err);
    renderError('결과 정보를 불러오지 못했습니다.');
  }
}

document.addEventListener('DOMContentLoaded', loadResultData);
