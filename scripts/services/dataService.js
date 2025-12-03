/**
 * 데이터 서비스 모듈
 * Single Responsibility: 데이터 페칭 및 변환
 * Open/Closed: 새로운 데이터 소스 추가 시 확장 가능
 */

import { DATA_URL } from '../utils/constants.js';
import { indexTests } from '../utils/helpers.js';

/**
 * 데이터 페칭 에러 클래스
 */
export class DataFetchError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'DataFetchError';
    this.status = status;
  }
}

/**
 * 데이터 서비스 클래스
 */
export class DataService {
  constructor(dataUrl = DATA_URL) {
    this.dataUrl = dataUrl;
    this.cache = null;
  }

  /**
   * 데이터를 페칭
   * @returns {Promise<Object>} 페칭된 데이터
   * @throws {DataFetchError} 데이터 페칭 실패 시
   */
  async fetchData() {
    try {
      const response = await fetch(this.dataUrl);
      
      if (!response.ok) {
        throw new DataFetchError(
          `데이터를 불러오지 못했습니다. (상태 코드: ${response.status})`,
          response.status
        );
      }

      const data = await response.json();
      this.cache = data;
      return data;
    } catch (error) {
      if (error instanceof DataFetchError) {
        throw error;
      }
      throw new DataFetchError(
        `네트워크 오류가 발생했습니다: ${error.message}`
      );
    }
  }

  /**
   * 캐시된 데이터 가져오기
   * @returns {Object|null} 캐시된 데이터
   */
  getCachedData() {
    return this.cache;
  }

  /**
   * 테스트 배열 가져오기
   * @param {Object} data - 앱 데이터
   * @returns {Array} 테스트 배열
   */
  getTests(data) {
    return data?.tests ?? [];
  }

  /**
   * 포럼 하이라이트 가져오기
   * @param {Object} data - 앱 데이터
   * @returns {Array} 포럼 하이라이트 배열
   */
  getForumHighlights(data) {
    return data?.forumHighlights ?? [];
  }

  /**
   * 테스트를 ID로 인덱싱
   * @param {Array} tests - 테스트 배열
   * @returns {Object} ID를 키로 하는 테스트 객체
   */
  indexTests(tests) {
    return indexTests(tests);
  }

  /**
   * 데이터 유효성 검사
   * @param {Object} data - 검사할 데이터
   * @returns {boolean} 유효성 여부
   */
  validateData(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    return true;
  }
}

// 싱글톤 인스턴스 생성 및 export
export const dataService = new DataService();

