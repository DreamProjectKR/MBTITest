/**
 * 퀴즈 엔진 모듈
 * Single Responsibility: MBTI 계산 로직 및 세션 관리
 */

import { MBTI_AXES } from '../utils/constants.js';
import { normalizeMbtiType } from '../utils/helpers.js';

/**
 * 퀴즈 엔진 클래스
 */
export class QuizEngine {
  /**
   * 퀴즈 세션 생성
   * @param {string} testId - 테스트 ID
   * @param {number} totalQuestions - 전체 질문 수
   * @returns {Object} 퀴즈 세션 객체
   */
  createSession(testId, totalQuestions) {
    return {
      testId,
      currentIndex: 0,
      totalQuestions: totalQuestions || 0,
      answers: [],
    };
  }

  /**
   * 답변 추가
   * @param {Object} session - 퀴즈 세션 객체
   * @param {Object} answer - 답변 객체
   */
  addAnswer(session, answer) {
    if (!session || !answer) {
      return;
    }
    session.answers[session.currentIndex] = answer;
    session.currentIndex += 1;
  }

  /**
   * 다음 질문으로 이동 가능한지 확인
   * @param {Object} session - 퀴즈 세션 객체
   * @returns {boolean} 다음 질문 존재 여부
   */
  hasNextQuestion(session) {
    if (!session) {
      return false;
    }
    return session.currentIndex < session.totalQuestions;
  }

  /**
   * 답변 배열로부터 MBTI 타입 계산
   * @param {Array} answers - 답변 배열
   * @returns {string} MBTI 타입 코드
   */
  calculateMbtiFromAnswers(answers = []) {
    const detail = this.calculateMbtiResult(answers);
    return detail.type;
  }

  /**
   * 답변 배열로부터 MBTI 타입과 축별 퍼센트 계산
   * @param {Array} answers - 답변 배열
   * @returns {{type: string, percentages: Object, scores: Object}} 세부 결과
   */
  calculateMbtiResult(answers = []) {
    const axes = {
      [MBTI_AXES.EI]: { E: 0, I: 0 },
      [MBTI_AXES.SN]: { S: 0, N: 0 },
      [MBTI_AXES.TF]: { T: 0, F: 0 },
      [MBTI_AXES.JP]: { J: 0, P: 0 },
    };

    if (!Array.isArray(answers) || answers.length === 0) {
      console.warn('답변이 없거나 유효하지 않습니다.');
      return {
        type: 'XXXX',
        percentages: this.#createEmptyPercentages(),
        scores: axes,
      };
    }

    answers.forEach((answer) => {
      if (!answer?.mbtiAxis || !answer?.direction) {
        return;
      }
      const axis = axes[answer.mbtiAxis];
      if (!axis || axis[answer.direction] === undefined) {
        return;
      }
      const weight = Number.isFinite(answer.weight)
        ? Math.max(0, Number(answer.weight))
        : 1;
      axis[answer.direction] += weight;
    });

    const typeChars = [];
    const percentages = {};

    const axisPairs = {
      [MBTI_AXES.EI]: ['E', 'I'],
      [MBTI_AXES.SN]: ['S', 'N'],
      [MBTI_AXES.TF]: ['T', 'F'],
      [MBTI_AXES.JP]: ['J', 'P'],
    };

    Object.entries(axisPairs).forEach(([axisKey, [dirA, dirB]]) => {
      const axisScore = axes[axisKey];
      const total = axisScore[dirA] + axisScore[dirB];
      const percentA = total === 0 ? 50 : Math.round((axisScore[dirA] / total) * 100);
      const percentB = 100 - percentA;
      percentages[axisKey] = {
        [dirA]: percentA,
        [dirB]: percentB,
      };
      typeChars.push(percentA >= percentB ? dirA : dirB);
    });

    return {
      type: normalizeMbtiType(typeChars.join('')),
      percentages,
      scores: axes,
    };
  }

  /**
   * 빈 퍼센트 객체 생성
   * @returns {Object}
   */
  #createEmptyPercentages() {
    return {
      [MBTI_AXES.EI]: { E: 50, I: 50 },
      [MBTI_AXES.SN]: { S: 50, N: 50 },
      [MBTI_AXES.TF]: { T: 50, F: 50 },
      [MBTI_AXES.JP]: { J: 50, P: 50 },
    };
  }

  /**
   * 세션 유효성 검사
   * @param {Object} session - 퀴즈 세션 객체
   * @param {string} testId - 테스트 ID
   * @returns {boolean} 유효성 여부
   */
  validateSession(session, testId) {
    if (!session) {
      return false;
    }
    return session.testId === testId;
  }

  /**
   * 진행률 계산
   * @param {Object} session - 퀴즈 세션 객체
   * @returns {number} 진행률 (0-100)
   */
  calculateProgress(session) {
    if (!session || session.totalQuestions === 0) {
      return 0;
    }
    return Math.round((session.currentIndex / session.totalQuestions) * 100);
  }
}

// 싱글톤 인스턴스 생성 및 export
export const quizEngine = new QuizEngine();

