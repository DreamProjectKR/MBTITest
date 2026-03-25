# Test Strategy

## 목적

이 문서는 MBTI ZOO의 자동 테스트 구조와 최소 커버리지 기준을 정의합니다.

## 테스트 레이어

### 1. Domain Tests

대상:

- path 정규화
- payload validation
- merge helper
- MBTI 계산 로직

목표:

- 순수 함수는 빠르고 독립적인 테스트로 검증합니다.

### 2. Workflow Tests

대상:

- public browse
- admin save
- generic image upload
- result image upload
- cache invalidation

목표:

- D1/R2/KV/Cache stub을 사용해 유스케이스 단위의 성공/실패 경로를 검증합니다.

### 3. Routing Tests

대상:

- `worker/router.ts`
- `worker/index.ts`

목표:

- path parsing, method dispatch, route registration drift를 막습니다.

### 4. Asset Proxy Tests

대상:

- cache policy
- ETag
- Range request
- legacy key fallback

### 5. Frontend Admin Tests

대상:

- reducer/store
- selector
- 핵심 smoke flow

목표:

- admin state transition과 주요 UI workflow가 회귀하지 않도록 보장합니다.

### 6. Security / HTTP Utils Tests

대상:

- `worker/api/_utils/bodyLimits.ts`, `rateLimit.ts`
- `POST /api/tests/:id/compute` (공개 여부, 본문 크기, KV 속도 제한)
- `GET/PUT .../images` (SVG 거부, 업로드 크기, 속도 제한)
- `loadTestDetail`, `listTests` 분기 (KV/캐시/404/500)
- `dispatchWorkerRequest` (예외 처리, Tiered Cache `SELF`, origin 서브요청)

목표:

- 보안 관련 상수·분기와 `dispatch`의 `await handler` 비동기 예외 포착을 회귀 테스트로 고정합니다.

## 권장 폴더 구조

```text
tests/
├── shared/
│   ├── fixtures/
│   ├── factories/
│   ├── kv-harness.mjs
│   └── worker-harness.mjs
├── api/
│   ├── admin-images-security.test.mjs
│   ├── compute-security.test.mjs
│   ├── list-tests.test.mjs
│   └── load-test-detail.test.mjs
├── utils/
│   ├── body-limits.test.mjs
│   └── rate-limit.test.mjs
├── http/
│   ├── dispatch-tiered-cache.test.mjs
│   └── dispatch-worker.test.mjs
├── domain/
├── public-browse/
├── admin-authoring/
├── admin-images/
├── assets-proxy/
├── routing/
└── frontend/
```

## 최소 커버리지 기준

아래 항목은 신규 변경 시 반드시 회귀 테스트를 가져야 합니다.

- public 목록/상세 공개 정책
- admin save validation + publish transition
- `PUT /api/admin/tests/:id` 성공/실패 경로
- `PUT /api/admin/tests/:id/images` 성공/실패 경로
- `PUT /api/admin/tests/:id/results/:mbti/image` 성공/실패 경로
- `POST /api/tests/:id/compute`
- `/assets/*` cache/etag/range/fallback
- route registry/dispatch

## 공통 규칙

- 테스트는 기능 기준으로 묶고 파일 기준으로 묶지 않습니다.
- 성공 경로 1개, 실패 경로 1개를 최소 단위로 요구합니다.
- D1/R2/KV/Cache stub은 shared harness로 통일합니다.
- 새 workflow는 harness 없이 ad hoc stub를 복제하지 않습니다.

## 실행 규칙

- 기본 전체 실행: `npm test`
- Worker TypeScript 라인 커버리지(대략적): `npm run test:coverage` — `worker/**/*.ts` 포함, V8 리포트는 터미널에 출력됩니다. **전체 저장소 100%는 목표로 하지 않으며**, `public/` 정적 스크립트·일부 분기는 별도 E2E/수동 검증과 병행합니다.
- 리팩터링 중에는 변경 범위에 맞는 하위 테스트 묶음을 빠르게 실행할 수 있어야 합니다.
- 최종 완료 전에는 전체 테스트 명령을 다시 실행합니다.

## 문서와 테스트의 관계

- `docs/API.md`의 계약은 public/admin workflow 테스트로 뒷받침되어야 합니다.
- `docs/ARCHITECTURE_CONSTRAINTS.md`의 mutation/cache 제약은 workflow 테스트로 증명되어야 합니다.
- `docs/WORKFLOW_SPECS.md`에 정의한 흐름이 바뀌면 관련 테스트와 문서를 함께 수정해야 합니다.
