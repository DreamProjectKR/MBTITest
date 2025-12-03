/**
 * 퀴즈 엔진 모듈
 * Single Responsibility: MBTI 계산 로직 및 세션 관리
 */

import { MBTI_AXES } from '../utils/constants.js';

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
    if (!Array.isArray(answers) || answers.length === 0) {
      console.warn('답변이 없거나 유효하지 않습니다.');
      return 'XXXX'; // 기본값
    }

    const axes = {
      [MBTI_AXES.EI]: { E: 0, I: 0 },
      [MBTI_AXES.SN]: { S: 0, N: 0 },
      [MBTI_AXES.TF]: { T: 0, F: 0 },
      [MBTI_AXES.JP]: { J: 0, P: 0 },
    };

    answers.forEach((answer) => {
      if (!answer?.mbtiAxis || !answer?.direction) {
        return;
      }
      const axis = axes[answer.mbtiAxis];
      if (!axis || axis[answer.direction] === undefined) {
        return;
      }
      axis[answer.direction] += 1;
    });

    const result =
      (axes[MBTI_AXES.EI].E >= axes[MBTI_AXES.EI].I ? 'E' : 'I') +
      (axes[MBTI_AXES.SN].S >= axes[MBTI_AXES.SN].N ? 'S' : 'N') +
      (axes[MBTI_AXES.TF].T >= axes[MBTI_AXES.TF].F ? 'T' : 'F') +
      (axes[MBTI_AXES.JP].J >= axes[MBTI_AXES.JP].P ? 'J' : 'P');

    return result;
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

