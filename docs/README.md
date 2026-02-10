# 아키텍처 개요

## 시스템 구성

MBTI ZOO는 Cloudflare의 엣지 인프라 위에서 동작합니다.

```text
┌─────────────────────────────────────────────────────────────────┐
│  브라우저                                                        │
│                                                                   │
│  index.html ──── /api/tests ─────────► Pages Function ──► D1      │
│  testquiz.html ─ /api/tests/:id ─────► Pages Function ──► D1+R2  │
│                  /api/tests/:id/compute ► Pages Function ──► D1   │
│  *.html ──────── /assets/* ──────────► Pages Function ──► R2      │
│  admin.html ──── /api/admin/tests/* ──► Pages Function ──► D1+R2  │
└─────────────────────────────────────────────────────────────────┘
```

## Cloudflare 서비스 역할

| 서비스              | 바인딩           | 역할                                           |
| ------------------- | ---------------- | ---------------------------------------------- |
| **Pages**           | --               | 정적 HTML/CSS/JS 호스팅 + Functions 라우팅     |
| **Pages Functions** | --               | API 엔드포인트 + R2 프록시                     |
| **D1**              | `mbti_db`        | 테스트 메타데이터 + 이미지 메타데이터 (SQLite) |
| **R2**              | `MBTI_BUCKET`    | 테스트 본문 JSON + 이미지 바이너리             |
| **KV**              | `CACHE_KV`       | 테스트 상세 응답 캐시 (TTL 300초)              |
| **Image Resizing**  | `/cdn-cgi/image` | 이미지 포맷 변환(WebP) + 리사이징              |

## 데이터 흐름

### 사용자 퀴즈 플로우

1. 홈페이지 → `GET /api/tests` → D1에서 테스트 목록 조회
2. 테스트 선택 → `GET /api/tests/:id` → KV 캐시 확인 → 없으면 D1(메타) + R2(본문) 병합
3. 퀴즈 진행 → 이미지는 `/assets/*` 프록시를 통해 R2에서 로딩
4. 퀴즈 완료 → `POST /api/tests/:id/compute` → 서버에서 MBTI 계산 + 퍼센트 반환
5. 결과 페이지 → 퍼센트 바 렌더링 + 결과 이미지 표시

### 어드민 저장 플로우

1. 어드민에서 "저장하기" → `PUT /api/admin/tests/:id`
2. R2에 본문(questions + results) 저장
3. D1에 메타데이터 upsert
4. KV 캐시 키 삭제 (무효화)

### 이미지 업로드 플로우

1. 어드민에서 이미지 선택 → `PUT /api/admin/tests/:id/images`
2. R2에 바이너리 저장
3. D1 `test_images` 테이블에 메타 기록

## 캐싱 전략

| 계층                     | 대상                      | TTL       | 무효화                   |
| ------------------------ | ------------------------- | --------- | ------------------------ |
| **KV**                   | `GET /api/tests/:id` 응답 | 300초     | 어드민 저장 시 삭제      |
| **Cache API**            | `GET /api/tests/:id` 응답 | ETag 기반 | 콘텐츠 변경 시 자동      |
| **Edge** (`s-maxage`)    | API 응답                  | 60-300초  | `stale-while-revalidate` |
| **Edge** (`Cache-Tag`)   | `/assets/*`               | 최대 1년  | 태그별 선택 퍼지         |
| **브라우저** (`max-age`) | API/assets                | 60초-1년  | 버전 쿼리(`?v=`)         |

## 프론트엔드 구조

프레임워크 없이 HTML/CSS/JS로 구성되어 있습니다.

- `config.js` -- 에셋 URL 빌딩, 이미지 리사이징, IntersectionObserver 기반 레이지 로딩
- 각 페이지별 스크립트(`main.js`, `testquiz.js` 등)가 `config.js`의 `window.assetUrl()`, `window.assetResizeUrl()` 등을 사용

### 어드민 모듈 구조

```text
public/scripts/admin/
├── state.js       # 전역 상태, 상수(MBTI_ORDER, AXIS_MAP 등), DOM 참조
├── api.js         # fetch 래퍼 (테스트 CRUD, 이미지 업로드)
├── validation.js  # 입력 검증, 경로 정규화
├── render.js      # DOM 렌더링, 토스트 알림, 로딩 오버레이
├── forms.js       # 폼 이벤트 핸들링 (메타/문항/결과)
└── main.js        # 초기화, 이벤트 바인딩, 테스트 로드/저장
```

## 주요 파일

| 파일                                 | 설명                                           |
| ------------------------------------ | ---------------------------------------------- |
| `wrangler.toml`                      | D1, R2, KV 바인딩 + 환경 변수 설정             |
| `public/_routes.json`                | Pages Functions 라우팅 (`/api/*`, `/assets/*`) |
| `functions/_types.ts`                | 공유 TypeScript 타입 (MbtiEnv, KVNamespace 등) |
| `functions/api/admin/utils/store.ts` | D1/R2 읽기/쓰기/이미지 메타 관리 유틸          |
| `functions/assets/[[path]].ts`       | R2 에셋 프록시 (Cache-Tag, ETag, 폴백)         |
| `public/scripts/config.js`           | 프론트엔드 에셋 URL/이미지 설정 중앙 관리      |
