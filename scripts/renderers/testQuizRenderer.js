/**
 * 테스트 퀴즈 페이지 렌더러 모듈
 * Single Responsibility: 퀴즈 페이지 렌더링만 담당
 */

import { createElement } from '../utils/domUtils.js';

/**
 * 로딩 뷰 렌더링
 * @returns {Element} 로딩 뷰 요소
 */
export function renderLoadingView() {
  const loading = createElement('section', {
    className: 'route-section route-section--loading',
  });
  loading.innerHTML = '<p>콘텐츠를 불러오는 중입니다...</p>';
  return loading;
}

/**
 * 테스트 퀴즈 페이지 렌더링
 * @param {Object} test - 테스트 객체
 * @param {Object} session - 퀴즈 세션 객체
 * @param {Function} onAnswerSelect - 답변 선택 핸들러
 * @returns {Element} 렌더링된 페이지 요소
 */
export function renderTestQuizPage(test, session, onAnswerSelect) {
  const wrapper = createElement('section', {
    className: 'route-section test-quiz-page',
  });

  const question = Array.isArray(test.questions)
    ? test.questions[session.currentIndex]
    : null;

  if (!question) {
    wrapper.innerHTML =
      '<p>질문 데이터를 찾지 못했습니다. 홈으로 돌아가 다시 시도해주세요.</p>';
    return wrapper;
  }

  const progress = createElement('div', {
    className: 'test-quiz__progress',
  });
  const progressMeta = createElement('span');
  progressMeta.textContent = `문항 ${session.currentIndex + 1} / ${
    session.totalQuestions
  }`;
  const progressTrack = createElement('div', {
    className: 'test-quiz__progress-track',
  });
  const progressFill = createElement('div', {
    className: 'test-quiz__progress-fill',
  });
  const percent =
    session.totalQuestions === 0
      ? 0
      : Math.min(
          100,
          Math.round(((session.currentIndex + 1) / session.totalQuestions) * 100)
        );
  progressFill.style.setProperty('--quiz-progress', `${percent}%`);
  progressFill.style.width = `${percent}%`;
  progressTrack.appendChild(progressFill);
  progress.append(progressMeta, progressTrack);

  const prompt = createElement('p', {
    className: 'test-quiz__question',
  });
  prompt.textContent = question.prompt ?? '질문을 불러올 수 없습니다.';

  const options = createElement('div', {
    className: `test-quiz__options${isLikert(question) ? ' test-quiz__options--likert' : ''}`,
  });

  question.answers?.forEach((answer) => {
    const optionBtn = createElement('button', {
      type: 'button',
      className: 'ds-button ds-button--secondary test-option',
    }, answer.label);
    if (onAnswerSelect) {
      optionBtn.addEventListener('click', () => onAnswerSelect(test, answer));
    }
    options.appendChild(optionBtn);
  });

  if (!options.children.length) {
    const empty = createElement('p', {
      className: 'test-quiz__empty',
    }, '선택지가 준비되지 않았습니다.');
    options.appendChild(empty);
  }

  wrapper.append(progress, prompt, options);
  return wrapper;
}

/**
 * 7점 리커트 여부를 판단
 * @param {Object} question - 질문 객체
 * @returns {boolean}
 */
function isLikert(question) {
  if (!question || !Array.isArray(question.answers)) {
    return false;
  }
  return (
    question.answers.length >= 7 &&
    question.answers.every((ans) => Object.prototype.hasOwnProperty.call(ans, 'weight'))
  );
}

