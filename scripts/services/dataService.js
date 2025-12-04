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
      // 인덱스 파일 로드
      const indexResponse = await fetch(this.dataUrl);
      
      if (!indexResponse.ok) {
        throw new DataFetchError(
          `인덱스 파일을 불러오지 못했습니다. (상태 코드: ${indexResponse.status})`,
          indexResponse.status
        );
      }

      const indexData = await indexResponse.json();
      
      if (!indexData.tests || !Array.isArray(indexData.tests)) {
        throw new DataFetchError('인덱스 파일 형식이 올바르지 않습니다.');
      }

      // 각 테스트 파일 로드
      const baseUrl = this.dataUrl.substring(0, this.dataUrl.lastIndexOf('/') + 1);
      const testPromises = indexData.tests.map(async (testIndex) => {
        const testPath = `${baseUrl}${testIndex.path}`;
        const testResponse = await fetch(testPath);
        
        if (!testResponse.ok) {
          throw new DataFetchError(
            `테스트 파일을 불러오지 못했습니다: ${testIndex.id} (상태 코드: ${testResponse.status})`,
            testResponse.status
          );
        }

        const testData = await testResponse.json();
        // 이미지 경로를 절대 경로로 변환
        return this.normalizeTestPaths(testData, testIndex.path);
      });

      const tests = await Promise.all(testPromises);
      
      const data = {
        ...indexData,
        tests: tests
      };
      
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
   * 테스트 데이터의 이미지 경로를 절대 경로로 변환
   * @param {Object} testData - 테스트 데이터
   * @param {string} testPath - 테스트 파일 경로 (예: "test-spring-001/test.json")
   * @returns {Object} 경로가 정규화된 테스트 데이터
   */
  normalizeTestPaths(testData, testPath) {
    const testDir = testPath.substring(0, testPath.lastIndexOf('/'));
    const baseUrl = this.dataUrl.substring(0, this.dataUrl.lastIndexOf('/') + 1);
    
    const normalized = { ...testData };
    
    // 썸네일 경로 변환
    if (normalized.thumbnail && normalized.thumbnail.startsWith('images/')) {
      normalized.thumbnail = `${baseUrl}${testDir}/${normalized.thumbnail}`;
    }
    
    // 결과 이미지 경로 변환
    if (normalized.results) {
      const normalizedResults = {};
      for (const [mbtiType, result] of Object.entries(normalized.results)) {
        normalizedResults[mbtiType] = {
          ...result,
          image: result.image && result.image.startsWith('images/')
            ? `${baseUrl}${testDir}/${result.image}`
            : result.image
        };
      }
      normalized.results = normalizedResults;
    }
    
    return normalized;
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

