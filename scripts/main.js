/**
 * 메인 진입점
 * 모듈 초기화 및 조합
 */

import { appState } from './core/state.js';
import { dataService } from './services/dataService.js';
import { quizEngine } from './core/quizEngine.js';
import { Router } from './core/router.js';
import {
  renderTests,
  renderMbtiGrid,
  renderForum,
} from './renderers/homeRenderer.js';
import { renderTestListPage } from './renderers/testListRenderer.js';
import { renderTestIntroPage } from './renderers/testIntroRenderer.js';
import {
  renderTestQuizPage,
  renderLoadingView,
} from './renderers/testQuizRenderer.js';
import { renderTestResultPage } from './renderers/testResultRenderer.js';
import { $, safeAddEventListener } from './utils/domUtils.js';
import { createElement } from './utils/domUtils.js';

/**
 * 뷰 초기화
 */
function bootstrapViews() {
  const mainElement = $('.site-main');
  if (!mainElement) {
    return;
  }

  if (appState.getRouteOutlet()) {
    return;
  }

  const homeChildren = Array.from(mainElement.children);
  const outlet = createElement('section', {
    className: 'route-outlet',
    dataset: { routeOutlet: 'true' },
    tabindex: '-1',
    'aria-live': 'polite',
  });
  outlet.hidden = true;
  mainElement.appendChild(outlet);

  appState.setMain(mainElement);
  appState.updateMainViewState(false);
  appState.setHomeSections(homeChildren);
  appState.setRouteOutlet(outlet);
}

/**
 * 렌더러 객체 생성
 */
const renderers = {
  loading: () => renderLoadingView(),
  testList: (tests, onTestClick, onHomeClick) =>
    renderTestListPage(tests, onTestClick, onHomeClick),
  testIntro: (test, onStartClick, onHomeClick) =>
    renderTestIntroPage(test, onStartClick, onHomeClick),
  testQuiz: (test, session, onAnswerSelect) =>
    renderTestQuizPage(test, session, onAnswerSelect),
  testResult: (test, mbtiType, onRetryClick, onHomeClick) =>
    renderTestResultPage(test, mbtiType, onRetryClick, onHomeClick),
};

/**
 * 라우터 인스턴스 생성
 */
const router = new Router(renderers, quizEngine);

/**
 * 홈페이지 초기화
 */
async function initHomepage() {
  const testsGrid = $('[data-tests-grid]');
  const mbtiGrid = $('[data-mbti-grid]');
  const mbtiGridBottom = $('[data-mbti-grid-bottom]');
  const mbtiFeedTrack = $('[data-mbti-feed-track]');
  const feedSlider = $('[data-mbti-feed-slider]');

  const allTestsTrigger = $('[data-all-tests-trigger]');
  safeAddEventListener(allTestsTrigger, 'click', () => {
    router.navigateTo('#/tests');
  });

  const footerLogoButton = $('.site-footer__logo-button');
  safeAddEventListener(footerLogoButton, 'click', () => {
    router.navigateTo('#');
  });

  if (!testsGrid || !mbtiGrid || !mbtiFeedTrack || !feedSlider) {
    console.warn('필수 DOM 요소를 찾을 수 없습니다.');
    return;
  }

  try {
    const payload = await dataService.fetchData();

    if (!dataService.validateData(payload)) {
      throw new Error('유효하지 않은 데이터 형식입니다.');
    }

    const tests = dataService.getTests(payload);
    if (!Array.isArray(tests)) {
      throw new Error('테스트 데이터가 배열 형식이 아닙니다.');
    }

    appState.setData(payload);
    appState.setTestsById(dataService.indexTests(tests));

    const testCards = tests.length
      ? tests.slice(0, 3)
      : Array.from({ length: 3 }, (_, idx) => ({ title: `테스트 ${idx + 1}` }));

    renderTests(testsGrid, testCards, (testId) => {
      if (testId) {
        router.navigateTo(`#/test-intro/${testId}`);
      }
    });

    if (mbtiGrid && mbtiGridBottom) {
      renderMbtiGrid(mbtiGrid, mbtiGridBottom);
    }

    const forumHighlights = dataService.getForumHighlights(payload);
    if (mbtiFeedTrack) {
      renderForum(mbtiFeedTrack, forumHighlights);
    }

    router.handleRouteChange();
  } catch (error) {
    console.error('홈페이지 초기화 오류:', error);
    // 사용자에게 에러 메시지 표시
    if (testsGrid) {
      const errorMsg = createElement(
        'p',
        {
          className: 'test-list__empty',
        },
        '데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.',
      );
      testsGrid.innerHTML = '';
      testsGrid.appendChild(errorMsg);
    }
  }
}

/**
 * 애플리케이션 초기화
 */
function init() {
  bootstrapViews();
  window.addEventListener('hashchange', () => router.handleRouteChange());
  initHomepage();
}

// DOM이 로드되면 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
