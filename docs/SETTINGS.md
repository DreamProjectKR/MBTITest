# Cloudflare 설정 가이드 (Pages + Functions + R2 + D1) + 로컬 개발(wrangler)

이 문서는 이 저장소를 **Cloudflare Pages + Pages Functions**로 운영하기 위해 필요한 설정을 단계별로 정리한 것입니다.

---

## 0) 빠른 요약(필수 바인딩/변수)

- **R2 bucket binding (필수)**: `MBTI_BUCKET` → R2 bucket `mbti-assets`
- **D1 database binding (필수)**: `MBTI_DB` → D1 database `mbti-db`
- **Admin 보호 토큰(권장)**: `ADMIN_TOKEN` (Secrets)
- **(옵션) 저장 시 legacy index.json 생성**: `EMIT_INDEX_ON_SAVE=1`

---

## 1) Cloudflare Pages 프로젝트 생성/연결

1. Cloudflare Dashboard → **Pages** → **Create a project**
2. GitHub 저장소 연결 후 프로젝트 생성

### 빌드/출력 디렉토리
이 repo는 최종 정적 산출물이 `public/` 입니다.

- **Option A (권장: GitHub Actions로 배포)**  
  `.github/workflows/pages-deploy.yml`이 `npm ci → typecheck → test → build`를 통과하면 `public/`을 Pages로 업로드합니다.  
  이 방식이면 Pages 대시보드의 Build 설정은 사실상 중요도가 낮습니다.

- **Option B (Pages가 직접 빌드)**  
  Pages 프로젝트 Settings → Build & deploy에서:
  - **Build command**: `npm ci && npm run build`
  - **Build output directory**: `public`
  - **Functions directory**: `functions`

> 현재 TypeScript 프론트 번들링은 `npm run build`가 수행합니다.

---

## 2) R2 설정 (이미지/정적 자산)

### 2-1) R2 버킷 생성
1. Cloudflare Dashboard → **R2** → **Create bucket**
2. bucket name: `mbti-assets`

### 2-2) Pages 프로젝트에 R2 바인딩 추가
Pages 프로젝트 → **Settings → Functions → R2 bindings**:
- **Variable name**: `MBTI_BUCKET`
- **Bucket**: `mbti-assets`

### 2-3) 자산 서빙 방식
브라우저는 **동일 오리진**으로 `/assets/*`를 요청하고, Pages Function이 R2에서 읽어 프록시합니다:
- 구현: `functions/assets/[[path]].ts`
- 프론트 변환: `public/scripts/config.js`의 `window.assetUrl()`

> `/assets/*` 프록시는 1회 R2 get으로 고정되어 있습니다.

---

## 3) D1 설정 (테스트 데이터: tests/questions/answers/results)

### 3-1) D1 DB 생성
1. Cloudflare Dashboard → **D1** → **Create database**
2. database name: `mbti-db`

### 3-2) 스키마(마이그레이션) 적용
로컬/원격 모두 `migrations/0001_init.sql`을 적용해야 합니다.

#### 원격(Cloudflare) 적용
```bash
npx wrangler d1 migrations apply mbti-db
```

#### 로컬(dev) 적용
```bash
npx wrangler d1 migrations apply mbti-db --local
```

### 3-3) Pages 프로젝트에 D1 바인딩 추가
Pages 프로젝트 → **Settings → Functions → D1 bindings**:
- **Variable name**: `MBTI_DB`
- **Database**: `mbti-db`

> 코드 전체가 `env.MBTI_DB`를 사용합니다.

---

## 4) Pages Functions 환경 변수/시크릿

Pages 프로젝트 → **Settings → Variables and secrets**

### 4-1) Secrets (권장)
- `ADMIN_TOKEN`: Admin 전용 API 보호 토큰
  - Admin import: `POST /api/admin/import-d1`
  - 요청 헤더: `Authorization: Bearer <ADMIN_TOKEN>`

### 4-2) Variables (옵션)
- `EMIT_INDEX_ON_SAVE=1`
  - Admin 저장(`PUT /api/admin/tests/:id`) 성공 시 D1 데이터를 기반으로 `assets/index.json`을 R2에 재생성합니다(legacy/백업 용도).
- `ASSETS_BASE`, `R2_PUBLIC_BASE_URL`
  - 현재 프론트는 기본적으로 `/assets`(동일 오리진)를 쓰므로 필수는 아닙니다.
  - 외부 R2 public base를 직접 쓰는 운영을 하려면 사용합니다.

---

## 5) wrangler.toml에서 확인/설정할 것

파일: `wrangler.toml`

- Pages output: `pages_build_output_dir = "./public"`
- R2 바인딩:
  - `[[r2_buckets]] binding = "MBTI_BUCKET" bucket_name = "mbti-assets"`

### D1 주의사항(중요)
- 런타임은 `env.MBTI_DB`를 사용합니다.
- 로컬에서 D1을 붙여 실행하려면, 아래 스크립트를 사용하세요:
  - `npm run pages:dev:d1` 또는 `npm run dev:d1`

> 만약 `wrangler.toml`에 `[[d1_databases]]`를 넣어 쓸 경우에도 **binding 이름은 반드시 `MBTI_DB`**여야 합니다(현재 파일에 다른 이름이 있으면 불일치).

---

## 6) GitHub Actions 자동 배포 설정(테스트 통과 시 배포)

워크플로우: `.github/workflows/pages-deploy.yml`

GitHub 저장소 Settings → Secrets and variables → Actions → **New repository secret**:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

API 토큰은 최소 권한으로:
- Account 수준에서 Pages deploy 권한이 필요합니다(Cloudflare 토큰 템플릿 사용 권장).

> `projectName: mbtitest`가 실제 Pages 프로젝트 이름과 동일해야 합니다.

---

## 7) 로컬 개발(권장 커맨드)

### 7-1) 설치
```bash
npm install
```

### 7-2) 타입체크/테스트/빌드
```bash
npm run typecheck
npm test
npm run build
```

### 7-3) 로컬 실행
- 기본(번들 watch + pages dev):
```bash
npm run dev
```

- D1 포함(번들 watch + pages dev + local D1 binding):
```bash
npm run dev:d1
```

---

## 7-A) (중요) 로컬에서 “API가 어떤 로컬 D1 파일을 보고 있는지” 추적/고정 체크리스트

로컬 D1은 **상태 디렉토리(persist directory)** 가 다르면 완전히 다른 DB로 취급됩니다.  
그래서 아래 3가지를 “항상 같은 `--persist-to .wrangler/state`”로 고정하면 재발을 막을 수 있습니다.

### A-1) Pages dev를 반드시 persist-to로 실행
- 권장:
```bash
npm run dev:d1
```

직접 실행한다면:
```bash
npx wrangler pages dev ./public --compatibility-date=2024-12-08 --d1 MBTI_DB=mbti-db --persist-to .wrangler/state
```

### A-2) migrations/seed도 동일한 persist-to로 실행
```bash
npx wrangler d1 migrations apply mbti-db --local --persist-to .wrangler/state
npm run d1:seed:assets
```

### A-3) “API가 보는 DB”와 “CLI가 보는 DB”가 같은지 마지막 확인(가장 확실)
1) CLI로 테이블/행 확인:
```bash
npx wrangler d1 execute mbti-db --local --persist-to .wrangler/state --command "SELECT COUNT(*) AS cnt FROM tests;"
```

2) API로 확인:
```bash
curl -sS http://localhost:8788/api/tests
```

> 위 2개가 동시에 정상이고 `tests` 개수가 맞으면, **로컬에서 API는 D1을 정상 조회 중**입니다.

### A-4) 로컬에서 `no such table: tests`가 다시 뜨면(재발 해결 루틴)
1. 실행 중인 `wrangler pages dev`를 종료(Ctrl+C)
2. 로컬 상태 DB 초기화(삭제):
   - `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite*`
3. 다시:
```bash
npx wrangler d1 migrations apply mbti-db --local --persist-to .wrangler/state
npm run d1:seed:assets
npm run dev:d1
```

---

## 8) (운영) R2 → D1 Import 사용법

1. 먼저 D1 마이그레이션 적용이 되어 있어야 합니다.
2. Admin import endpoint 호출:
   - Scan only:
```bash
curl -X POST \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  https://<your-domain>/api/admin/import-d1
```

   - 실제 반영(apply):
```bash
curl -X POST \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  "https://<your-domain>/api/admin/import-d1?apply=1"
```

---

## 9) 트러블슈팅

### D1이 “missing binding”으로 뜰 때
- Pages 대시보드에서 **D1 binding name이 `MBTI_DB`**인지 확인
- Preview/Production 환경 각각 설정이 필요한지 확인

### /assets/*가 404일 때
- Pages Functions 배포가 포함되었는지 확인(`functions/assets/[[path]].ts`)
- Pages 프로젝트에서 R2 binding이 `MBTI_BUCKET`로 설정되었는지 확인

### (참고) `curl https://dreamp.org/api/tests`가 `assets/...`를 반환하는데 “D1이 아닌 것 같다”는 오해
- `/api/tests`는 **D1에서 thumbnail key를 읽어** 그대로 반환합니다.
- 그 key가 `assets/...` 형태인 것은 “R2에 있는 이미지의 경로(key)를 D1에 저장한다”는 설계 그대로입니다.


