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
 */
export function renderTests(container, tests, onTestClick) {
  clearContainer(container);

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
        `${test.title ?? 'MBTI 테스트'} 소개 페이지로 이동`
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
 * MBTI 그리드 렌더링
 * @param {Element} topContainer - 상단 컨테이너
 * @param {Element} bottomContainer - 하단 컨테이너
 */
export function renderMbtiGrid(topContainer, bottomContainer) {
  clearContainer(topContainer);
  clearContainer(bottomContainer);

  const topRow = MBTI_ORDER.slice(0, 8);
  const bottomRow = MBTI_ORDER.slice(8, 16);

  topRow.forEach((code) => {
    topContainer.appendChild(createBadge(code));
  });

  bottomRow.forEach((code) => {
    bottomContainer.appendChild(createBadge(code));
  });
}

/**
 * MBTI 배지 생성
 * @param {string} code - MBTI 코드
 * @returns {Element} 배지 요소
 */
function createBadge(code) {
  const item = createElement('li', {
    className: 'ds-badge',
  });
  item.innerHTML = `
    <div class="ds-badge__media"></div>
    <span class="ds-badge__label">${code}</span>
  `;
  return item;
}

/**
 * 포럼 피드 렌더링
 * @param {Element} track - 트랙 요소
 * @param {Array} highlights - 포럼 하이라이트 배열
 */
export function renderForum(track, highlights) {
  if (!track) return;
  clearContainer(track);

  const items = highlights.length
    ? highlights
    : [{ title: 'MBTI 관련 내용요약', ctaLabel: '이글 보러가기' }];

  const createCard = (item) => {
    const card = createElement('article', {
      className: 'ds-card ds-card--feed',
    });

    const media = createElement('div', {
      className: 'feed-card__media',
    });
    if (item.image) {
      setStyles(media, {
        backgroundImage: `url(${item.image})`,
        backgroundSize: 'cover',
      });
    }
    card.appendChild(media);

    const body = createElement('div', {
      className: 'ds-card__body',
    });

    const title = createElement('h3', {}, item.title);
    body.appendChild(title);

    const link = createElement('a', {
      className: 'ds-link feed-card__link',
      href: item.href ?? '#',
    }, `${item.ctaLabel ?? '이글 보러가기'} >`);
    body.appendChild(link);

    card.appendChild(body);
    return card;
  };

  // 원본 아이템 추가
  items.forEach((item) => {
    track.appendChild(createCard(item));
  });

  // 무한 스크롤을 위한 중복 아이템 추가
  items.forEach((item) => {
    const card = createCard(item);
    card.setAttribute('aria-hidden', 'true');
    track.appendChild(card);
  });
}

