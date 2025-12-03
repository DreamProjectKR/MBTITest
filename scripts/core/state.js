/**
 * 애플리케이션 상태 관리 모듈
 * Single Responsibility: 앱 상태만 관리
 */

export class AppState {
  constructor() {
    this.data = null;
    this.testsById = {};
    this.quizSession = null;
    this.main = null;
    this.homeSections = [];
    this.routeOutlet = null;
  }

  /**
   * 앱 데이터 설정
   * @param {Object} data - 앱 데이터
   */
  setData(data) {
    this.data = data;
  }

  /**
   * 앱 데이터 가져오기
   * @returns {Object|null} 앱 데이터
   */
  getData() {
    return this.data;
  }

  /**
   * 테스트 인덱스 설정
   * @param {Object} testsById - ID를 키로 하는 테스트 객체
   */
  setTestsById(testsById) {
    this.testsById = testsById;
  }

  /**
   * ID로 테스트 가져오기
   * @param {string} testId - 테스트 ID
   * @returns {Object|undefined} 테스트 객체
   */
  getTestById(testId) {
    return this.testsById[testId];
  }

  /**
   * 퀴즈 세션 설정
   * @param {Object} session - 퀴즈 세션 객체
   */
  setQuizSession(session) {
    this.quizSession = session;
  }

  /**
   * 퀴즈 세션 가져오기
   * @returns {Object|null} 퀴즈 세션
   */
  getQuizSession() {
    return this.quizSession;
  }

  /**
   * 퀴즈 세션 초기화
   * @param {string|null} testId - 특정 테스트 ID로 초기화 (선택사항)
   */
  resetQuizSession(testId = null) {
    if (!testId || (this.quizSession && this.quizSession.testId === testId)) {
      this.quizSession = null;
    }
  }

  /**
   * 메인 요소 설정
   * @param {Element} main - 메인 요소
   */
  setMain(main) {
    this.main = main;
  }

  /**
   * 메인 요소 가져오기
   * @returns {Element|null} 메인 요소
   */
  getMain() {
    return this.main;
  }

  /**
   * 홈 섹션들 설정
   * @param {Array<Element>} sections - 홈 섹션 배열
   */
  setHomeSections(sections) {
    this.homeSections = sections;
  }

  /**
   * 홈 섹션들 가져오기
   * @returns {Array<Element>} 홈 섹션 배열
   */
  getHomeSections() {
    return this.homeSections;
  }

  /**
   * 라우트 아웃렛 설정
   * @param {Element} outlet - 라우트 아웃렛 요소
   */
  setRouteOutlet(outlet) {
    this.routeOutlet = outlet;
  }

  /**
   * 라우트 아웃렛 가져오기
   * @returns {Element|null} 라우트 아웃렛 요소
   */
  getRouteOutlet() {
    return this.routeOutlet;
  }

  /**
   * 메인 뷰 상태 업데이트
   * @param {boolean} isRouteView - 라우트 뷰 여부
   */
  updateMainViewState(isRouteView) {
    if (!this.main) {
      return;
    }
    this.main.dataset.view = isRouteView ? 'route' : 'home';
  }
}

// 싱글톤 인스턴스 생성 및 export
export const appState = new AppState();

