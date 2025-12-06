/**
 * 테스트 소개 페이지 렌더러 모듈
 * Single Responsibility: 테스트 소개 페이지 렌더링만 담당
 */

import { createElement } from '../utils/domUtils.js';

/**
 * 태그 칩 생성
 * @param {Array} tags - 태그 배열
 * @returns {Element|null} 태그 칩 행 요소
 */
function createTagChips(tags = []) {
  if (!Array.isArray(tags) || !tags.length) {
    return null;
  }
  const row = createElement('div', {
    className: 'ds-chip-row',
  });
  tags.slice(0, 4).forEach((tag) => {
    const chip = createElement('span', {
      className: 'ds-chip',
    }, tag);
    row.appendChild(chip);
  });
  return row;
}

/**
 * 테스트 소개 페이지 렌더링
 * @param {Object} test - 테스트 객체
 * @param {Function} onStartClick - 시작 버튼 클릭 핸들러
 * @param {Function} onHomeClick - 홈 클릭 핸들러
 * @returns {Element} 렌더링된 페이지 요소
 */
export function renderTestIntroPage(test, onStartClick, onHomeClick) {
  const wrapper = createElement('section', {
    className: 'route-section test-intro-page',
  });

  const media = createElement('div', {
    className: 'test-page__media',
  });
  if (test.thumbnail) {
    const img = createElement('img', {
      src: test.thumbnail,
      alt: `${test.title ?? 'MBTI 테스트'} 썸네일`,
    });
    media.appendChild(img);
  } else {
    media.setAttribute('data-placeholder', 'true');
    media.innerHTML = '<span>썸네일 이미지 준비 중</span>';
  }

  const content = createElement('div', {
    className: 'test-page__content',
  });

  const eyebrow = createElement('p', {
    className: 'test-page__eyebrow',
  }, '테스트 소개');
  content.appendChild(eyebrow);

  const title = createElement('h2', {}, test.title ?? 'MBTI 테스트');
  content.appendChild(title);

  const description = createElement('p', {
    className: 'test-page__description',
  });
  description.textContent =
    test.description ?? '테스트 설명이 곧 업데이트될 예정입니다.';
  content.appendChild(description);

  const metaList = createElement('ul', {
    className: 'test-meta',
  });
  const questionMeta = createElement('li');
  questionMeta.innerHTML = `<strong>${
    test.questions?.length ?? 0
  }</strong> 문항`;
  const resultMeta = createElement('li');
  resultMeta.innerHTML = '<strong>16</strong> 가지 결과';
  metaList.append(questionMeta, resultMeta);
  content.appendChild(metaList);

  const tagsRow = createTagChips(test.tags);
  if (tagsRow) {
    content.appendChild(tagsRow);
  }

  const actions = createElement('div', {
    className: 'test-page__actions',
  });

  const startBtn = createElement('button', {
    type: 'button',
    className: 'ds-button ds-button--primary',
  }, '테스트 시작하기');
  if (onStartClick) {
    startBtn.addEventListener('click', () => onStartClick(test.id));
  }

  const homeBtn = createElement('button', {
    type: 'button',
    className: 'ds-button ds-button--ghost',
  }, '홈으로 돌아가기');
  if (onHomeClick) {
    homeBtn.addEventListener('click', onHomeClick);
  }

  actions.append(startBtn, homeBtn);
  content.appendChild(actions);

  wrapper.append(media, content);
  return wrapper;
}

