# 이미지 단일 요청 지연 (400~800ms) 분석 및 해결 방안

## 현상

- **단일 이미지 요청**에도 400ms~800ms 소요 (Q1: 522ms, Q6: 812ms, Q2: 423ms)
- avif / fetch 각 1회씩 요청 시에도 동일한 수준의 지연
- Service Worker 캐시 히트로 보이는 요청도 400ms 이상 → 실제로는 캐시 미스이거나, DevTools가 revalidate 포함 전체 수명을 표시하는 경우

---

## 요청 경로 (Cold Path)

```
사용자 → Cloudflare Edge → /cdn-cgi/image (Image Resizing)
                                    ↓
                            origin fetch: GET /assets/test-xxx/images/Q1.png
                                    ↓
                            Worker (R2 프록시) → R2 GET
                                    ↓
                            Image Resizing: 리사이즈 + 포맷 변환(AVIF/WebP)
                                    ↓
                            사용자에게 응답
```

### 지연 구성 요소 (추정)

| 구간                                   | 예상 지연     | 비고                 |
| -------------------------------------- | ------------- | -------------------- |
| 사용자 ↔ Edge                          | 20~80ms       | 사용자 위치에 따라   |
| Image Resizing → Worker (origin fetch) | 30~100ms      | Worker가 R2 조회     |
| Worker → R2                            | 50~200ms      | R2 APAC, 콜드 스타트 |
| Image Resizing 처리 (리사이즈·인코딩)  | 100~300ms     | AVIF 인코딩 비용 큼  |
| **합계**                               | **200~680ms** | 최악 시 800ms+       |

---

## 원인 분석

### 1. 콜드 캐시

- 첫 요청 시 전체 경로(Image Resizing → Worker → R2)를 한 번씩 거침
- `/cdn-cgi/image` 응답이 엣지에 캐시되지 않으면 매 요청마다 origin fetch + 처리 발생

### 2. Cache Rules 미적용

- `CLOUDFLARE_PERFORMANCE.md`에는 `/assets/*`에 대한 Cache Rules만 언급
- `/cdn-cgi/image/*`에 대한 Edge TTL이 없으면, 리사이즈 결과가 엣지에 캐시되지 않음

### 3. format=auto의 비용

- `format=auto`는 Accept 헤더에 따라 AVIF/WebP 등으로 분기
- AVIF 인코딩이 WebP보다 무거워 처리 시간 증가

### 4. R2 지연

- R2 APAC 리전 기준, 사용자/엣지와의 거리에 따라 50~200ms 추가 가능
- Worker → R2 첫 요청 시 콜드 스타트 가능

### 5. 동시 요청 병목

- 여러 이미지가 동시에 요청되면 Worker/R2/Image Resizing에서 경쟁 발생
- 단일 요청이라도 다른 리소스와 경쟁 시 지연 증가

---

## 해결 방안

### Phase A: 즉시 적용 (대시보드·설정)

#### A.1 Cache Rules: `/cdn-cgi/image/*` Edge TTL

**Cloudflare Dashboard** → Caching → Cache Rules

| 규칙                | 매치                          | Edge TTL    | 비고                    |
| ------------------- | ----------------------------- | ----------- | ----------------------- |
| Image Resizing 캐시 | `*dreamp.org/cdn-cgi/image/*` | 86400 (1일) | 리사이즈 결과 엣지 캐시 |

효과: 두 번째 요청부터 엣지 캐시 히트로 50ms 이하 수준 기대.

#### A.2 Cache Rules: `/assets/*` 확인

`/assets/*`에 대한 Cache Rules가 이미 있다면 유지.  
없다면 Edge TTL 1년 수준으로 추가해, Image Resizing의 origin fetch가 엣지에서 처리되도록 함.

---

### Phase B: 코드·구조 개선

#### B.1 첫 질문 이미지 preload

**testquiz.html**에 첫 질문 이미지 preload 추가:

```html
<!-- test JSON 로드 후, 첫 질문 경로를 알 수 있으면 동적 주입 -->
<link
  rel="preload"
  as="image"
  href="/cdn-cgi/image/width=320,.../assets/test-xxx/images/Q1.png"
  fetchpriority="high"
/>
```

- test JSON 로드 직후 첫 질문 경로로 `link rel="preload"` 동적 삽입
- `fetchpriority="high"`로 다른 리소스보다 우선 요청

효과: 첫 화면 이미지 요청을 더 일찍 시작해 LCP 개선.

#### B.2 format 고정 (선택)

`format=auto` → `format=webp`로 변경:

- WebP 인코딩이 AVIF보다 가벼움
- 처리 시간 100~200ms 단축 가능
- 대신 AVIF 대비 용량 증가 가능 (품질 조정으로 완화)

적용 위치: `config.js`의 `assetResizeUrl`, `QUESTION_IMAGE_RESIZE_BASE` 등.

#### B.3 srcset 폭 축소

현재 320, 480, 640 3개.  
첫 로드 시 320만 사용하고, 뷰포트에 따라 480/640는 나중에 로드하는 방식으로 조정 가능.

---

### Phase C: 인프라·운영

#### C.1 캐시 워밍 (배포 시)

배포 직후 핵심 이미지 URL을 한 번씩 호출해 엣지 캐시를 채움:

```bash
# 예: 인기 테스트의 첫 질문 이미지
curl -s -o /dev/null "https://dreamp.org/cdn-cgi/image/width=320,quality=82,fit=contain,format=auto/assets/test-summer/images/q1.png"
```

CI/CD에 `curl` 또는 간단한 스크립트로 핵심 URL 목록을 순회하도록 추가.

#### C.2 R2 리전 검토

- 사용자 대부분이 한국이면 APAC이 적절
- 미국/유럽 비중이 크면 해당 리전 R2 검토

#### C.3 Worker Cache API 확인

`worker/assets/handler.ts`에서 Tiered Cache(`fetch` + `cf`)가 `/assets/*`에 적용되어 있는지 확인.  
이미 적용되어 있다면, Image Resizing의 origin fetch가 Worker Cache/Tiered Cache를 활용함.

---

## 적용 우선순위

| 순위 | 항목                               | 예상 효과                       | 난이도 |
| ---- | ---------------------------------- | ------------------------------- | ------ |
| 1    | A.1 `/cdn-cgi/image/*` Cache Rules | 콜드 이후 400~800ms → 50ms 이하 | 낮음   |
| 2    | C.1 캐시 워밍                      | 첫 방문자도 캐시 히트 가능      | 낮음   |
| 3    | B.1 첫 질문 preload                | LCP 200~400ms 개선              | 중간   |
| 4    | B.2 format=webp                    | 처리 시간 100~200ms 단축        | 낮음   |
| 5    | B.3 srcset 축소                    | 요청 수 감소, 경쟁 완화         | 낮음   |

---

## 검증 방법

1. **Cache Rules 적용 후**
   - 동일 이미지 URL 2회 요청
   - 두 번째 요청의 `cf-cache-status: HIT` 확인
   - 두 번째 요청 Time이 100ms 이하인지 확인

2. **preload 적용 후**
   - Network 탭에서 첫 질문 이미지 요청 시점이 다른 리소스보다 앞서는지 확인
   - LCP(Largest Contentful Paint) 지표 개선 확인

3. **캐시 워밍 후**
   - 배포 직후 첫 방문자의 이미지 로딩 시간이 이전 대비 개선되는지 확인
