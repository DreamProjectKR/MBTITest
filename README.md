# MBTI ZOO

Cloudflare Pages + D1 + R2 + KV 기반의 MBTI 테스트 플랫폼입니다.
관리자가 어드민 페이지에서 테스트를 생성하면, 사용자는 퀴즈를 풀고 MBTI 결과를 확인하고 공유할 수 있습니다.

- **프론트엔드**: HTML/CSS/JS (프레임워크 없음)
- **백엔드**: Cloudflare Pages Functions (TypeScript)
- **데이터베이스**: Cloudflare D1 (SQLite) -- 테스트 메타 + 이미지 메타
- **스토리지**: Cloudflare R2 -- 테스트 본문 JSON + 이미지 바이너리
- **캐시**: Cloudflare KV -- 테스트 상세 응답 캐시 (TTL 5분)
- **이미지 최적화**: Cloudflare Image Resizing (`/cdn-cgi/image`)

## 폴더 구조

```text
mbtitest/
├── assets/                     # 로컬 개발용 샘플 데이터/이미지 (프로덕션에서는 R2에 저장)
│   ├── images/                 # 공용 UI 이미지 (로고, 아이콘 등)
│   ├── test-root-vegetables/   # 샘플 테스트 (이미지 + test.json)
│   └── test-summer/            # 샘플 테스트
├── docs/                       # 프로젝트 문서
│   ├── API.md                  # API 엔드포인트 레퍼런스
│   ├── CLOUDFLARE_PERFORMANCE.md  # Cloudflare 성능 최적화 가이드
│   ├── ERD.md                  # D1 + R2 데이터 모델 ERD
│   └── README.md               # 아키텍처 개요
├── functions/                  # Cloudflare Pages Functions (백엔드)
│   ├── _types.ts               # 공유 TypeScript 타입 정의
│   ├── api/
│   │   ├── _utils/http.ts      # 공용 HTTP 유틸 (캐시 헤더, JSON 응답)
│   │   ├── admin/              # 어드민 전용 API
│   │   │   ├── tests/[id].ts           # PUT /api/admin/tests/:id
│   │   │   ├── tests/[id]/images.ts    # GET/PUT /api/admin/tests/:id/images
│   │   │   ├── tests/[id]/results/[mbti]/image.ts  # PUT 결과 이미지
│   │   │   └── utils/store.ts          # D1/R2 스토리지 유틸
│   │   └── tests/
│   │       ├── index.ts                # GET /api/tests
│   │       ├── [id].ts                 # GET /api/tests/:id
│   │       └── [id]/compute.ts         # POST /api/tests/:id/compute
│   └── assets/[[path]].ts      # GET /assets/* (R2 프록시)
├── migrations/                 # D1 스키마 마이그레이션
│   ├── 0001_schema.sql         # 초기 tests 테이블
│   ├── 0002_add_indexes.sql    # 정렬 인덱스
│   └── 0003_schema_v2.sql      # v2: 분석 컬럼 + test_images 테이블
├── public/                     # 정적 프론트엔드 (Pages 출력 디렉토리)
│   ├── _routes.json            # Pages Functions 라우팅 설정
│   ├── admin.html              # 어드민 페이지
│   ├── index.html              # 홈페이지
│   ├── testintro.html          # 테스트 소개 페이지
│   ├── testlist.html           # 테스트 목록 페이지
│   ├── testquiz.html           # 퀴즈 페이지
│   ├── testresult.html         # 결과 페이지
│   ├── scripts/
│   │   ├── config.js           # 에셋 URL/이미지 최적화 설정
│   │   ├── admin.js            # 어드민 엔트리포인트
│   │   ├── admin/              # 어드민 모듈
│   │   │   ├── state.js        # 상태 관리 + 상수
│   │   │   ├── api.js          # API 호출
│   │   │   ├── forms.js        # 폼 이벤트 핸들링
│   │   │   ├── main.js         # 초기화 + 이벤트 바인딩
│   │   │   ├── render.js       # DOM 렌더링 + 토스트 알림
│   │   │   └── validation.js   # 입력 검증
│   │   ├── main.js             # 홈페이지 로직
│   │   ├── testintro.js        # 테스트 소개 페이지 로직
│   │   ├── testlist.js         # 테스트 목록 로직
│   │   ├── testquiz.js         # 퀴즈 로직 + MBTI 계산
│   │   └── testresult.js       # 결과 페이지 로직
│   └── styles/                 # 페이지별 CSS
├── scripts/                    # 빌드/시드 유틸리티 스크립트
├── wrangler.toml               # Cloudflare 설정 (D1, R2, KV 바인딩)
└── package.json
```

## 로컬 개발

### 사전 요구사항

- Node.js 18+
- npm

### 설치 및 실행

```bash
npm install
npm run d1:migrate:local    # D1 로컬 마이그레이션 적용
npm run dev                 # wrangler pages dev 실행 (http://localhost:8788)
```

### 주요 npm 스크립트

| 스크립트                    | 설명                                              |
| --------------------------- | ------------------------------------------------- |
| `npm run dev`               | 로컬 개발 서버 (Pages + Functions + D1 + R2 + KV) |
| `npm run pages:dev`         | `dev`와 동일                                      |
| `npm run pages:publish`     | Cloudflare Pages에 배포                           |
| `npm run d1:migrate:local`  | D1 마이그레이션 로컬 적용                         |
| `npm run d1:migrate:remote` | D1 마이그레이션 프로덕션 적용                     |
| `npm run format`            | Prettier 포맷 검사                                |
| `npm run format:write`      | Prettier 자동 수정                                |

## Cloudflare Pages 배포

### Pages 대시보드 설정

| 설정 항목           | 값          |
| ------------------- | ----------- |
| Build command       | (비움)      |
| Output directory    | `public`    |
| Functions directory | `functions` |

### 필수 바인딩

| 바인딩        | 타입 | 이름          | 설명                        |
| ------------- | ---- | ------------- | --------------------------- |
| `MBTI_BUCKET` | R2   | `mbti-assets` | 테스트 JSON + 이미지 저장   |
| `mbti_db`     | D1   | `mbti-db`     | 테스트 메타 + 이미지 메타   |
| `CACHE_KV`    | KV   | --            | 테스트 상세 캐시 (TTL 300s) |

### 환경 변수

| 변수                 | 설명                                 |
| -------------------- | ------------------------------------ |
| `ASSETS_BASE`        | R2 공개 URL (로컬 폴백용)            |
| `R2_PUBLIC_BASE_URL` | R2 공개 URL (로컬 개발 시 원격 폴백) |

### D1 마이그레이션

```bash
# 프로덕션 적용
npm run d1:migrate:remote
```

## 어드민 워크플로우

1. `/admin.html`에 접속합니다.
2. 테스트를 선택하거나 "새 테스트" 버튼으로 생성합니다.
3. **기본 정보** 패널에서 제목, 설명, 태그, 썸네일, 제작자 정보를 입력합니다.
4. **문항 작성** 패널에서 12개의 2지선다 문항을 추가합니다 (각 문항에 MBTI 축/방향 지정).
5. **결과 콘텐츠** 패널에서 16개 MBTI 유형별 이미지와 설명을 등록합니다.
   - 개별 등록 또는 "일괄 업로드" 버튼으로 16개 이미지를 한 번에 업로드 (파일명: `INTJ.png` 등).
6. "저장하기" 버튼으로 D1 + R2에 동시 저장합니다.

## 아키텍처

상세 문서는 `docs/` 폴더를 참조하세요:

- [아키텍처 개요](docs/README.md)
- [API 레퍼런스](docs/API.md)
- [데이터 모델 ERD](docs/ERD.md)
- [Cloudflare 성능 최적화](docs/CLOUDFLARE_PERFORMANCE.md)
