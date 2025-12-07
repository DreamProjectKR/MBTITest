/**
 * 애플리케이션 상수 정의
 */

// 기본 데이터 소스: Pages Functions API (R2에서 집계된 JSON 제공)
export const DATA_URL = '/api/tests';

export const ROUTE_SEGMENTS = {
  HOME: '',
  TEST_LIST: 'tests',
  TEST_INTRO: 'test-intro',
  TEST_QUIZ: 'test-quiz',
  TEST_RESULT: 'test-result',
};

export const MBTI_ORDER = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];

export const MBTI_AXES = {
  EI: 'EI',
  SN: 'SN',
  TF: 'TF',
  JP: 'JP',
};

export const MBTI_DIRECTIONS = {
  E: 'E',
  I: 'I',
  S: 'S',
  N: 'N',
  T: 'T',
  F: 'F',
  J: 'J',
  P: 'P',
};
