/**
 * 테스트 목록 페이지 렌더러 모듈
 * Single Responsibility: 테스트 목록 페이지 렌더링만 담당
 */

import { createElement } from '../utils/domUtils.js';
import { renderTests } from './homeRenderer.js';

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

  const header = createElement('div', {
    className: 'test-list__header',
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

  const homeBtn = createElement('button', {
    type: 'button',
    className: 'ds-button ds-button--ghost',
  }, '홈으로 돌아가기');
  if (onHomeClick) {
    homeBtn.addEventListener('click', onHomeClick);
  }

  actions.appendChild(homeBtn);
  header.append(heading, summary, actions);

  const grid = createElement('div', {
    className: 'test-grid test-list__grid',
  });

  if (tests.length) {
    renderTests(grid, tests, onTestClick);
  } else {
    const emptyState = createElement('p', {
      className: 'test-list__empty',
    }, 'MBTI 테스트 목록이 비어 있습니다. 나중에 다시 확인해주세요.');
    grid.appendChild(emptyState);
  }

  wrapper.append(header, grid);
  return wrapper;
}

