const header = document.getElementById('header');
const headerScroll = document.getElementById('headerScroll');
const MainTop = document.getElementById('MainTop');
// index.json은 스크립트 위치 기준으로 찾도록 고정 경로를 계산
const INDEX_JSON_URL = new URL('../assets/index.json', import.meta.url).href;

// ----- 정적 에셋 경로 보정 -----
function resolveStaticAsset(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

function ensureStaticImages() {
  // 헤더 로고
  const logoImg = document.querySelector('.Logo img');
  if (logoImg) {
    logoImg.src = resolveStaticAsset('../images/mainLogo.png');
  }

  // 메인 배너
  const mainBanner = document.querySelector('.MainBanner img');
  if (mainBanner) {
    mainBanner.src = resolveStaticAsset('../images/mainbanner.png');
  }

  // NEW / TOP 타이틀 아이콘
  const newIcon = document.querySelector('.NewTestListTittle img:not(.fire)');
  if (newIcon) {
    newIcon.src = resolveStaticAsset('../images/new.png');
  }
  const fireIcon = document.querySelector('.NewTestListTittle .fire');
  if (fireIcon) {
    fireIcon.src = resolveStaticAsset('../images/fire.png');
  }

  // 푸터 아이콘들 (DOM 순서대로 instagram, katalk, naver, mail)
  const footerIcons = Array.from(document.querySelectorAll('footer .icon'));
  const footerAssets = ['instagram', 'katalk', 'naver', 'mail'];
  footerIcons.forEach((img, idx) => {
    const name = footerAssets[idx];
    if (!name) return;
    img.src = resolveStaticAsset(`../images/${name}.png`);
  });
}

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    console.log('스크롤내렸다.');
    header.classList.add('scrolled');
    headerScroll.style.backgroundColor = 'transparent';
    MainTop.style.marginTop = '142px';
  } else {
    console.log('스크롤올렸다.');
    header.classList.remove('scrolled');
    headerScroll.style.backgroundColor = '#ffffff';
    MainTop.style.marginTop = '0px';
  }
});

// ----- 유틸: 썸네일 경로 보정 -----
function resolveThumbnailPath(thumbnail) {
  if (!thumbnail) return '#';
  if (thumbnail.startsWith('http')) return thumbnail;
  if (thumbnail.startsWith('./')) return thumbnail;
  if (thumbnail.startsWith('.assets')) return `./${thumbnail.slice(1)}`;
  if (thumbnail.startsWith('assets/')) return `./${thumbnail}`;
  return thumbnail;
}

// ----- 카드 DOM 생성 -----
function createTestCard(test, variantClass) {
  const shell = document.createElement('div');
  shell.className = `NewTestShell ${variantClass}`;

  const card = document.createElement('div');
  card.className = 'NewTest';

  const img = document.createElement('img');
  img.src = resolveThumbnailPath(test.thumbnail);
  img.alt = test.title || '테스트 이미지';

  const title = document.createElement('h4');
  title.textContent = test.title || '테스트 이름';

  const tagBox = document.createElement('div');
  tagBox.className = 'NewTestHashTag';
  const tags = Array.isArray(test.tags) ? test.tags : [];
  tagBox.innerHTML = tags
    .slice(0, 3)
    .map((tag) => `<span class="HashTag">#${tag}</span>`)
    .join('');

  card.appendChild(img);
  card.appendChild(title);
  card.appendChild(tagBox);
  shell.appendChild(card);

  // 카드 클릭 시 이동
  shell.onclick = () => {
    const dest = `testintro.html?testId=${encodeURIComponent(test.id || '')}`;
    window.location.href = dest;
  };

  return shell;
}

// ----- AJAX로 테스트 목록 불러오기 -----
function fetchTestsAjax() {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', INDEX_JSON_URL, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = xhr.responseText || '';
          const trimmed = body.trim();
          // SPA 서버 등에서 404 시 index.html(HTML)로 응답하는 경우를 방지
          if (trimmed.startsWith('<')) {
            reject(
              new Error(
                'index.json 응답이 HTML입니다. 정적 경로를 확인하세요: ' +
                  INDEX_JSON_URL,
              ),
            );
            return;
          }

          const data = JSON.parse(body);
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
  const newTestLists = document.querySelectorAll('.NewTestList');
  const newSection = newTestLists[0];
  const topSection = newTestLists[1];

  if (!newSection || !topSection) return;

  const newShellContainer = newSection.querySelector('.NewTestListShell');
  const topShellContainer = topSection.querySelector('.NewTestListShell');

  if (newShellContainer) newShellContainer.innerHTML = '';
  if (topShellContainer) topShellContainer.innerHTML = '';
  // toptest: 4개씩 2줄(최대 8개) 보이도록 래핑
  if (topShellContainer) {
    topShellContainer.style.flexWrap = 'wrap';
    topShellContainer.style.rowGap = '0px';
    topShellContainer.style.columnGap = '0px';
  }

  // newtest 섹션: 최대 4개
  const newTests = tests.slice(0, Math.min(4, tests.length));
  newTests.forEach((test) => {
    if (newShellContainer) {
      newShellContainer.appendChild(createTestCard(test, 'newtest'));
    }
  });

  // toptest 섹션: 최대 8개
  const topTests = tests.slice(0, Math.min(8, tests.length));
  topTests.forEach((test) => {
    if (topShellContainer) {
      topShellContainer.appendChild(createTestCard(test, 'toptest'));
    }
  });
}

// ----- 초기화 -----
function initTestSectionsAjax() {
  fetchTestsAjax()
    .then(normalizeTests)
    .then(renderSections)
    .catch((err) => console.error('테스트 목록 로딩 실패:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  ensureStaticImages();
  initTestSectionsAjax();
});
