/**
 * 홈페이지 렌더러 모듈
 * Single Responsibility: 홈페이지 렌더링만 담당
 */

import { createElement, clearContainer } from '../utils/domUtils.js';
import { MBTI_ORDER } from '../utils/constants.js';

/**
 * 테스트 카드 렌더링
 * @param {Element} container - 컨테이너 요소
 * @param {Array} tests - 테스트 배열
 * @param {Function} onTestClick - 테스트 클릭 핸들러
 * @param {boolean} clearFirst - 컨테이너를 먼저 비울지 여부 (기본값: true)
 */
export function renderTests(container, tests, onTestClick, clearFirst = true) {
  if (!container) return;
  if (clearFirst) {
    clearContainer(container);
  }

  tests.forEach((test, idx) => {
    const article = createElement('article', {
      className: 'Article',
    });

    const imgWrapper = createElement('div', {
      className: 'TestListAricleImg',
    });

    const thumbnail = createElement('img', {
      src: test.thumbnail ?? '',
      alt: test.title ? `${test.title} 썸네일` : '#',
    });

    imgWrapper.appendChild(thumbnail);

    const title = createElement(
      'div',
      { className: 'TestTittle' },
      test.title ?? `테스트 ${idx + 1}`,
    );

    const tagContainer = createElement('div', {
      className: 'TestListHashTag',
    });

    const tags =
      Array.isArray(test.tags) && test.tags.length
        ? test.tags
        : ['#해시태그1', '#해시태그2', '#해시태그3', '#해시태그4'];

    tags.forEach((tag) => {
      const tagEl = createElement('div', { className: 'HashTag' }, tag);
      tagContainer.appendChild(tagEl);
    });

    if (test.id && onTestClick) {
      article.setAttribute('role', 'button');
      article.tabIndex = 0;
      article.setAttribute(
        'aria-label',
        `${test.title ?? 'MBTI 테스트'} 소개 페이지로 이동`,
      );
      article.addEventListener('click', () => onTestClick(test.id));
      article.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onTestClick(test.id);
        }
      });
    }

    article.append(imgWrapper, title, tagContainer);
    container.appendChild(article);
  });
}

/**
 * MBTI 그리드 렌더링 (상/하단)
 * @param {Element} topContainer
 * @param {Element} bottomContainer
 */
export function renderMbtiGrid(topContainer, bottomContainer) {
  const render = (container) => {
    if (!container) return;
    clearContainer(container);
    MBTI_ORDER.forEach((code) => {
      const chip = createElement('div', { className: 'mbti-chip' }, code);
      container.appendChild(chip);
    });
  };
  render(topContainer);
  render(bottomContainer);
}
