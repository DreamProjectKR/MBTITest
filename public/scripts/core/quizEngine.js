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
  calculateMbtiFromAnswers(answers = [], options = {}) {
    const detail = this.calculateMbtiResult(answers, options);
    return detail.type;
  }

  /**
   * 답변 배열로부터 MBTI 타입과 축별 퍼센트 계산
   * @param {Array} answers - 답변 배열
   * @param {Object} options - 옵션 (questions, maxWeight)
   * @returns {{type: string, percentages: Object, scores: Object}} 세부 결과
   */
  calculateMbtiResult(answers = [], options = {}) {
    const DEFAULT_MAX_WEIGHT = 3;
    const questions = Array.isArray(options?.questions)
      ? options.questions
      : [];
    const fallbackMaxWeight = Number.isFinite(options?.maxWeight)
      ? Math.max(1, Number(options.maxWeight))
      : DEFAULT_MAX_WEIGHT;

    const axesScores = {
      [MBTI_AXES.EI]: { E: 0, I: 0 },
      [MBTI_AXES.SN]: { S: 0, N: 0 },
      [MBTI_AXES.TF]: { T: 0, F: 0 },
      [MBTI_AXES.JP]: { J: 0, P: 0 },
    };

    const axisMeta = {
      [MBTI_AXES.EI]: {
        questionCount: 0,
        answeredCount: 0,
        maxWeight: fallbackMaxWeight,
      },
      [MBTI_AXES.SN]: {
        questionCount: 0,
        answeredCount: 0,
        maxWeight: fallbackMaxWeight,
      },
      [MBTI_AXES.TF]: {
        questionCount: 0,
        answeredCount: 0,
        maxWeight: fallbackMaxWeight,
      },
      [MBTI_AXES.JP]: {
        questionCount: 0,
        answeredCount: 0,
        maxWeight: fallbackMaxWeight,
      },
    };

    // 사전 질문 메타로 축별 문항 수/최대 가중치 추론
    questions.forEach((q) => {
      const axisKey = q?.mbtiAxis ?? q?.answers?.[0]?.mbtiAxis;
      if (!axisMeta[axisKey]) {
        return;
      }
      axisMeta[axisKey].questionCount += 1;
      const localMax = Array.isArray(q.answers)
        ? q.answers.reduce((max, ans) => {
            const w = Number.isFinite(ans?.weight) ? Number(ans.weight) : 0;
            return Math.max(max, w);
          }, 0)
        : 0;
      if (localMax > 0) {
        axisMeta[axisKey].maxWeight = Math.max(
          axisMeta[axisKey].maxWeight,
          localMax,
        );
      }
    });

    if (!Array.isArray(answers) || answers.length === 0) {
      console.warn('답변이 없거나 유효하지 않습니다.');
      return {
        type: 'XXXX',
        percentages: this.#createEmptyPercentages(),
        scores: axesScores,
      };
    }

    answers.forEach((answer) => {
      if (!answer?.mbtiAxis || !answer?.direction) {
        return;
      }
      const axisScore = axesScores[answer.mbtiAxis];
      if (!axisScore || axisScore[answer.direction] === undefined) {
        return;
      }
      const weight = Number.isFinite(answer.weight)
        ? Math.max(0, Number(answer.weight))
        : 1;
      axisScore[answer.direction] += weight;
      if (axisMeta[answer.mbtiAxis]) {
        axisMeta[answer.mbtiAxis].answeredCount += 1;
      }
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
      const axisScore = axesScores[axisKey];
      const meta = axisMeta[axisKey];
      const questionCount = meta.questionCount || meta.answeredCount;
      const maxWeight = meta.maxWeight || fallbackMaxWeight;
      const totalPossible = Math.max(1, questionCount * maxWeight);
      const percentA = this.#clampPercent(
        totalPossible === 0
          ? 50
          : Math.round((axisScore[dirA] / totalPossible) * 100),
      );
      const percentB = this.#clampPercent(100 - percentA);
      percentages[axisKey] = {
        [dirA]: percentA,
        [dirB]: percentB,
      };
      typeChars.push(axisScore[dirA] >= axisScore[dirB] ? dirA : dirB);
    });

    return {
      type: normalizeMbtiType(typeChars.join('')),
      percentages,
      scores: axesScores,
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
   * 퍼센트 값 클램프
   * @param {number} value
   * @returns {number}
   */
  #clampPercent(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, Math.round(value)));
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
