/**
 * 테스트 결과 페이지 렌더러 모듈
 * Single Responsibility: 테스트 결과 페이지 렌더링만 담당
 */

import { createElement } from '../utils/domUtils.js';
import { normalizeMbtiType } from '../utils/helpers.js';

/**
 * 테스트 결과 페이지 렌더링
 * @param {Object} test - 테스트 객체
 * @param {string} mbtiType - MBTI 타입 코드
 * @param {Function} onRetryClick - 재시도 버튼 클릭 핸들러
 * @param {Function} onHomeClick - 홈 클릭 핸들러
 * @returns {Element} 렌더링된 페이지 요소
 */
export function renderTestResultPage(
  test,
  mbtiType = '',
  onRetryClick,
  onHomeClick
) {
  const normalizedType = normalizeMbtiType(mbtiType);
  const resultInfo = test.results?.[normalizedType] ?? null;
  const summaryCopy =
    resultInfo?.summary ??
    `${
      normalizedType || 'MBTI'
    } 결과를 준비 중입니다. 곧 업데이트될 예정이에요.`;

  const wrapper = createElement('section', {
    className: 'route-section test-result-page',
  });

  const header = createElement('div', {
    className: 'test-result__header',
  });

  const eyebrow = createElement('p', {
    className: 'test-result__eyebrow',
  });
  eyebrow.textContent = test.title ?? '테스트 결과';

  const typeBadge = createElement('p', {
    className: 'test-result__type',
  });
  typeBadge.textContent = normalizedType || 'MBTI';

  header.append(eyebrow, typeBadge);

  const summary = createElement('p', {
    className: 'test-result__summary',
  });
  summary.textContent = summaryCopy;

  const detail = createElement('p', {
    className: 'test-result__description',
  });
  detail.textContent = `${normalizedType || 'MBTI'} 타입의 특징이에요.`;

  const media = createElement('div', {
    className: 'test-result__media',
  });
  if (resultInfo?.image) {
    const img = createElement('img', {
      src: resultInfo.image,
      alt: `${normalizedType} 결과 이미지`,
    });
    media.appendChild(img);
  } else {
    media.setAttribute('data-placeholder', 'true');
    media.innerHTML = '<span>이미지가 준비 중입니다.</span>';
  }

  const actions = createElement('div', {
    className: 'test-page__actions',
  });

  const retryBtn = createElement('button', {
    type: 'button',
    className: 'ds-button ds-button--primary',
  }, '다시 테스트하기');
  if (onRetryClick) {
    retryBtn.addEventListener('click', () => onRetryClick(test.id));
  }

  const homeBtn = createElement('button', {
    type: 'button',
    className: 'ds-button ds-button--ghost',
  }, '홈으로 돌아가기');
  if (onHomeClick) {
    homeBtn.addEventListener('click', onHomeClick);
  }

  actions.append(retryBtn, homeBtn);

  wrapper.append(header, summary, detail, media, actions);
  return wrapper;
}

