/**
 * 라우터 모듈
 * Single Responsibility: 라우팅 로직만 담당
 * Dependency Inversion: 렌더러를 의존성 주입으로 받음
 */

import { ROUTE_SEGMENTS } from '../utils/constants.js';
import { appState } from './state.js';

/**
 * 라우터 클래스
 */
export class Router {
  /**
   * @param {Object} renderers - 렌더러 객체
   * @param {Object} quizEngine - 퀴즈 엔진 인스턴스
   */
  constructor(renderers, quizEngine) {
    this.renderers = renderers;
    this.quizEngine = quizEngine;
  }

  /**
   * 해시에서 라우트 파싱
   * @param {string} rawHash - 원본 해시
   * @returns {Object} 파싱된 라우트 객체
   */
  parseRoute(rawHash = '') {
    if (!rawHash || rawHash === '#') {
      return { name: ROUTE_SEGMENTS.HOME, params: [] };
    }
    const normalized = rawHash.replace(/^#\/?/, '');
    if (!normalized) {
      return { name: ROUTE_SEGMENTS.HOME, params: [] };
    }
    const [name, ...rest] = normalized
      .split('/')
      .map((segment) => decodeURIComponent(segment));
    if (!name) {
      return { name: ROUTE_SEGMENTS.HOME, params: [] };
    }
    return { name, params: rest };
  }

  /**
   * 라우트 변경 처리
   */
  handleRouteChange() {
    const routeOutlet = appState.getRouteOutlet();
    if (!routeOutlet) {
      console.warn('라우트 아웃렛이 초기화되지 않았습니다.');
      return;
    }

    const route = this.parseRoute(window.location.hash);
    if (!route || route.name === ROUTE_SEGMENTS.HOME) {
      this.showHomeView();
      return;
    }

    const data = appState.getData();
    if (!data) {
      this.setRouteContent(this.renderers.loading());
      return;
    }

    const [testId, extraParam] = route.params ?? [];
    const test = testId ? appState.getTestById(testId) : null;

    switch (route.name) {
      case ROUTE_SEGMENTS.TEST_LIST: {
        const tests = data.tests ?? [];
        this.setRouteContent(
          this.renderers.testList(
            tests,
            (id) => this.navigateTo(`#/test-intro/${id}`),
            () => this.navigateTo('#')
          )
        );
        break;
      }
      case ROUTE_SEGMENTS.TEST_INTRO: {
        if (!test) {
          this.showHomeView();
          return;
        }
        this.setRouteContent(
          this.renderers.testIntro(
            test,
            (id) => {
              appState.resetQuizSession(id);
              this.navigateTo(`#/test-quiz/${id}`);
            },
            () => this.navigateTo('#')
          )
        );
        break;
      }
      case ROUTE_SEGMENTS.TEST_QUIZ: {
        if (!test) {
          console.warn(`테스트를 찾을 수 없습니다: ${testId}`);
          this.showHomeView();
          return;
        }
        if (!test.questions || !Array.isArray(test.questions) || test.questions.length === 0) {
          console.warn(`테스트에 질문이 없습니다: ${testId}`);
          this.setRouteContent(
            this.renderers.loading()
          );
          return;
        }
        const session = this.ensureQuizSession(test, this.quizEngine);
        this.setRouteContent(
          this.renderers.testQuiz(test, session, (testObj, answer) =>
            this.handleAnswerSelection(testObj, answer, this.quizEngine)
          )
        );
        break;
      }
      case ROUTE_SEGMENTS.TEST_RESULT: {
        if (!test) {
          this.showHomeView();
          return;
        }
        this.setRouteContent(
          this.renderers.testResult(
            test,
            extraParam,
            (id) => {
              appState.resetQuizSession(id);
              this.navigateTo(`#/test-quiz/${id}`);
            },
            () => this.navigateTo('#')
          )
        );
        break;
      }
      default:
        this.showHomeView();
    }
  }

  /**
   * 라우트 콘텐츠 설정
   * @param {Element} contentNode - 콘텐츠 노드
   */
  setRouteContent(contentNode) {
    const routeOutlet = appState.getRouteOutlet();
    if (!routeOutlet) {
      return;
    }

    const homeSections = appState.getHomeSections();
    homeSections.forEach((section) => {
      section.hidden = true;
    });

    appState.updateMainViewState(true);
    routeOutlet.hidden = false;
    routeOutlet.innerHTML = '';

    if (contentNode) {
      routeOutlet.appendChild(contentNode);
    }

    routeOutlet.focus();
    routeOutlet.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * 홈 뷰 표시
   */
  showHomeView() {
    const routeOutlet = appState.getRouteOutlet();
    if (!routeOutlet) {
      return;
    }

    const homeSections = appState.getHomeSections();
    homeSections.forEach((section) => {
      section.hidden = false;
    });

    routeOutlet.hidden = true;
    routeOutlet.innerHTML = '';
    appState.updateMainViewState(false);
  }

  /**
   * 네비게이션
   * @param {string} hash - 해시 경로
   */
  navigateTo(hash) {
    const targetHash = hash || '#';
    if (window.location.hash === targetHash) {
      this.handleRouteChange();
      return;
    }
    window.location.hash = targetHash;
  }

  /**
   * 퀴즈 세션 보장
   * @param {Object} test - 테스트 객체
   * @param {Object} quizEngine - 퀴즈 엔진 인스턴스
   * @returns {Object} 퀴즈 세션
   */
  ensureQuizSession(test, quizEngine) {
    const session = appState.getQuizSession();
    if (!session || session.testId !== test.id) {
      const newSession = quizEngine.createSession(
        test.id,
        test.questions?.length ?? 0
      );
      appState.setQuizSession(newSession);
      return newSession;
    }
    return session;
  }

  /**
   * 답변 선택 처리
   * @param {Object} test - 테스트 객체
   * @param {Object} answer - 답변 객체
   * @param {Object} quizEngine - 퀴즈 엔진 인스턴스
   */
  handleAnswerSelection(test, answer, quizEngine) {
    if (!test || !answer) {
      console.error('테스트 또는 답변이 유효하지 않습니다.');
      return;
    }

    const session = this.ensureQuizSession(test, quizEngine);
    if (!session) {
      console.error('퀴즈 세션을 생성할 수 없습니다.');
      return;
    }

    quizEngine.addAnswer(session, answer);

    if (!quizEngine.hasNextQuestion(session)) {
      const mbtiCode = quizEngine.calculateMbtiFromAnswers(session.answers);
      if (!mbtiCode || mbtiCode.length !== 4) {
        console.error('MBTI 코드 계산 실패:', session.answers);
        this.showHomeView();
        return;
      }
      appState.resetQuizSession(test.id);
      this.navigateTo(`#/test-result/${test.id}/${mbtiCode}`);
      return;
    }

    this.setRouteContent(
      this.renderers.testQuiz(test, session, (testObj, ans) =>
        this.handleAnswerSelection(testObj, ans, quizEngine)
      )
    );
  }
}

