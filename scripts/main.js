const DATA_URL = '../assets/data/mbti-tests.json';
const ROUTE_SEGMENTS = {
  HOME: '',
  TEST_INTRO: 'test-intro',
  TEST_QUIZ: 'test-quiz',
  TEST_RESULT: 'test-result',
};

const appState = {
  data: null,
  testsById: {},
  quizSession: null,
  main: null,
  homeSections: [],
  routeOutlet: null,
};
const MBTI_ORDER = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];

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
    feedSlider,
    feedPrev,
    feedNext,
  ] = [
    document.querySelector('[data-tests-grid]'),
    document.querySelector('[data-mbti-grid]'),
    document.querySelector('[data-mbti-grid-bottom]'),
    document.querySelector('[data-mbti-feed-track]'),
    document.querySelector('[data-mbti-feed-slider]'),
    document.querySelector('[data-mbti-feed-prev]'),
    document.querySelector('[data-mbti-feed-next]'),
  ];

  if (!testsGrid || !mbtiGrid || !mbtiFeedTrack || !feedSlider) {
    return;
  }

  feedState.slider = feedSlider;
  feedState.track = mbtiFeedTrack;
  feedState.prevBtn = feedPrev;
  feedState.nextBtn = feedNext;

  attachFeedControls();

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error('데이터를 불러오지 못했습니다.');
    }

    const payload = await response.json();
    const tests = payload?.tests ?? [];
    appState.data = payload;
    appState.testsById = indexTests(tests);

    const testCards = tests.length
      ? tests.slice(0, 3)
      : Array.from({ length: 3 }, (_, idx) => ({ title: `테스트 ${idx + 1}` }));
    renderTests(testsGrid, testCards);

    if (tests[0]?.results) {
      renderMbtiGrid(mbtiGrid, mbtiGridBottom, tests[0].results);
    }

    renderForum(payload?.forumHighlights ?? []);
    handleRouteChange();
  } catch (error) {
    console.error(error);
  }
}

function attachFeedControls() {
  feedState.prevBtn?.addEventListener('click', () => moveFeedSlider(-1));
  feedState.nextBtn?.addEventListener('click', () => moveFeedSlider(1));
  window.addEventListener('resize', debounce(setupFeedSliderMetrics, 200));
}

function renderTests(container, tests) {
  container.innerHTML = '';
  tests.forEach((test, idx) => {
    const card = document.createElement('article');
    card.className = 'ds-card ds-card--test';

    const thumb = document.createElement('div');
    thumb.className = 'ds-card__thumbnail';

    const thumbInner = document.createElement('div');
    thumbInner.className = 'ds-card__thumbnail-inner';
    if (test.thumbnail) {
      thumbInner.style.backgroundImage = `url(${test.thumbnail})`;
      thumbInner.style.backgroundSize = 'cover';
      thumbInner.style.backgroundPosition = 'center';
    }
    thumb.appendChild(thumbInner);

    const body = document.createElement('div');
    body.className = 'ds-card__body';

    const title = document.createElement('h3');
    title.textContent = test.title ?? `테스트 ${idx + 1}`;
    body.appendChild(title);

    const tagLine = document.createElement('p');
    tagLine.className = 'ds-card__tags';
    if (Array.isArray(test.tags) && test.tags.length) {
      tagLine.textContent = test.tags.join(' ');
    } else {
      tagLine.textContent = '#해시태그 #테스트';
    }
    body.appendChild(tagLine);

    thumb.appendChild(body);
    card.appendChild(thumb);

    if (test.id) {
      const goToIntro = () => navigateTo(`#/test-intro/${test.id}`);
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute(
        'aria-label',
        `${test.title ?? 'MBTI 테스트'} 소개 페이지로 이동`,
      );
      card.addEventListener('click', goToIntro);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          goToIntro();
        }
      });
    }

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
      media.style.backgroundSize = 'cover';
    }
    card.appendChild(media);

    const body = document.createElement('div');
    body.className = 'ds-card__body';

    const title = document.createElement('h3');
    title.textContent = item.title;
    body.appendChild(title);

    const link = document.createElement('a');
    link.className = 'ds-link feed-card__link';
    link.href = item.href ?? '#';
    link.textContent = `${item.ctaLabel ?? '이글 보러가기'} >`;
    body.appendChild(link);

    card.appendChild(body);
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

function bootstrapViews() {
  const mainElement = document.querySelector('.site-main');
  if (!mainElement) {
    return;
  }
  if (appState.routeOutlet) {
    return;
  }
  const homeChildren = Array.from(mainElement.children);
  const outlet = document.createElement('section');
  outlet.className = 'route-outlet';
  outlet.dataset.routeOutlet = 'true';
  outlet.setAttribute('tabindex', '-1');
  outlet.setAttribute('aria-live', 'polite');
  outlet.hidden = true;
  mainElement.appendChild(outlet);
  appState.main = mainElement;
  appState.main.dataset.view = 'home';
  appState.homeSections = homeChildren;
  appState.routeOutlet = outlet;
}

function handleRouteChange() {
  if (!appState.routeOutlet) {
    return;
  }
  const route = parseRouteFromHash(window.location.hash);
  if (!route || route.name === ROUTE_SEGMENTS.HOME) {
    showHomeView();
    return;
  }

  if (!appState.data) {
    setRouteContent(renderLoadingView());
    return;
  }

  const [testId, extraParam] = route.params ?? [];
  const test = testId ? appState.testsById[testId] : null;

  switch (route.name) {
    case ROUTE_SEGMENTS.TEST_INTRO: {
      if (!test) {
        showHomeView();
        return;
      }
      setRouteContent(renderTestIntroPage(test));
      break;
    }
    case ROUTE_SEGMENTS.TEST_QUIZ: {
      if (!test) {
        showHomeView();
        return;
      }
      setRouteContent(renderTestQuizPage(test));
      break;
    }
    case ROUTE_SEGMENTS.TEST_RESULT: {
      if (!test) {
        showHomeView();
        return;
      }
      setRouteContent(renderTestResultPage(test, extraParam));
      break;
    }
    default:
      showHomeView();
  }
}

function parseRouteFromHash(rawHash = '') {
  if (!rawHash || rawHash === '#') {
    return { name: ROUTE_SEGMENTS.HOME, params: [] };
  }
  const normalized = rawHash.replace(/^#\/?/, '');
  if (!normalized) {
    return { name: ROUTE_SEGMENTS.HOME, params: [] };
  }
  const [name, ...rest] = normalized
    .split('/')
    .map((segment) => decodeURIComponent(segment));
  if (!name) {
    return { name: ROUTE_SEGMENTS.HOME, params: [] };
  }
  return { name, params: rest };
}

function setRouteContent(contentNode) {
  if (!appState.routeOutlet) {
    return;
  }
  appState.homeSections.forEach((section) => {
    section.hidden = true;
  });
  updateMainViewState(true);
  appState.routeOutlet.hidden = false;
  appState.routeOutlet.innerHTML = '';
  if (contentNode) {
    appState.routeOutlet.appendChild(contentNode);
  }
  appState.routeOutlet.focus();
  appState.routeOutlet.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showHomeView() {
  if (!appState.routeOutlet) {
    return;
  }
  appState.homeSections.forEach((section) => {
    section.hidden = false;
  });
  appState.routeOutlet.hidden = true;
  appState.routeOutlet.innerHTML = '';
  updateMainViewState(false);
}

function updateMainViewState(isRouteView) {
  if (!appState.main) {
    return;
  }
  appState.main.dataset.view = isRouteView ? 'route' : 'home';
}

function renderLoadingView() {
  const loading = document.createElement('section');
  loading.className = 'route-section route-section--loading';
  loading.innerHTML = '<p>콘텐츠를 불러오는 중입니다...</p>';
  return loading;
}

function renderTestIntroPage(test) {
  const wrapper = document.createElement('section');
  wrapper.className = 'route-section test-intro-page';

  const media = document.createElement('div');
  media.className = 'test-page__media';
  if (test.thumbnail) {
    const img = document.createElement('img');
    img.src = test.thumbnail;
    img.alt = `${test.title ?? 'MBTI 테스트'} 썸네일`;
    media.appendChild(img);
  } else {
    media.setAttribute('data-placeholder', 'true');
    media.innerHTML = '<span>썸네일 이미지 준비 중</span>';
  }

  const content = document.createElement('div');
  content.className = 'test-page__content';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'test-page__eyebrow';
  eyebrow.textContent = '테스트 소개';
  content.appendChild(eyebrow);

  const title = document.createElement('h2');
  title.textContent = test.title ?? 'MBTI 테스트';
  content.appendChild(title);

  const description = document.createElement('p');
  description.className = 'test-page__description';
  description.textContent =
    test.description ?? '테스트 설명이 곧 업데이트될 예정입니다.';
  content.appendChild(description);

  const metaList = document.createElement('ul');
  metaList.className = 'test-meta';
  const questionMeta = document.createElement('li');
  questionMeta.innerHTML = `<strong>${
    test.questions?.length ?? 0
  }</strong> 문항`;
  const resultMeta = document.createElement('li');
  resultMeta.innerHTML = '<strong>16</strong> 가지 결과';
  metaList.append(questionMeta, resultMeta);
  content.appendChild(metaList);

  const tagsRow = createTagChips(test.tags);
  if (tagsRow) {
    content.appendChild(tagsRow);
  }

  const actions = document.createElement('div');
  actions.className = 'test-page__actions';

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'ds-button ds-button--primary';
  startBtn.textContent = '테스트 시작하기';
  startBtn.addEventListener('click', () => {
    resetQuizSession(test.id);
    navigateTo(`#/test-quiz/${test.id}`);
  });

  const homeBtn = document.createElement('button');
  homeBtn.type = 'button';
  homeBtn.className = 'ds-button ds-button--ghost';
  homeBtn.textContent = '홈으로 돌아가기';
  homeBtn.addEventListener('click', () => navigateTo('#'));

  actions.append(startBtn, homeBtn);
  content.appendChild(actions);

  wrapper.append(media, content);
  return wrapper;
}

function renderTestQuizPage(test) {
  const session = ensureQuizSession(test);
  const question = Array.isArray(test.questions)
    ? test.questions[session.currentIndex]
    : null;

  const wrapper = document.createElement('section');
  wrapper.className = 'route-section test-quiz-page';

  if (!question) {
    wrapper.innerHTML =
      '<p>질문 데이터를 찾지 못했습니다. 홈으로 돌아가 다시 시도해주세요.</p>';
    return wrapper;
  }

  const progress = document.createElement('div');
  progress.className = 'test-quiz__progress';
  const progressMeta = document.createElement('span');
  progressMeta.textContent = `문항 ${session.currentIndex + 1} / ${
    session.totalQuestions
  }`;
  const progressTrack = document.createElement('div');
  progressTrack.className = 'test-quiz__progress-track';
  const progressFill = document.createElement('div');
  progressFill.className = 'test-quiz__progress-fill';
  const percent =
    session.totalQuestions === 0
      ? 0
      : Math.round((session.currentIndex / session.totalQuestions) * 100);
  progressFill.style.setProperty('--quiz-progress', `${percent}%`);
  progressTrack.appendChild(progressFill);
  progress.append(progressMeta, progressTrack);

  const prompt = document.createElement('p');
  prompt.className = 'test-quiz__question';
  prompt.textContent = question.prompt ?? '질문을 불러올 수 없습니다.';

  const options = document.createElement('div');
  options.className = 'test-quiz__options';

  question.answers?.forEach((answer) => {
    const optionBtn = document.createElement('button');
    optionBtn.type = 'button';
    optionBtn.className = 'ds-button ds-button--secondary test-option';
    optionBtn.textContent = answer.label;
    optionBtn.addEventListener('click', () =>
      handleAnswerSelection(test, answer),
    );
    options.appendChild(optionBtn);
  });
  if (!options.children.length) {
    const empty = document.createElement('p');
    empty.className = 'test-quiz__empty';
    empty.textContent = '선택지가 준비되지 않았습니다.';
    options.appendChild(empty);
  }

  wrapper.append(progress, prompt, options);
  return wrapper;
}

function renderTestResultPage(test, mbtiType = '') {
  const normalizedType = (mbtiType || '').toUpperCase();
  const resultInfo = test.results?.[normalizedType] ?? null;
  const summaryCopy =
    resultInfo?.summary ??
    `${
      normalizedType || 'MBTI'
    } 결과를 준비 중입니다. 곧 업데이트될 예정이에요.`;

  const wrapper = document.createElement('section');
  wrapper.className = 'route-section test-result-page';

  const header = document.createElement('div');
  header.className = 'test-result__header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'test-result__eyebrow';
  eyebrow.textContent = test.title ?? '테스트 결과';

  const typeBadge = document.createElement('p');
  typeBadge.className = 'test-result__type';
  typeBadge.textContent = normalizedType || 'MBTI';

  header.append(eyebrow, typeBadge);

  const summary = document.createElement('p');
  summary.className = 'test-result__summary';
  summary.textContent = summaryCopy;

  const detail = document.createElement('p');
  detail.className = 'test-result__description';
  detail.textContent = `${normalizedType || 'MBTI'} 타입의 특징이에요.`;

  const media = document.createElement('div');
  media.className = 'test-result__media';
  if (resultInfo?.image) {
    const img = document.createElement('img');
    img.src = resultInfo.image;
    img.alt = `${normalizedType} 결과 이미지`;
    media.appendChild(img);
  } else {
    media.setAttribute('data-placeholder', 'true');
    media.innerHTML = '<span>이미지가 준비 중입니다.</span>';
  }

  const actions = document.createElement('div');
  actions.className = 'test-page__actions';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'ds-button ds-button--primary';
  retryBtn.textContent = '다시 테스트하기';
  retryBtn.addEventListener('click', () => {
    resetQuizSession(test.id);
    navigateTo(`#/test-quiz/${test.id}`);
  });

  const homeBtn = document.createElement('button');
  homeBtn.type = 'button';
  homeBtn.className = 'ds-button ds-button--ghost';
  homeBtn.textContent = '홈으로 돌아가기';
  homeBtn.addEventListener('click', () => navigateTo('#'));

  actions.append(retryBtn, homeBtn);

  wrapper.append(header, summary, detail, media, actions);
  return wrapper;
}

function ensureQuizSession(test) {
  if (!appState.quizSession || appState.quizSession.testId !== test.id) {
    appState.quizSession = {
      testId: test.id,
      currentIndex: 0,
      totalQuestions: test.questions?.length ?? 0,
      answers: [],
    };
  }
  return appState.quizSession;
}

function resetQuizSession(testId) {
  if (!appState.quizSession) {
    return;
  }
  if (!testId || appState.quizSession.testId === testId) {
    appState.quizSession = null;
  }
}

function handleAnswerSelection(test, answer) {
  const session = ensureQuizSession(test);
  session.answers[session.currentIndex] = answer;
  session.currentIndex += 1;

  if (session.currentIndex >= session.totalQuestions) {
    const mbtiCode = calculateMbtiFromAnswers(session.answers);
    resetQuizSession(test.id);
    navigateTo(`#/test-result/${test.id}/${mbtiCode}`);
    return;
  }

  setRouteContent(renderTestQuizPage(test));
}

function calculateMbtiFromAnswers(answers = []) {
  const axes = {
    EI: { E: 0, I: 0 },
    SN: { S: 0, N: 0 },
    TF: { T: 0, F: 0 },
    JP: { J: 0, P: 0 },
  };

  answers.forEach((answer) => {
    if (!answer?.mbtiAxis || !answer?.direction) {
      return;
    }
    const axis = axes[answer.mbtiAxis];
    if (!axis || axis[answer.direction] === undefined) {
      return;
    }
    axis[answer.direction] += 1;
  });

  const result =
    (axes.EI.E >= axes.EI.I ? 'E' : 'I') +
    (axes.SN.S >= axes.SN.N ? 'S' : 'N') +
    (axes.TF.T >= axes.TF.F ? 'T' : 'F') +
    (axes.JP.J >= axes.JP.P ? 'J' : 'P');

  return result;
}

function navigateTo(hash) {
  const targetHash = hash || '#';
  if (window.location.hash === targetHash) {
    handleRouteChange();
    return;
  }
  window.location.hash = targetHash;
}

function indexTests(tests = []) {
  return tests.reduce((acc, test) => {
    if (test?.id) {
      acc[test.id] = test;
    }
    return acc;
  }, {});
}

function createTagChips(tags = []) {
  if (!Array.isArray(tags) || !tags.length) {
    return null;
  }
  const row = document.createElement('div');
  row.className = 'ds-chip-row';
  tags.slice(0, 4).forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'ds-chip';
    chip.textContent = tag;
    row.appendChild(chip);
  });
  return row;
}

bootstrapViews();
window.addEventListener('hashchange', handleRouteChange);
initHomepage();
