# Cloudflare 성능 최적화 가이드

이 문서는 `dreamp.org`(Cloudflare Pages) 배포 환경에서 로딩 성능을 최적화하기 위한 설정과 전략을 정리합니다.

## 현재 아키텍처

- **Pages Functions**: API + R2 프록시
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
- **바인딩**: `MBTI_KV` (wrangler.toml)

### Cache API (구현됨)

`caches.default`를 이용한 엣지 캐시입니다.

- ETag 기반 캐시 키로 콘텐츠 변경 시 자동 회피
- `s-maxage` + `stale-while-revalidate`로 엣지 TTL 제어

### Cache-Tag (구현됨)

`/assets/*` 응답에 `Cache-Tag` 헤더를 추가하여 선택적 퍼지가 가능합니다.

- `assets` -- 모든 에셋
- `test-{testId}` -- 특정 테스트의 에셋만

특정 테스트 에셋만 퍼지하려면:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -d '{"tags":["test-summer"]}'
```

## 3. Cache Rules (대시보드, 선택)

코드 헤더가 실수로 변경되어도 캐시를 안정적으로 유지하려면 대시보드 규칙을 추가합니다.

| 규칙        | 매치                     | Edge TTL |
| ----------- | ------------------------ | -------- |
| API 캐시    | `*dreamp.org/api/tests*` | 60초     |
| Assets 캐시 | `*dreamp.org/assets/*`   | 1년      |

## 4. D1 인덱스 (적용됨)

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

## 5. 이미지 최적화 전략

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

## 6. 에셋 프록시 캐시 정책

`functions/assets/[[path]].ts`에서 키 유형별 캐시 정책:

| 에셋 유형        | Cache-Control                                      | 조건                      |
| ---------------- | -------------------------------------------------- | ------------------------- |
| JSON             | `public, max-age=60, s-maxage=60, must-revalidate` | --                        |
| 버전 쿼리(`?v=`) | `public, max-age=1y, immutable`                    | `?v=` 파라미터 존재       |
| UI 이미지        | `public, max-age=1y, immutable`                    | `assets/images/` 경로     |
| 테스트 이미지    | `public, max-age=1d, s-maxage=1d`                  | 어드민에서 덮어쓸 수 있음 |

## 7. 서버 사이드 MBTI 계산 (구현됨)

`POST /api/tests/:id/compute` 엔드포인트로 MBTI 결과를 서버에서 계산합니다.

- 클라이언트 조작 방지
- 축별 퍼센트 제공 (결과 페이지 시각화용)
- 클라이언트 폴백: 서버 응답 실패 시 로컬 계산 사용
