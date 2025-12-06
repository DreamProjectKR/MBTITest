/**
 * 홈페이지 렌더러 모듈
 * Single Responsibility: 홈페이지 렌더링만 담당
 */

import { createElement, clearContainer, setStyles } from '../utils/domUtils.js';
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
    const card = createElement('article', {
      className: 'ds-card ds-card--test',
    });

    const thumb = createElement('div', {
      className: 'ds-card__thumbnail',
    });

    const thumbInner = createElement('div', {
      className: 'ds-card__thumbnail-inner',
    });

    if (test.thumbnail) {
      setStyles(thumbInner, {
        backgroundImage: `url(${test.thumbnail})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      });
    }
    thumb.appendChild(thumbInner);

    const body = createElement('div', {
      className: 'ds-card__body',
    });

    const title = createElement('h3', {}, test.title ?? `테스트 ${idx + 1}`);
    body.appendChild(title);

    const tagLine = createElement('p', {
      className: 'ds-card__tags',
    });

    if (Array.isArray(test.tags) && test.tags.length) {
      tagLine.textContent = test.tags.join(' ');
    } else {
      tagLine.textContent = '#해시태그 #테스트';
    }
    body.appendChild(tagLine);

    thumb.appendChild(body);
    card.appendChild(thumb);

    if (test.id && onTestClick) {
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute(
        'aria-label',
        `${test.title ?? 'MBTI 테스트'} 소개 페이지로 이동`,
      );
      card.addEventListener('click', () => onTestClick(test.id));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onTestClick(test.id);
        }
      });
    }

    container.appendChild(card);
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
