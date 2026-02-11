# 성능·유지보수 개선 계획 (Cloudflare 기반)

Cloudflare 공식 문서 검색을 바탕으로, 현재 배포된 **Pages, Functions, R2, D1** 구조에서 성능을 더 끌어올리고 유지보수를 쉽게 하기 위한 방법론을 정리한 계획입니다.

---

## 1. 참고한 Cloudflare 문서 요약

| 항목                 | 출처                                                                    | 적용 방향                                                                                          |
| -------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Tiered Cache**     | Workers Cache, `fetch` + `cf: { cacheTtl, cacheEverything }`            | 엣지 캐시를 여러 PoP에 퍼뜨리려면 `fetch(origin)` + `cf` 사용. 현재는 Cache API로 단일 PoP만 캐시. |
| **D1 batch()**       | D1 Worker API – 여러 prepared statement를 한 번에 전송                  | 한 핸들러에서 D1 호출이 2회 이상일 때 1회 왕복으로 축소.                                           |
| **R2 Range**         | R2 GET 옵션 – `range: { offset, length }` 또는 `range: request.headers` | 대용량 에셋 부분 요청 시 대역폭·지연 감소.                                                         |
| **Pages Middleware** | Pages Functions Middleware – `onRequest`, `context.next()`              | 전역 에러 처리, 스택 트레이스 노출 방지, 인증 등 재사용 로직.                                      |
| **Bindings / env**   | wrangler.toml, 환경별 설정                                              | dev/staging/production 분리로 유지보수성 향상.                                                     |

---

## 2. 성능 개선 항목

### 2.1 D1 batch() 적용 (적용함)

- **대상**: `PUT /api/admin/tests/:id/results/:mbti/image`
- **기존**: `upsertTestImageMeta()` 1회 + `UPDATE tests SET updated_at` 1회 → D1 왕복 2회.
- **개선**: 두 문장을 `db.batch([stmt1, stmt2])`로 한 번에 실행 → D1 왕복 1회, 레이턴시 감소.
- **구현**: `functions/api/admin/utils/store.ts`에 `upsertTestImageMetaAndTouchBatch()` 추가, `_types.ts`의 `D1Database`에 `batch()` 타입 추가.

### 2.2 R2 Range 요청 지원 (적용함)

- **대상**: `GET /assets/*` (에셋 프록시)
- **기준**: [R2 Ranged reads](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) – `get(key, { range: { offset, length } })`.
- **개선**: 클라이언트가 `Range` 헤더를 보내면 R2에 range 옵션으로 전달하고, 응답은 `206 Partial Content` + `Content-Range`로 반환. 대용량 파일·스트리밍 시 유리.
- **구현**: `functions/assets/[[path]].ts`에서 `Range` 헤더 파싱 → R2 `get(key, { range })` 호출 → 206/Content-Range 처리. 타입은 `_types.ts`의 `R2Bucket.get()` 옵션 확장.

### 2.3 Tiered Cache (선택·문서화)

- **현재**: `caches.default.put()`으로 Cache API만 사용 → 단일 엣지 PoP에만 캐시.
- **문서 권장**: [Cache using fetch](https://developers.cloudflare.com/workers/examples/cache-using-fetch) – `fetch(request, { cf: { cacheTtl, cacheEverything } })` 사용 시 Cloudflare Tiered Cache가 동작해 여러 PoP에 캐시 가능.
- **적용 방식**: API/에셋 응답을 Worker에서 직접 만드는 대신, 같은 URL로 `fetch(origin + path, { cf: { cacheTtl, cacheEverything } })` 한 번 하여 Tiered Cache에 적재하는 패턴으로 전환 가능. 구조 변경이 크므로 **현재는 CLOUDFLARE_PERFORMANCE.md에 옵션으로만 기술**하고, 필요 시 별도 작업으로 진행.

---

## 3. 유지보수성 개선 항목

### 3.1 Pages Functions 전역 에러 처리 (적용함)

- **기준**: [Pages Functions Middleware](https://developers.cloudflare.com/pages/functions/middleware) – `try { return await context.next(); } catch (err) { ... }`.
- **개선**:
  - 모든 Functions에서 발생한 미처리 예외를 한 곳에서 처리.
  - 프로덕션에서는 클라이언트에 **스택 트레이스 노출 안 함** (보안·AGENTS.md 준수).
  - 에러 메시지는 `{ error: string }` JSON, 500.
- **구현**: `functions/_middleware.ts` 추가. `onRequest`에서 `context.next()` 래핑, catch 시 로그만 상세 출력하고 응답은 일반 메시지로.

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
| Pages \_middleware.ts 에러 처리    | 적용   | 스택 미노출, JSON `{ error }`                         |
| D1Database / R2Bucket 타입 확장    | 적용   | batch, get options                                    |
| Tiered Cache 옵션 문서화           | 적용   | CLOUDFLARE_PERFORMANCE.md                             |
| 환경별 wrangler                    | 문서화 | 필요 시 env.dev/production 적용                       |

---

## 5. 참고 링크

- [Cache using fetch](https://developers.cloudflare.com/workers/examples/cache-using-fetch)
- [D1 batch()](https://developers.cloudflare.com/d1/worker-api/d1-database)
- [R2 Ranged reads](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Pages Functions Middleware](https://developers.cloudflare.com/pages/functions/middleware)
