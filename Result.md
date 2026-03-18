# dreamp.org 이미지 로딩 속도 분석 결과

**분석 일시**: 2026-03-08  
**방법**: Playwright MCP (Network 탭 캡처) + Cloudflare MCP (인프라 확인) + 코드 로직 분석

---

## 1. 측정 요약 (Playwright Network 탭)

### 1.1 홈페이지 (https://dreamp.org)

| 이미지                         | Duration (ms) | Size   | Initiator      |
| ------------------------------ | ------------- | ------ | -------------- |
| mainLogo.png                   | 944           | 12 KB  | link (preload) |
| mainbanner.png                 | 1,276         | 118 KB | link (preload) |
| new.png                        | 776           | 2 KB   | img            |
| fire.png                       | 719           | 2 KB   | img            |
| FooterBackgroundImg.png        | 237           | 11 KB  | css            |
| test-root-vegetables/thumbnail | 1,351         | 46 KB  | img            |
| test-summer/thumbnail          | 1,136         | 36 KB  | img            |
| favicon.png                    | 636           | 1 KB   | other          |

**특징**: 홈페이지 이미지 700ms~1,350ms 소요. preload된 mainLogo·mainbanner도 1초 이상.

---

### 1.2 Test intro (https://dreamp.org/testintro.html?testId=test-summer)

| 이미지                 | Duration (ms) | Size       | Initiator |
| ---------------------- | ------------- | ---------- | --------- |
| TestStart.png          | 1,187         | 8 KB       | img       |
| TestShare.png          | 756           | 8 KB       | img       |
| HeaderBackgroundImg    | 1,002         | 13 KB      | css       |
| SNS 아이콘 (4개)       | 599~1,352     | 1 KB each  | img       |
| thumbnail (webp)       | 333           | 0 (cached) | img       |
| author.png             | 706           | 0 (cached) | img       |
| **퀴즈 preload (40+)** | 242~1,547     | 0          | fetch     |

**특징**: testintro에서 `startBackgroundPrefetch`가 40개 이상 이미지를 fetch로 preload. ENFJ.png, ENFP.png 등 404 발생.

---

### 1.3 Test quiz (https://dreamp.org/testquiz.html?testId=test-summer)

| 이미지                     | Duration (ms) | Size | Initiator      |
| -------------------------- | ------------- | ---- | -------------- |
| q4.png (320w)              | 2             | 300  | link (preload) |
| q4.png (480w)              | 2             | 300  | img            |
| q4.png (480w, format=auto) | 468           | 0    | img            |
| mainLogo                   | 4             | 0    | img            |

**특징**: testquiz는 캐시 히트 시 2~4ms로 매우 빠름. 일부 q4.png variant 실패.

---

## 2. 로직적 원인 분석

### 2.1 홈페이지 (700ms~1,350ms)

| 원인             | 설명                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------ |
| **콜드 캐시**    | 첫 방문 시 `/cdn-cgi/image` → Cloudflare Image Resizing → Worker → R2 전체 경로 왕복 |
| **format=auto**  | index.html, main.js의 카드 이미지가 여전히 `format=auto` 사용 → AVIF 인코딩 비용     |
| **preload 중복** | mainLogo, mainbanner가 preload + img src로 이중 요청 가능                            |
| **srcset 3폭**   | 320, 480, 640 (또는 480, 768, 1230) → 브라우저가 1개 선택하지만 URL 생성 시점에 처리 |

### 2.2 Test intro (600ms~1,500ms + 40+ preload)

| 원인                    | 설명                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **과도한 preload**      | `startBackgroundPrefetch`가 40개 이상 이미지를 fetch로 preload. `preloadQuestionImages` + `preloadResultImages`가 q1~q12, 16개 MBTI 결과 이미지 등 |
| **동시 요청 병목**      | concurrency 2~4로 동시 fetch → Cloudflare Image Resizing / Worker / R2에서 경쟁                                                                    |
| **404 이미지**          | ENFJ.png, ENFP.png 등 result 이미지 경로 불일치 (대소문자, 확장자)                                                                                 |
| **requestIdleCallback** | Phase 1은 1200ms timeout, Phase 2는 2000ms 후 실행 → 초기 로드 시점과 겹치며 네트워크 경쟁                                                         |

### 2.3 Test quiz (2~4ms 캐시 히트 vs 468ms 미스)

| 원인                           | 설명                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| **캐시 히트**                  | testintro preload 또는 SW 캐시로 q4.png 320w, 480w가 즉시 반환                   |
| **format 불일치**              | q4.png 480w variant 중 `format=auto` URL이 468ms 소요 → 캐시 키가 달라 별도 요청 |
| **injectFirstQuestionPreload** | 첫 질문 이미지 preload가 LCP 개선에 기여                                         |

### 2.4 공통 로직 이슈

| 항목      | 파일         | 내용                                                            |
| --------- | ------------ | --------------------------------------------------------------- |
| srcset    | config.js    | `maybeApplySrcset`가 320,480,640 등 3폭 생성 → 요청 수 증가     |
| 에러 폴백 | config.js    | `error` 시 1회 재시도 후 `/assets/*` 원본으로 폴백 (구현됨)     |
| SW 캐시   | sw.js        | `/cdn-cgi/image`, `/assets` 캐시. revalidate 30초 디바운스 적용 |
| 캐시 이름 | testintro.js | `mbti-assets-v2`로 SW와 통일됨                                  |

---

## 3. Cloudflare 인프라 분석 (MCP)

### 3.1 확인된 리소스

| 리소스      | 값                                                           |
| ----------- | ------------------------------------------------------------ |
| Worker      | mbtitest-api (id: fa2e9eb86b054d2388ead6605b696fbb)          |
| R2 Bucket   | mbti-assets (created 2025-12-08)                             |
| D1 Database | mbti-db (uuid: b3d4e76a-4e45-4070-9e89-701c35cb642f)         |
| Routes      | dreamp.org/api/_, dreamp.org/assets/_, dreamp.org/cdn-cgi/\* |

### 3.2 요청 경로 (Cold Path)

```
사용자 → Cloudflare Edge
         → /cdn-cgi/image/* (Image Resizing)
              → origin fetch: GET /assets/test-xxx/images/q1.png
                   → Worker (mbtitest-api)
                        → R2 (mbti-assets)
         → 리사이즈 + 포맷 변환
         → 사용자 응답
```

### 3.3 Cloudflare 측 지연 원인

| 원인                   | 설명                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tiered Cache**       | Worker가 `/assets/*`에 `cacheTtl: 86400` 적용. Image Resizing의 origin fetch가 Worker를 거치므로 Tiered Cache가 채워짐. 단, **콜드 시** 첫 요청은 R2까지 왕복 |
| **R2 리전**            | mbti-assets 버킷. 리전 미명시 시 기본(APAC 등) 가능. 사용자 ↔ 엣지 ↔ R2 거리에 따라 50~200ms 추가                                                             |
| **Image Resizing**     | `/cdn-cgi/image` 출력은 Cloudflare의 별도 캐시. **Cache Rules**에서 `*dreamp.org/cdn-cgi/image/*` Edge TTL 1일 설정 시 두 번째 요청부터 50ms 이하 수준 기대   |
| **Cache Rules 미확인** | CLOUDFLARE_PERFORMANCE.md에 `/cdn-cgi/image/*` Cache Rules 권장. 대시보드에서 미설정 시 매 요청마다 Image Resizing 처리                                       |
| **MCP 한계**           | cloudflare-bindings MCP는 zones, cache, analytics 미지원. Cache Rules·캐시 적중률은 대시보드 또는 REST/GraphQL API로 확인 필요                                |

### 3.4 Worker / R2 설정

| 항목                | Worker                                        | 비고                              |
| ------------------- | --------------------------------------------- | --------------------------------- |
| assets Tiered Cache | cacheTtl: 86400, cacheTags: assets, test-{id} | `worker/http/routes.ts`           |
| R2 바인딩           | MBTI_BUCKET → mbti-assets                     | `worker/wrangler.toml`            |
| SELF 바인딩         | mbtitest-api                                  | Tiered Cache 채우기용 self-invoke |

---

## 4. 종합 요약

### 4.1 홈페이지·testintro 지연 (700ms~1,500ms)

| 구분           | 원인                                                           |
| -------------- | -------------------------------------------------------------- |
| **로직**       | format=auto, 과도한 preload(40+), 동시 요청 병목               |
| **Cloudflare** | 콜드 캐시, `/cdn-cgi/image` Cache Rules 미설정 가능성, R2 왕복 |

### 4.2 testquiz 빠른 응답 (2~4ms)

| 구분           | 원인                                      |
| -------------- | ----------------------------------------- |
| **로직**       | testintro preload + SW 캐시로 q4.png 히트 |
| **Cloudflare** | Tiered Cache / Worker Cache API 적중      |

### 4.3 권장 조치

| 우선순위 | 조치                                                                   | 효과                    |
| -------- | ---------------------------------------------------------------------- | ----------------------- |
| 1        | **Cache Rules**: `*dreamp.org/cdn-cgi/image/*` Edge TTL 1일            | 콜드 이후 50ms 이하     |
| 2        | **testintro preload 축소**: 40+ → 4~8개(첫 2문항 + 결과 2개)           | 503 병목·병렬 경쟁 감소 |
| 3        | **홈 format=webp**: index.html, main.js 카드 이미지 format=auto → webp | 100~200ms 처리 단축     |
| 4        | **404 수정**: ENFJ.png, ENFP.png 등 result 이미지 경로 검증            | 불필요한 실패 요청 제거 |
