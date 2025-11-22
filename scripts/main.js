const DATA_URL = '../assets/data/mbti-tests.json';
const MBTI_ORDER = [
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
  'ENFP',
];

const heroState = {
  track: null,
  prevBtn: null,
  nextBtn: null,
  index: 0,
  total: 0,
};

const feedState = {
  slider: null,
  track: null,
  prevBtn: null,
  nextBtn: null,
  offset: 0,
  step: 0,
  maxOffset: 0,
};

async function initHomepage() {
  const [
    testsGrid,
    mbtiGrid,
    mbtiGridBottom,
    mbtiFeedTrack,
    heroSliderTrack,
    heroPrev,
    heroNext,
    feedSlider,
    feedPrev,
    feedNext,
  ] = [
    document.querySelector('[data-tests-grid]'),
    document.querySelector('[data-mbti-grid]'),
    document.querySelector('[data-mbti-grid-bottom]'),
    document.querySelector('[data-mbti-feed-track]'),
    document.querySelector('[data-hero-track]'),
    document.querySelector('[data-hero-prev]'),
    document.querySelector('[data-hero-next]'),
    document.querySelector('[data-mbti-feed-slider]'),
    document.querySelector('[data-mbti-feed-prev]'),
    document.querySelector('[data-mbti-feed-next]'),
  ];

  if (
    !testsGrid ||
    !mbtiGrid ||
    !mbtiFeedTrack ||
    !heroSliderTrack ||
    !feedSlider
  ) {
    return;
  }

  heroState.track = heroSliderTrack;
  heroState.prevBtn = heroPrev;
  heroState.nextBtn = heroNext;

  feedState.slider = feedSlider;
  feedState.track = mbtiFeedTrack;
  feedState.prevBtn = feedPrev;
  feedState.nextBtn = feedNext;

  attachHeroControls();
  attachFeedControls();

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error('데이터를 불러오지 못했습니다.');
    }

    const payload = await response.json();
    const tests = payload?.tests ?? [];

    const testCards = tests.length
      ? tests.slice(0, 3)
      : Array.from({ length: 3 }, (_, idx) => ({ title: `테스트 ${idx + 1}` }));
    renderTests(testsGrid, testCards);

    if (tests[0]?.results) {
      renderMbtiGrid(mbtiGrid, mbtiGridBottom, tests[0].results);
    }

    renderForum(payload?.forumHighlights ?? []);
    renderHeroSlider(tests);
  } catch (error) {
    console.error(error);
  }
}

function attachHeroControls() {
  heroState.prevBtn?.addEventListener('click', () => moveHeroSlide(-1));
  heroState.nextBtn?.addEventListener('click', () => moveHeroSlide(1));
}

function attachFeedControls() {
  feedState.prevBtn?.addEventListener('click', () => moveFeedSlider(-1));
  feedState.nextBtn?.addEventListener('click', () => moveFeedSlider(1));
  window.addEventListener('resize', debounce(setupFeedSliderMetrics, 200));
}

function renderHeroSlider(tests) {
  if (!heroState.track) return;
  heroState.track.innerHTML = '';

  const slidesData = tests.length
    ? tests.slice(0, 4)
    : [
        { title: '슬라이드 1' },
        { title: '슬라이드 2' },
        { title: '슬라이드 3' },
      ];

  slidesData.forEach((test) => {
    const slide = document.createElement('div');
    slide.className = 'hero__slide';

    if (test.thumbnail) {
      const img = document.createElement('img');
      img.src = test.thumbnail;
      img.alt = test.title ?? '슬라이드 이미지';
      slide.appendChild(img);
    } else {
      const label = document.createElement('p');
      label.textContent = test.title || '슬라이드';
      slide.appendChild(label);
    }

    heroState.track.appendChild(slide);
  });

  heroState.total = slidesData.length;
  heroState.index = 0;
  updateHeroSlider();
}

function moveHeroSlide(delta) {
  heroState.index = clamp(
    heroState.index + delta,
    0,
    Math.max(0, heroState.total - 1),
  );
  updateHeroSlider();
}

function updateHeroSlider() {
  if (!heroState.track) return;
  heroState.track.style.transform = `translateX(-${heroState.index * 100}%)`;
  if (heroState.prevBtn) heroState.prevBtn.disabled = heroState.index === 0;
  if (heroState.nextBtn)
    heroState.nextBtn.disabled = heroState.index >= heroState.total - 1;
}

function renderTests(container, tests) {
  container.innerHTML = '';
  tests.forEach((test) => {
    const card = document.createElement('article');
    card.className = 'ds-card ds-card--test';

    const thumb = document.createElement('div');
    thumb.className = 'ds-card__thumbnail';

    const thumbInner = document.createElement('div');
    thumbInner.className = 'ds-card__thumbnail-inner';
    thumb.appendChild(thumbInner);

    const body = document.createElement('div');
    body.className = 'ds-card__body';

    const title = document.createElement('h3');
    title.textContent = test.title;
    body.appendChild(title);

    const tagLine = document.createElement('p');
    tagLine.className = 'ds-card__tags';
    tagLine.textContent = '#해시태그#해시태그#해시태그';
    body.appendChild(tagLine);

    thumb.appendChild(body);
    card.appendChild(thumb);
    container.appendChild(card);
  });
}

function renderMbtiGrid(topContainer, bottomContainer, results) {
  topContainer.innerHTML = '';
  bottomContainer.innerHTML = '';

  const topRow = MBTI_ORDER.slice(0, 8);
  const bottomRow = MBTI_ORDER.slice(8, 16);

  topRow.forEach((code) => {
    topContainer.appendChild(createBadge(code));
  });

  bottomRow.forEach((code) => {
    bottomContainer.appendChild(createBadge(code));
  });
}

function createBadge(code) {
  const item = document.createElement('li');
  item.className = 'ds-badge';
  item.innerHTML = `
    <div class="ds-badge__media"></div>
    <span class="ds-badge__label">${code}</span>
  `;
  return item;
}

function renderForum(highlights) {
  if (!feedState.track) return;
  feedState.track.innerHTML = '';

  const items = highlights.length
    ? highlights
    : [{ title: 'MBTI 관련 내용요약', ctaLabel: '이글 보러가기' }];

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'ds-card ds-card--feed';

    const media = document.createElement('div');
    media.className = 'feed-card__media';
    if (item.image) {
      media.style.backgroundImage = `url(${item.image})`;
    }
    card.appendChild(media);

    const body = document.createElement('div');
    body.className = 'ds-card__body';
    const title = document.createElement('h3');
    title.textContent = item.title;
    body.appendChild(title);
    card.appendChild(body);

    const linkWrapper = document.createElement('div');
    linkWrapper.style.cssText =
      'position: absolute; left: 198px; top: 94px; width: 73px; height: 19px; border: 1px solid #000;';
    const linkText = document.createElement('p');
    linkText.style.cssText =
      'margin: 0; position: absolute; top: 4px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #a1a1a1; white-space: nowrap;';
    linkText.textContent = `${item.ctaLabel ?? '이글 보러가기'} >`;
    linkWrapper.appendChild(linkText);
    card.appendChild(linkWrapper);

    feedState.track.appendChild(card);
  });

  setupFeedSliderMetrics();
}

function setupFeedSliderMetrics() {
  if (!feedState.track || !feedState.slider) return;
  const cards = Array.from(feedState.track.children);
  if (!cards.length) return;
  const cardWidth = cards[0].getBoundingClientRect().width;
  const trackStyles = getComputedStyle(feedState.track);
  const gap = parseInt(trackStyles.columnGap || trackStyles.gap || '0', 10);
  feedState.step = cardWidth + gap;
  const visibleWidth = feedState.slider.clientWidth;
  const totalWidth = feedState.step * cards.length - gap;
  feedState.maxOffset = Math.max(0, totalWidth - visibleWidth);
  feedState.offset = clamp(feedState.offset, 0, feedState.maxOffset);
  updateFeedSlider();
}

function moveFeedSlider(direction) {
  if (!feedState.track || feedState.step === 0) return;
  feedState.offset = clamp(
    feedState.offset + direction * feedState.step,
    0,
    feedState.maxOffset,
  );
  updateFeedSlider();
}

function updateFeedSlider() {
  if (!feedState.track) return;
  feedState.track.style.transform = `translateX(-${feedState.offset}px)`;
  if (feedState.prevBtn) feedState.prevBtn.disabled = feedState.offset === 0;
  if (feedState.nextBtn)
    feedState.nextBtn.disabled = feedState.offset >= feedState.maxOffset;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

initHomepage();
