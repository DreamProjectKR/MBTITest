const header = document.getElementById('header');
const headerScroll = document.getElementById('headerScroll');
const MainTop = document.getElementById('MainTop');

const headerOffset = header.offsetTop; // 헤더 원래 위치 저장

window.addEventListener('scroll', () => {
  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  if (window.scrollY > headerOffset) {
    header.classList.add('fixed-header', 'bg-on');
    if (isMobile && headerScroll) {
      headerScroll.style.marginBottom = '45px';
    }
  } else {
    header.classList.remove('fixed-header', 'bg-on');
    if (headerScroll) {
      headerScroll.style.marginBottom = '';
    }
  }
});

document.querySelector('.test1').onclick = function () {
  window.location.href = 'testintro.html';
};

// index.json을 AJAX로 읽어와 테스트 카드 목록을 구성한다.
(function () {
  // ----- AJAX: index.json 로드 -----
  function fetchTestIndex() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', './assets/index.json', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(Array.isArray(data.tests) ? data.tests : []);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error('index.json 요청 실패: ' + xhr.status));
        }
      };
      xhr.send();
    });
  }

  // ----- 데이터 정규화: 중복 제거 + 최신순 정렬 -----
  function normalizeTests(tests) {
    const seen = new Set();
    const deduped = [];
    tests.forEach((t) => {
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

  // ----- 썸네일 경로 보정 -----
  function resolveThumbnailPath(thumbnail) {
    if (!thumbnail) return '#';
    if (thumbnail.startsWith('.assets'))
      return thumbnail.replace('.assets', './assets');
    if (thumbnail.startsWith('assets/')) return `./${thumbnail}`;
    if (thumbnail.startsWith('./') || thumbnail.startsWith('/'))
      return thumbnail;
    return `./${thumbnail}`;
  }

  // ----- 태그 DOM 생성 -----
  function buildTags(tags) {
    const frag = document.createDocumentFragment();
    if (!Array.isArray(tags)) return frag;
    tags.slice(0, 3).forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'HashTag';
      span.textContent = `#${tag}`;
      frag.appendChild(span);
    });
    return frag;
  }

  // ----- 카드 DOM 생성 -----
  function buildCard(test) {
    const shell = document.createElement('div');
    shell.className = 'NewTestShell';

    const card = document.createElement('div');
    card.className = 'NewTest';

    const img = document.createElement('img');
    img.src = resolveThumbnailPath(test.thumbnail);
    img.alt = test.title || '테스트 이미지';

    const title = document.createElement('h4');
    title.textContent = test.title || '테스트 이름';

    const tagBox = document.createElement('div');
    tagBox.className = 'NewTestHashTag';
    tagBox.appendChild(buildTags(test.tags));

    card.appendChild(img);
    card.appendChild(title);
    card.appendChild(tagBox);
    shell.appendChild(card);

    shell.onclick = () => {
      const dest = `testintro.html?testId=${encodeURIComponent(test.id || '')}`;
      window.location.href = dest;
    };

    return shell;
  }

  // ----- 4개씩 행(row)으로 렌더링 -----
  function renderTests(tests) {
    const root = document.querySelector('.NewTestList');
    if (!root) return;

    root.innerHTML = '';

    const chunkSize = 4;
    for (let i = 0; i < tests.length; i += chunkSize) {
      const row = document.createElement('div');
      row.className = 'NewTestListShell';

      tests.slice(i, i + chunkSize).forEach((test) => {
        row.appendChild(buildCard(test));
      });

      root.appendChild(row);
    }
  }

  // ----- 초기 구동 -----
  function initTestList() {
    fetchTestIndex()
      .then(normalizeTests)
      .then(renderTests)
      .catch((err) => console.error('테스트 목록 로딩 실패:', err));
  }

  document.addEventListener('DOMContentLoaded', initTestList);
})();
