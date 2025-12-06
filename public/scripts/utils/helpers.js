/**
 * 범용 헬퍼 함수들
 */

/**
 * 값을 최소값과 최대값 사이로 제한
 * @param {number} value - 제한할 값
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {number} 제한된 값
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * 함수 실행을 지연시키는 디바운스 함수
 * @param {Function} fn - 실행할 함수
 * @param {number} delay - 지연 시간 (ms)
 * @returns {Function} 디바운스된 함수
 */
export function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 테스트 배열을 ID를 키로 하는 객체로 변환
 * @param {Array} tests - 테스트 배열
 * @returns {Object} ID를 키로 하는 테스트 객체
 */
export function indexTests(tests = []) {
  return tests.reduce((acc, test) => {
    if (test?.id) {
      acc[test.id] = test;
    }
    return acc;
  }, {});
}

/**
 * MBTI 타입 코드를 정규화 (대문자로 변환)
 * @param {string} mbtiType - MBTI 타입 코드
 * @returns {string} 정규화된 MBTI 타입 코드
 */
export function normalizeMbtiType(mbtiType = '') {
  return mbtiType.toUpperCase();
}

/**
 * 안전하게 값을 가져오는 헬퍼
 * @param {*} value - 확인할 값
 * @param {*} defaultValue - 기본값
 * @returns {*} 값 또는 기본값
 */
export function safeGet(value, defaultValue = null) {
  return value ?? defaultValue;
}

