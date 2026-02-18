# MBTI ZOO

Cloudflare Pages + D1 + R2 + KV 기반의 MBTI 테스트 플랫폼입니다.
관리자가 어드민 페이지에서 테스트를 생성하면, 사용자는 퀴즈를 풀고 MBTI 결과를 확인하고 공유할 수 있습니다.

- **프론트엔드**: HTML/CSS/JS (프레임워크 없음)
- **백엔드**: Cloudflare Worker (TypeScript, API + 에셋)
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
├── worker/                     # Cloudflare Worker (API + 에셋)
│   ├── index.ts                # Worker 진입점 (라우팅)
│   ├── _types.ts                # 공유 TypeScript 타입 정의
│   ├── api/
│   │   ├── _utils/http.ts       # 공용 HTTP 유틸 (캐시 헤더, JSON 응답)
│   │   ├── admin/               # 어드민 전용 API
│   │   │   ├── tests/[id].ts            # PUT /api/admin/tests/:id
│   │   │   ├── tests/[id]/images.ts     # GET/PUT /api/admin/tests/:id/images
│   │   │   ├── tests/[id]/results/[mbti]/image.ts  # PUT 결과 이미지
│   │   │   └── utils/store.ts           # D1/R2 스토리지 유틸
│   │   └── tests/
│   │       ├── index.ts                 # GET /api/tests
│   │       ├── [id].ts                  # GET /api/tests/:id
│   │       └── [id]/compute.ts          # POST /api/tests/:id/compute
│   └── assets/handler.ts        # GET /assets/* (R2 프록시)
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
├── worker/wrangler.toml         # Worker 설정 (D1, R2, KV, routes)
├── wrangler.toml               # Pages 설정 (정적 출력)
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
npm run dev                 # Worker 로컬 실행 (API + 정적, http://localhost:8787)
```

### 주요 npm 스크립트

| 스크립트                    | 설명                                               |
| --------------------------- | -------------------------------------------------- |
| `npm run dev`               | 로컬 개발 (Worker: /api, /assets + 정적, D1/R2/KV) |
| `npm run pages:dev`         | 정적만 (Pages dev, API 없음)                       |
| `npm run pages:publish`     | Cloudflare Pages에 배포                            |
| `npm run d1:migrate:local`  | D1 마이그레이션 로컬 적용                          |
| `npm run d1:migrate:remote` | D1 마이그레이션 프로덕션 적용                      |
| `npm run format`            | Prettier 포맷 검사                                 |
| `npm run format:write`      | Prettier 자동 수정                                 |

## Cloudflare Pages 배포

### Pages 대시보드 설정

| 설정 항목        | 값       |
| ---------------- | -------- |
| Build command    | (비움)   |
| Output directory | `public` |

API 및 에셋은 Worker(`worker/`)로 라우트하여 배포합니다.

### Pages에 Worker 연결하기

Pages와 Worker는 **같은 커스텀 도메인**을 쓰고, **Routes**로 경로만 Worker에 넘깁니다.  
Pages 프로젝트에 커스텀 도메인(예: `dreamp.org`)을 연결한 뒤, 아래 둘 중 한 가지 방법으로 Worker를 붙이면 됩니다.

**방법 1 — 대시보드**

1. [Cloudflare 대시보드](https://dash.cloudflare.com) → **Workers & Pages**
2. Worker **mbtitest-api** 선택
3. **Settings** → **Triggers** → **Routes** → **Add route**
4. 다음 두 개 추가 (Zone은 Pages에 연결한 도메인의 zone 선택). **apex 도메인은 `도메인/api/*` 형식** (앞에 `*` 없음):

| Route 패턴            | Zone       |
| --------------------- | ---------- |
| `dreamp.org/api/*`    | dreamp.org |
| `dreamp.org/assets/*` | dreamp.org |

사이트를 `www.dreamp.org`로도 쓰면 `www.dreamp.org/api/*`, `www.dreamp.org/assets/*`도 추가하세요.

**방법 2 — wrangler (이미 설정된 경우)**

`worker/wrangler.toml`에 `[[routes]]`가 도메인에 맞게 들어 있어 있으면, Worker만 배포하면 됩니다.

```bash
npm run worker:deploy
```

다른 도메인을 쓰는 경우 `worker/wrangler.toml`에서 `pattern`과 `zone_name`을 해당 도메인으로 바꾼 뒤 같은 명령으로 배포합니다.

**동작 방식**

- `https://귀하의도메인/` → Pages가 `public/` 정적 파일 제공
- `https://귀하의도메인/api/*` → Worker가 API 처리 (D1/KV)
- `https://귀하의도메인/assets/*` → Worker가 R2 에셋 프록시

**참고**: `*.pages.dev` 전용으로만 쓰는 경우에는 Zone이 없어 Routes를 붙일 수 없습니다. 커스텀 도메인을 하나 연결한 뒤 위처럼 Routes를 설정해야 합니다.

---

**문제 해결**: 테스트 목록·상세가 안 뜨고 "응답이 JSON이 아닙니다 (content-type: text/html)" 오류가 나면, Worker가 도메인에 연결되지 않은 상태입니다. 위 **Routes**가 Worker에 추가돼 있는지 확인하세요.

### 필수 바인딩

| 바인딩        | 타입 | 이름          | 설명                        |
| ------------- | ---- | ------------- | --------------------------- |
| `MBTI_BUCKET` | R2   | `mbti-assets` | 테스트 JSON + 이미지 저장   |
| `MBTI_DB`     | D1   | `mbti-db`     | 테스트 메타 + 이미지 메타   |
| `MBTI_KV`     | KV   | --            | 테스트 상세 캐시 (TTL 300s) |

### 환경 변수 (Worker)

| 변수                 | 설명                                 |
| -------------------- | ------------------------------------ |
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

- [AGENTS.md](AGENTS.md) — AI 어시스턴트용 프로젝트 가이드라인
- [아키텍처 개요](docs/README.md)
- [API 레퍼런스](docs/API.md)
- [데이터 모델 ERD](docs/ERD.md)
- [Cloudflare 성능 최적화](docs/CLOUDFLARE_PERFORMANCE.md)
