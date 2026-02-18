# 성능·유지보수 개선 계획 (Cloudflare 기반)

Cloudflare 공식 문서 검색을 바탕으로, 현재 배포된 **Pages, Functions, R2, D1** 구조에서 성능을 더 끌어올리고 유지보수를 쉽게 하기 위한 방법론을 정리한 계획입니다.

---

## 1. 참고한 Cloudflare 문서 요약

| 항목                 | 출처                                                                    | 적용 방향                                                                 |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Tiered Cache**     | Workers Cache, `fetch` + `cf: { cacheTtl, cacheEverything }`            | 적용함. Worker가 `fetch(self, cf)`로 Tiered Cache 채움 (worker/index.ts). |
| **D1 batch()**       | D1 Worker API – 여러 prepared statement를 한 번에 전송                  | 한 핸들러에서 D1 호출이 2회 이상일 때 1회 왕복으로 축소.                  |
| **R2 Range**         | R2 GET 옵션 – `range: { offset, length }` 또는 `range: request.headers` | 대용량 에셋 부분 요청 시 대역폭·지연 감소.                                |
| **Pages Middleware** | Pages Functions Middleware – `onRequest`, `context.next()`              | 전역 에러 처리, 스택 트레이스 노출 방지, 인증 등 재사용 로직.             |
| **Bindings / env**   | wrangler.toml, 환경별 설정                                              | dev/staging/production 분리로 유지보수성 향상.                            |

---

## 2. 성능 개선 항목

### 2.1 D1 batch() 적용 (적용함)

- **대상**: `PUT /api/admin/tests/:id/results/:mbti/image`
- **기존**: `upsertTestImageMeta()` 1회 + `UPDATE tests SET updated_at` 1회 → D1 왕복 2회.
- **개선**: 두 문장을 `db.batch([stmt1, stmt2])`로 한 번에 실행 → D1 왕복 1회, 레이턴시 감소.
- **구현**: `worker/api/admin/utils/store.ts`에 `upsertTestImageMetaAndTouchBatch()` 추가, `worker/_types.ts`의 `D1Database`에 `batch()` 타입 추가.

### 2.2 R2 Range 요청 지원 (적용함)

- **대상**: `GET /assets/*` (에셋 프록시)
- **기준**: [R2 Ranged reads](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) – `get(key, { range: { offset, length } })`.
- **개선**: 클라이언트가 `Range` 헤더를 보내면 R2에 range 옵션으로 전달하고, 응답은 `206 Partial Content` + `Content-Range`로 반환. 대용량 파일·스트리밍 시 유리.
- **구현**: `worker/assets/handler.ts`에서 `Range` 헤더 파싱 → R2 `get(key, { range })` 호출 → 206/Content-Range 처리. 타입은 `worker/_types.ts`의 `R2Bucket.get()` 옵션 확장.

### 2.3 Tiered Cache (적용함 — fetch+cf)

- **적용**: Worker가 캐시 가능한 GET(`/api/tests`, `/api/tests/:id`, `/assets/*`)에 대해 자기 자신을 `fetch(..., { cf: { cacheTtl, cacheEverything, cacheTags } })`로 호출하여 Tiered Cache를 채움.
- **구현**: [Cache using fetch](https://developers.cloudflare.com/workers/examples/cache-using-fetch) 패턴. `worker/index.ts`에서 내부 헤더 `X-Mbti-Origin-Request`로 subrequest 구분, 오리진 처리 시 응답이 cf 옵션에 의해 Tiered Cache에 적재됨.
- **TTL**: 목록 300초, 테스트 상세 600초, 에셋 86400초. 퍼지는 Purge by Tag/URL로 수행.

---

## 3. 유지보수성 개선 항목

### 3.1 Worker 전역 에러 처리 (적용함)

- **기준**: Worker `fetch` 핸들러에서 try/catch로 전체 요청 래핑.
- **개선**:
  - 모든 라우트에서 발생한 미처리 예외를 한 곳에서 처리.
  - 프로덕션에서는 클라이언트에 **스택 트레이스 노출 안 함** (보안·AGENTS.md 준수).
  - 에러 메시지는 `{ error: string }` JSON, 500.
- **구현**: `worker/index.ts`의 `fetch` 내부에서 try/catch, catch 시 로그만 상세 출력하고 응답은 일반 메시지로.

### 3.2 바인딩·타입 정리 (적용함)

- **D1**: `D1Database`에 `batch(statements: D1PreparedStatement[]): Promise<...>` 추가해 D1 batch API와 타입 일치.
- **R2**: `R2Bucket.get(key, options?)`에 `range` 옵션 타입 추가 (R2GetOptions 스타일).
- **유지보수**: 데이터 계층은 `store.ts`와 `_types.ts`에 모아, 핸들러는 짧게 유지.

### 3.3 환경별 설정 (문서화)

- **기준**: [Workers env](https://developers.cloudflare.com/style-guide/components/render) – `wrangler.toml`의 `[env.dev]`, `[env.production]` 등.
- **권장**: Pages 프로젝트에서도 가능하면 환경별 D1/KV namespace 분리. 실제 적용은 배포 파이프라인과 함께 진행.

---

## 4. 적용 체크리스트

| 항목                               | 상태   | 비고                                                  |
| ---------------------------------- | ------ | ----------------------------------------------------- |
| D1 batch() in result image handler | 적용   | store에 `upsertTestImageMetaAndTouchBatch`, 타입 확장 |
| R2 Range in assets proxy           | 적용   | Range 헤더 → 206 + Content-Range                      |
| Worker index.ts 에러 처리          | 적용   | 스택 미노출, JSON `{ error }`                         |
| D1Database / R2Bucket 타입 확장    | 적용   | batch, get options                                    |
| Tiered Cache fetch+cf 적용         | 적용   | worker/index.ts, CLOUDFLARE_PERFORMANCE.md            |
| 환경별 wrangler                    | 문서화 | 필요 시 env.dev/production 적용                       |
| wrangler compatibility_date        | 적용   | 2025-01-01로 갱신 (Cloudflare Cursor 플러그인 계획)   |

---

## 5. 참고 링크

- [Cache using fetch](https://developers.cloudflare.com/workers/examples/cache-using-fetch)
- [D1 batch()](https://developers.cloudflare.com/d1/worker-api/d1-database)
- [R2 Ranged reads](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Pages Functions Middleware](https://developers.cloudflare.com/pages/functions/middleware)
