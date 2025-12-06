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
 * @param {Object} resultDetail - 퍼센트/점수 정보
 * @param {Function} onRetryClick - 재시도 버튼 클릭 핸들러
 * @param {Function} onHomeClick - 홈 클릭 핸들러
 * @returns {Element} 렌더링된 페이지 요소
 */
export function renderTestResultPage(
  test,
  mbtiType = '',
  resultDetail = null,
  onRetryClick,
  onHomeClick,
) {
  const isProfessionalTest = test?.id === 'test-mbti-100';
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
  detail.textContent = isProfessionalTest
    ? `${
        normalizedType || 'MBTI'
      } 타입의 특징이에요. 아래에서 4개 축의 비율을 확인해 보세요.`
    : `${normalizedType || 'MBTI'} 타입의 특징이에요.`;

  const metrics =
    isProfessionalTest && resultDetail
      ? createResultMetrics(resultDetail)
      : null;

  const media = createElement('div', {
    className: 'test-result__media',
  });
  const resolvedImage = resolveResultImage(resultInfo?.image, test);
  if (resolvedImage) {
    const img = createElement(
      'img',
      {
        src: resolvedImage,
        alt: `${normalizedType} 결과 이미지`,
        loading: 'lazy',
      },
    );
    media.appendChild(img);
  } else {
    media.setAttribute('data-placeholder', 'true');
    media.innerHTML = '<span>이미지가 준비 중입니다.</span>';
  }

  const actions = createElement('div', {
    className: 'test-page__actions',
  });

  const retryBtn = createElement(
    'button',
    {
      type: 'button',
      className: 'ds-button ds-button--primary',
    },
    '다시 테스트하기',
  );
  if (onRetryClick) {
    retryBtn.addEventListener('click', () => onRetryClick(test.id));
  }

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

  actions.append(retryBtn, homeBtn);

  if (metrics) {
    wrapper.append(header, summary, detail, metrics, media, actions);
  } else {
    wrapper.append(header, summary, detail, media, actions);
  }
  return wrapper;
}

function resolveResultImage(image, test) {
  if (!image) return null;
  // 이미 절대경로거나 data/blob URL이면 그대로 사용
  if (
    /^https?:\/\//.test(image) ||
    image.startsWith('data:') ||
    image.startsWith('blob:') ||
    image.startsWith('//') ||
    image.startsWith('/')
  ) {
    return image;
  }

  const assetBase = test?.assetBaseUrl?.replace(/\/$/, '');
  if (!assetBase) return image;

  const testDir = test?.path?.includes('/')
    ? test.path.substring(0, test.path.lastIndexOf('/'))
    : test?.id || '';

  const prefix = [assetBase, testDir].filter(Boolean).join('/');
  // 중복 슬래시를 정리하되 프로토콜 구문은 유지
  return prefix ? `${prefix}/${image}`.replace(/([^:]\/)\/+/g, '$1') : image;
}

/**
 * 축별 퍼센트 블록 생성
 * @param {Object|null} resultDetail - 퍼센트/점수 정보
 * @returns {Element} 생성된 노드
 */
function createResultMetrics(resultDetail) {
  const defaultPercentages = {
    EI: { E: 50, I: 50 },
    SN: { S: 50, N: 50 },
    TF: { T: 50, F: 50 },
    JP: { J: 50, P: 50 },
  };

  const percentages = resultDetail?.percentages ?? defaultPercentages;

  const container = createElement('div', {
    className: 'result-metrics',
  });

  const rows = [
    { axis: 'EI', left: 'E', right: 'I', label: '외향(E) vs 내향(I)' },
    { axis: 'SN', left: 'S', right: 'N', label: '감각(S) vs 직관(N)' },
    { axis: 'TF', left: 'T', right: 'F', label: '사고(T) vs 감정(F)' },
    { axis: 'JP', left: 'J', right: 'P', label: '판단(J) vs 인식(P)' },
  ];

  rows.forEach((row) => {
    const rowEl = createElement('div', {
      className: 'result-axis',
    });

    const header = createElement('div', {
      className: 'result-axis__header',
    });
    header.textContent = row.label;

    const bar = createElement('div', {
      className: 'result-axis__bar',
    });

    const leftPct = percentages?.[row.axis]?.[row.left] ?? 50;
    const rightPct = percentages?.[row.axis]?.[row.right] ?? 50;

    const leftFill = createElement('div', {
      className: 'result-axis__fill result-axis__fill--left',
    });
    leftFill.style.width = `${leftPct}%`;

    const rightFill = createElement('div', {
      className: 'result-axis__fill result-axis__fill--right',
    });
    rightFill.style.width = `${rightPct}%`;

    bar.append(leftFill, rightFill);

    const footer = createElement('div', {
      className: 'result-axis__footer',
    });
    const leftLabel = createElement('span', {
      className: 'result-axis__value',
    });
    leftLabel.textContent = `${row.left} ${leftPct}%`;

    const rightLabel = createElement('span', {
      className: 'result-axis__value',
    });
    rightLabel.textContent = `${row.right} ${rightPct}%`;

    footer.append(leftLabel, rightLabel);

    rowEl.append(header, bar, footer);
    container.appendChild(rowEl);
  });

  return container;
}
