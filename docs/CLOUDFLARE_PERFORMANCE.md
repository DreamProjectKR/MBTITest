# Cloudflare 성능 최적화 가이드

이 문서는 `dreamp.org`(Pages 정적 + Worker API) 배포 환경에서 로딩 성능을 최적화하기 위한 설정과 전략을 정리합니다.

**설정**: `worker/wrangler.toml`의 `compatibility_date`로 최신 런타임 기능을 활용한다.

## 현재 아키텍처

- **Pages**: 정적 HTML/CSS/JS만 호스팅
- **Worker**: API + R2 에셋 프록시 (Tiered Cache 활용)
- **D1**: 테스트 메타데이터
- **R2**: 테스트 본문 JSON + 이미지
- **KV**: 테스트 상세 응답 캐시 (TTL 300초)
- **이미지 최적화**: `/cdn-cgi/image` (format=auto + resize)

## 1. Rocket Loader (권장: OFF)

`type="module"`/`defer` 스크립트는 브라우저가 이미 최적화하므로, Rocket Loader 개입은 초기 렌더를 지연시킬 수 있습니다.

**설정**: Cloudflare Dashboard > Speed > Optimization > Rocket Loader > **Off**

## 2. 다중 캐시 계층

### KV 캐시 (구현됨)

`GET /api/tests/:id` 응답을 KV에 5분 TTL로 캐싱합니다.

- **읽기**: KV 히트 → 즉시 반환 (D1+R2 접근 없음)
- **쓰기**: 어드민 저장 시 KV 키 삭제
- **바인딩**: `MBTI_KV` (worker/wrangler.toml)

### Tiered Cache (Worker) — fetch+cf 적용됨

Worker가 캐시 가능한 GET 요청(`/api/tests`, `/api/tests/:id`, `/assets/*`)에 대해 **fetch(self, cf)** 패턴을 사용해 Tiered Cache를 채웁니다. 내부 헤더 `X-Mbti-Origin-Request`로 subrequest를 구분하고, 오리진 처리 시 D1/R2/KV 응답이 `cf: { cacheTtl, cacheEverything, cacheTags }`에 의해 Tiered Cache에 적재됩니다.

- **라우트별 TTL**: 목록 300초, 테스트 상세 600초, 에셋 86400초
- **cacheTags**: `api`, `api-tests`, `test-{id}`(에셋은 경로에서 testId 추출 시 추가)
- `s-maxage` + `stale-while-revalidate` + `stale-if-error`로 엣지 TTL 제어
- `Vary: Accept-Encoding`으로 압축/비압축 응답 분리
- **Purge by Tag**: `Cache-Tag` 헤더로 태그별 선택 퍼지 (대시보드 또는 API)

**참고**: Tiered Cache는 존 단위로 대시보드 또는 API에서 별도 활성화해야 합니다.

### Cache-Tag (구현됨)

API 및 에셋 응답에 `Cache-Tag` 헤더를 추가하여 선택적 퍼지가 가능합니다.

- **API**: `GET /api/tests` → `api`, `api-tests`; `GET /api/tests/:id` → `api`, `api-tests`, `test-{id}`
- **에셋** (`/assets/*`): `assets`, `test-{testId}`

특정 테스트 에셋만 퍼지하려면:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -d '{"tags":["test-summer"]}'
```

### 어드민 응답 (구현됨)

모든 어드민 API 응답에 `Cache-Control: no-store`를 적용하여 변형(mutation) 응답의 캐시를 방지합니다.

### 자동 캐시 퍼지 (구현됨)

어드민에서 테스트 저장 또는 이미지 업로드 시, Worker가 KV 키 삭제 및 Cache API 퍼지를 수행합니다.

- `PUT /api/admin/tests/:id` → KV `test:{id}` 삭제, Cache API `/api/tests`, `/api/tests/:id` 퍼지
- `PUT /api/admin/tests/:id/images` → Cache API `/api/tests/:id` 퍼지
- `PUT /api/admin/tests/:id/results/:mbti/image` → KV 삭제, Cache API 퍼지

Tiered Cache 퍼지가 필요한 경우: [Purge by Tag](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/) 또는 Purge by URL 사용.

## 3. 정적 에셋 헤더 (구현됨)

`public/_headers`로 HTML/CSS/JS에 Cache-Control과 Early Hints를 적용합니다.

- **HTML**: `max-age=0, must-revalidate` + `Link` 헤더 (preconnect, preload)
- **CSS/JS**: `max-age=86400, stale-while-revalidate=604800`
- **Partials** (`/partials/*.html`): `max-age=3600, stale-while-revalidate=86400` — 헤더/푸터 HTML을 1시간 캐시, 재검증 시 24시간 stale 허용
- **Early Hints**: Pages가 `Link` 헤더를 캐시하여 103 Early Hints로 선행 전송 (LCP 개선)

### 헤더/푸터 파셜 로딩 개선 (Cloudflare Pages 정적 배포)

헤더·푸터는 `data-include`로 클라이언트에서 fetch 후 주입되므로, 본문이 먼저 보이고 약간의 지연 후 헤더/푸터가 나타날 수 있습니다. Pages 정적 배포만으로 개선할 수 있는 방법:

1. **적용됨 — Preload**  
   각 페이지 `<head>`에 `partials/header.html`, `partials/footer.html`(또는 admin용 `partials/admin-header.html`)을 `<link rel="preload" href="..." as="fetch">`로 넣어 두었습니다. 브라우저가 메인 HTML과 동시에 partial 요청을 시작하므로, `include-partials.js`가 실행될 때 이미 응답이 도착했거나 캐시에 있을 가능성이 높습니다.

2. **적용됨 — Partials 캐시**  
   `_headers`에서 `/partials/*.html`에 `max-age=3600, stale-while-revalidate=86400`를 적용했습니다. 재방문 시 partial은 브라우저/엣지 캐시에서 바로 사용됩니다.

3. **선택 — 빌드 타임 인라인**  
   배포 전 스크립트로 각 HTML의 `data-include` 자리를 실제 partial 내용으로 치환해 두면, 클라이언트에서 fetch할 필요가 없어 지연이 사라집니다. (정적 생성 시점에 header/footer를 인라인하는 방식.)

4. **선택 — Pages Functions / Worker**  
   HTML 요청을 Worker나 Pages Function에서 받아, 서버에서 partial을 읽어 넣은 뒤 한 번에 응답하는 방식도 가능합니다. 클라이언트 round-trip은 한 번이지만, 구현·운영 복잡도가 늘어납니다.

## 4. Cache Rules (대시보드, 선택)

코드 헤더가 실수로 변경되어도 캐시를 안정적으로 유지하려면 대시보드 규칙을 추가합니다.

| 규칙        | 매치                     | Edge TTL  |
| ----------- | ------------------------ | --------- |
| API 캐시    | `*dreamp.org/api/tests*` | 300-600초 |
| Assets 캐시 | `*dreamp.org/assets/*`   | 1년       |

### Caching Overview / Cache Reserve가 0B인 이유

Cloudflare 대시보드 **Caching Overview**에는 다음이 명시되어 있습니다.

- **"Only includes data on end-user traffic to your Cloudflare-proxied hostnames."**
- **"Subrequests from Cloud Workers are not included."**

즉, **Worker 서브요청(Worker가 내부적으로 하는 fetch)은 집계에 포함되지 않습니다.**  
`dreamp.org`의 `/api/*`, `/assets/*`는 모두 **Worker가 처리**하므로:

1. **엔드유저 요청**은 매번 Worker를 거칩니다.
2. Worker는 `self.fetch(..., { cf: { cacheTtl, cacheEverything, cacheTags } })`로 **Tiered Cache**를 채우지만, 이건 서브요청이라 Caching Overview 숫자에 반영되지 않습니다.
3. **Cache Reserve**는 “R2에 캐시를 저장하는” 별도 기능입니다. Tiered Cache(엣지 캐시)와는 다르며, Cache Reserve를 쓰는 규칙/트래픽이 없으면 **Egress savings / Requests served by Cache Reserve**가 0으로 나오는 것이 정상입니다.

**정리:**

- **0B라고 해서 캐시가 동작하지 않는 것은 아닙니다.** Worker 내부의 Cache API와 Tiered Cache(self.fetch + `cf`)로 R2/오리진 요청은 줄어듭니다.
- **Cache Reserve 지표**를 올리려면: 대시보드 **Caching > Cache Rules**에서 `/assets/*`(및 필요 시 `/cdn-cgi/image/*`)에 대해 **Eligible for cache** + **Edge TTL**을 넣고, 플랜/제품에 따라 **Cache Reserve에 저장** 옵션이 있으면 해당 규칙에 켜야 합니다. (Worker가 앞단에 있으면 Worker의 `cf` 설정이 Cache Rules보다 우선하므로, Worker에서 이미 `cacheTtl` 등을 주고 있다면 엣지 캐시는 동작합니다. Cache Reserve만 별도 설정 대상입니다.)
- **캐시 적중 여부 확인**: 같은 에셋 URL을 두 번 요청한 뒤 응답 헤더를 봅니다. `X-MBTI-Edge-Cache: HIT`(Worker가 Cache API로 준 값) 또는 Cloudflare가 붙이는 `cf-cache-status: HIT`가 있으면 엣지/캐시에서 내려온 것입니다.

### 캐시 적용 여부 확인 방법

배포된 사이트에서 캐시가 적용 중인지 확인하려면 아래를 사용합니다.

1. **브라우저 개발자 도구 (Network)**  
   - 사이트 접속 후 F12 → **Network** 탭  
   - 해당 URL 선택 → **Headers**에서 **Response Headers** 확인  
   - **`cf-cache-status`**: `HIT` = 엣지 캐시 적중, `MISS` = 오리진에서 가져옴, `EXPIRED` = 재검증 중  
   - **`Cache-Control`**: `max-age`, `s-maxage`, `stale-while-revalidate` 등으로 캐시 정책 확인  
   - 같은 URL을 두 번 연속 요청했을 때 두 번째에서 `cf-cache-status: HIT`가 나오면 캐시가 동작하는 것입니다.

2. **curl로 헤더만 확인**  
   ```bash
   curl -sI "https://dreamp.org/partials/header.html"
   ```  
   응답에 `cf-cache-status`, `Cache-Control`, `Age`(캐시에 머문 초 수)가 포함됩니다.  
   - **API/에셋**(Worker 경유): `X-MBTI-Edge-Cache: HIT` 여부도 확인  
   ```bash
   curl -sI "https://dreamp.org/api/tests"
   ```

3. **Cloudflare 대시보드**  
   - **Caching > Configuration**: Cache Level, Browser Cache TTL  
   - **Analytics > Caching**: 캐시 적중률 (엔드유저 요청 기준이며, Worker 서브요청은 별도 집계에 포함되지 않을 수 있음)

## 5. D1 인덱스 (적용됨)

성능에 영향을 주는 인덱스는 마이그레이션으로 관리합니다.

| 인덱스                        | 대상 쿼리                  | 마이그레이션           |
| ----------------------------- | -------------------------- | ---------------------- |
| `idx_tests_updated_at_desc`   | `ORDER BY updated_at DESC` | `0002_add_indexes.sql` |
| `idx_tests_title`             | 제목 검색                  | `0003_schema_v2.sql`   |
| `idx_tests_published_updated` | 공개+정렬 필터             | `0003_schema_v2.sql`   |
| `idx_test_images_test_id`     | 테스트별 이미지 조회       | `0003_schema_v2.sql`   |

마이그레이션 적용:

```bash
npm run d1:migrate:local    # 로컬
npm run d1:migrate:remote   # 프로덕션
```

## 6. 이미지 최적화 전략

### Image Resizing (현재 사용 중)

`/cdn-cgi/image/{params}/{path}` 형식으로 자동 포맷 변환 + 리사이징합니다.

- `format=auto` -- 브라우저 지원 시 WebP/AVIF 자동 선택
- `width`, `quality`, `fit` -- 크기/품질/맞춤 제어
- `srcset` -- 반응형 이미지 (360w, 480w, 720w)

### 프리로드 (구현됨)

퀴즈/결과 페이지에서 첫 번째 이미지를 `<link rel="preload" as="image">`로 동적 주입합니다.

### 폴백 전략 (구현됨)

`/cdn-cgi/image`가 실패하면 (503 등) 원본 `/assets/*` URL로 자동 폴백합니다.

- 각 `<img>` 요소에 1회성 `error` 이벤트 리스너 등록
- 리사이징 실패 시 `data-asset-resize` 제거 후 원본 요청

## 7. 에셋 프록시 캐시 정책

Worker의 `worker/assets/handler.ts` (에셋 핸들러)에서 키 유형별 캐시 정책:

| 에셋 유형        | Cache-Control                                      | 조건                      |
| ---------------- | -------------------------------------------------- | ------------------------- |
| JSON             | `public, max-age=60, s-maxage=60, must-revalidate` | --                        |
| 버전 쿼리(`?v=`) | `public, max-age=1y, immutable`                    | `?v=` 파라미터 존재       |
| UI 이미지        | `public, max-age=1y, immutable`                    | `assets/images/` 경로     |
| 테스트 이미지    | `public, max-age=1d, s-maxage=1d`                  | 어드민에서 덮어쓸 수 있음 |

## 8. 서버 사이드 MBTI 계산 (구현됨)

`POST /api/tests/:id/compute` 엔드포인트로 MBTI 결과를 서버에서 계산합니다.

- 클라이언트 조작 방지
- 축별 퍼센트 제공 (결과 페이지 시각화용)
- 클라이언트 폴백: 서버 응답 실패 시 로컬 계산 사용
