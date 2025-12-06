/**
 * 테스트 목록 페이지 렌더러 모듈
 * Single Responsibility: 테스트 목록 페이지 렌더링만 담당
 */

import { createElement } from '../utils/domUtils.js';
import { renderTests } from './homeRenderer.js';

const TESTS_PER_PAGE = 8;

/**
 * 테스트 목록 페이지 렌더링
 * @param {Array} tests - 테스트 배열
 * @param {Function} onTestClick - 테스트 클릭 핸들러
 * @param {Function} onHomeClick - 홈 클릭 핸들러
 * @returns {Element} 렌더링된 페이지 요소
 */
export function renderTestListPage(tests = [], onTestClick, onHomeClick) {
  const wrapper = createElement('section', {
    className: 'route-section test-list-page',
  });
  // 컨테이너 폭 제한 (리스트 전용)
  wrapper.style.maxWidth = '1230px';
  wrapper.style.margin = '0 auto';

  const header = createElement('div', {
    className: 'test-list__header TestListTittle',
  });

  const heading = createElement('h2', {}, '전체 MBTI 테스트');

  const summary = createElement('p', {
    className: 'test-list__summary',
  });
  summary.textContent = tests.length
    ? `${tests.length}개의 MBTI 테스트를 비교하고, 원하는 스타일을 선택하세요.`
    : '현재 준비된 테스트가 없습니다. 곧 새로운 테스트가 찾아옵니다.';

  const actions = createElement('div', {
    className: 'test-list__actions',
  });

  const homeBtn = createElement(
    'button',
    {
      type: 'button',
      className: 'ds-button ds-button--ghost',
    },
    '홈으로 돌아가기',
  );
  if (onHomeClick) {
    homeBtn.addEventListener('click', onHomeClick);
  }

  actions.appendChild(homeBtn);
  header.append(heading, summary, actions);

  const grid = createElement('div', {
    className: 'test-grid test-list__grid TestListArticle',
  });

  // 더 보기 버튼 컨테이너
  const loadMoreContainer = createElement('div', {
    className: 'test-list__load-more',
  });

  if (tests.length) {
    // 초기에는 8개만 표시
    const initialTests = tests.slice(0, TESTS_PER_PAGE);
    renderTests(grid, initialTests, onTestClick);

    // 더 많은 테스트가 있으면 "더 보기" 버튼 표시
    if (tests.length > TESTS_PER_PAGE) {
      let displayedCount = TESTS_PER_PAGE;

      const loadMoreBtn = createElement(
        'button',
        {
          type: 'button',
          className: 'ds-button ds-button--ghost test-list__load-more-btn',
        },
        '더 보기',
      );

      loadMoreBtn.addEventListener('click', () => {
        const nextTests = tests.slice(
          displayedCount,
          displayedCount + TESTS_PER_PAGE,
        );
        if (nextTests.length > 0) {
          renderTests(grid, nextTests, onTestClick, false); // false = append mode
          displayedCount += nextTests.length;

          // 모든 테스트를 표시했으면 버튼 숨기기
          if (displayedCount >= tests.length) {
            loadMoreBtn.style.display = 'none';
          }
        }
      });

      loadMoreContainer.appendChild(loadMoreBtn);
      wrapper.append(header, grid, loadMoreContainer);
    } else {
      wrapper.append(header, grid);
    }
  } else {
    const emptyState = createElement(
      'p',
      {
        className: 'test-list__empty',
      },
      'MBTI 테스트 목록이 비어 있습니다. 나중에 다시 확인해주세요.',
    );
    grid.appendChild(emptyState);
    wrapper.append(header, grid);
  }

  return wrapper;
}
