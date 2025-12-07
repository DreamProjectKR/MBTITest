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
    const assetsBase = getAssetsBase();
    this.staticIndexUrl = `${assetsBase}/assets/data/index.json`;
  }

  /**
   * 데이터를 페칭
   * @returns {Promise<Object>} 페칭된 데이터
   * @throws {DataFetchError} 데이터 페칭 실패 시
   */
  async fetchData() {
    try {
      // 1순위: API(/api/tests) 호출
      const indexResponse = await fetch(this.dataUrl, { cache: 'no-store' });

      if (indexResponse.status === 304 && this.cache) {
        return this.cache;
      }

      if (!indexResponse.ok) {
        throw new DataFetchError(
          `인덱스 파일을 불러오지 못했습니다. (상태 코드: ${indexResponse.status})`,
          indexResponse.status,
        );
      }

      const indexData = await indexResponse.json();
      const assetBaseUrl = indexData.assetBaseUrl;

      // Cloudflare Pages Functions에서 이미 병합된 형태로 내려줄 때
      if (this.isAggregatedPayload(indexData)) {
        const normalizedTests = (indexData.tests ?? []).map((test) =>
          this.normalizeTestPaths(test, test.path ?? test.id, assetBaseUrl),
        );

        const data = {
          ...indexData,
          tests: normalizedTests,
        };

        this.cache = data;
        return data;
      }

      if (!indexData.tests || !Array.isArray(indexData.tests)) {
        throw new DataFetchError('인덱스 파일 형식이 올바르지 않습니다.');
      }

      // 정적 JSON을 그대로 읽어오는 기존 동작 (개발/로컬 대응)
      const baseUrl = this.computeLegacyBase();
      const testPromises = indexData.tests.map(async (testIndex) => {
        const testPath = `${baseUrl}/${testIndex.path}`;
        const testResponse = await fetch(testPath);

        if (!testResponse.ok) {
          throw new DataFetchError(
            `테스트 파일을 불러오지 못했습니다: ${testIndex.id} (상태 코드: ${testResponse.status})`,
            testResponse.status,
          );
        }

        const testData = await testResponse.json();
        return this.normalizeTestPaths(testData, testIndex.path, baseUrl);
      });

      const tests = await Promise.all(testPromises);

      const data = {
        ...indexData,
        tests: tests,
      };

      this.cache = data;
      return data;
    } catch (error) {
      console.warn('API 로딩 실패, 정적 JSON으로 재시도', error);
      return this.fetchStaticFallback();
    }
  }

  async fetchStaticFallback() {
    const indexResponse = await fetch(this.staticIndexUrl);
    if (!indexResponse.ok) {
      throw new DataFetchError(
        `정적 인덱스 파일을 불러오지 못했습니다. (상태 코드: ${indexResponse.status})`,
        indexResponse.status,
      );
    }
    const indexData = await indexResponse.json();
    if (!indexData.tests || !Array.isArray(indexData.tests)) {
      throw new DataFetchError('정적 인덱스 파일 형식이 올바르지 않습니다.');
    }

    const baseUrl = this.staticIndexUrl.substring(
      0,
      this.staticIndexUrl.lastIndexOf('/'),
    );
    const testPromises = indexData.tests.map(async (testIndex) => {
      const testPath = `${baseUrl}/${testIndex.path}`;
      const testResponse = await fetch(testPath);
      if (!testResponse.ok) {
        throw new DataFetchError(
          `정적 테스트 파일을 불러오지 못했습니다: ${testIndex.id} (상태 코드: ${testResponse.status})`,
          testResponse.status,
        );
      }
      const testData = await testResponse.json();
      return this.normalizeTestPaths(testData, testIndex.path, baseUrl);
    });

    const tests = await Promise.all(testPromises);
    const data = {
      ...indexData,
      tests,
    };
    this.cache = data;
    return data;
  }

  /**
   * 테스트 데이터의 이미지 경로를 절대 경로로 변환
   * @param {Object} testData - 테스트 데이터
   * @param {string} testPath - 테스트 파일 경로 (예: "test-spring-001/test.json")
   * @param {string} assetBaseUrl - R2 public base URL (옵션)
   * @returns {Object} 경로가 정규화된 테스트 데이터
   */
  normalizeTestPaths(testData, testPath, assetBaseUrl = null) {
    const testDir = testPath?.includes('/')
      ? testPath.substring(0, testPath.lastIndexOf('/'))
      : testData.id ?? '';
    const resolvedBase =
      assetBaseUrl?.replace(/\/$/, '') ?? this.computeLegacyBase();
    const prefix =
      resolvedBase && testDir ? `${resolvedBase}/${testDir}/` : null;

    const normalized = { ...testData };

    if (
      prefix &&
      normalized.thumbnail &&
      normalized.thumbnail.startsWith('images/')
    ) {
      normalized.thumbnail = `${prefix}${normalized.thumbnail}`;
    }

    if (prefix && normalized.results) {
      const normalizedResults = {};
      for (const [mbtiType, result] of Object.entries(normalized.results)) {
        normalizedResults[mbtiType] = {
          ...result,
          image:
            result.image && result.image.startsWith('images/')
              ? `${prefix}${result.image}`
              : result.image,
        };
      }
      normalized.results = normalizedResults;
    }

    return normalized;
  }

  isAggregatedPayload(payload) {
    return (
      Array.isArray(payload?.tests) &&
      payload.tests.some((test) => Array.isArray(test?.questions))
    );
  }

  computeLegacyBase() {
    if (!this.dataUrl || !this.dataUrl.includes('/')) return '';
    if (this.dataUrl.endsWith('/')) return this.dataUrl.slice(0, -1);
    return this.dataUrl.substring(0, this.dataUrl.lastIndexOf('/'));
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

/**
 * 런타임에서 자산 기본 경로를 가져옵니다.
 * - window.__ASSETS_BASE가 설정되어 있으면 우선 사용
 * - <meta name="assets-base" content="..."> 값이 있으면 사용
 * - 둘 다 없으면 상대 경로(빈 문자열)를 사용하여 /assets/... 로 요청
 */
function getAssetsBase() {
  if (typeof window !== 'undefined') {
    if (window.__ASSETS_BASE) {
      return window.__ASSETS_BASE.replace(/\/+$/, '');
    }
    const meta = document.querySelector('meta[name="assets-base"]');
    if (meta?.content) {
      return meta.content.replace(/\/+$/, '');
    }
  }
  return '';
}
