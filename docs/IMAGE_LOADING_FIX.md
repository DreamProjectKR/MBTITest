# 이미지 로딩 문제 분석 및 해결 방안

## 현상

- 동일 이미지(`q10.png`)가 **4회** 요청됨
- 요청 유형: **avif 2회** + **fetch 2회**
- 각 요청 소요 시간: **1.49s, 1.57s, 1.58s** (1초 이상)
- 프로덕션 환경에서 발생

---

## 원인 분석

### 1. 중복 요청 (4회)

| 요청 유형       | 발생 위치                                | 설명                                                                                       |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| **avif** (2회)  | `config.js:421` → `applyAssetAttributes` | `<img>`에 `src`/`srcset` 주입 시 브라우저가 이미지 요청                                    |
| **fetch** (2회) | `sw.js:32` → `updateCache`               | Service Worker의 **stale-while-revalidate**에서 캐시 히트 시마다 백그라운드 `fetch()` 호출 |

**중복 경로:**

1. **testintro** preload: `preloadQuestionImages` → `fetchAndStoreInCache` (fetch)
2. **testquiz** `initializeStateFromTestJson`: `loadImageAsset` × 3 widths (320, 480, 640) → 각각 `new Image()` + `src` (img 요청)
3. **testquiz** `renderQuestion` → `setImageWithFallback` → `applyAssetAttributes` → `srcset` (320, 480, 640) → 브라우저가 1~2개 선택
4. **Service Worker**: 캐시 히트 시 즉시 반환 + `event.waitUntil(updateCache(...))`로 **동일 URL에 대해 매번** 백그라운드 fetch

→ 같은 이미지가 preload, loadImageAsset, img srcset, SW revalidate 등 여러 경로에서 요청됨.

### 2. 캐시 이름 불일치

| 모듈               | 사용 캐시        | 비고                             |
| ------------------ | ---------------- | -------------------------------- |
| **testintro**      | `mbti-assets`    | `fetchAndStoreInCache`에서 사용  |
| **Service Worker** | `mbti-assets-v2` | `CACHE_PREFIX` + `CACHE_VERSION` |

testintro가 preload한 결과는 `mbti-assets`에 저장되지만, SW는 `mbti-assets-v2`만 사용.  
또한 SW `activate` 시 `mbti-assets`는 legacy로 삭제됨.  
→ **intro preload가 SW 캐시에 전혀 반영되지 않음.**

### 3. 1초 이상 지연

- **콜드 캐시**: 첫 요청 시 Cloudflare Image Resizing → Worker → R2 경로 전체 왕복
- **동시 요청**: 4개 요청이 동시에 오면 R2/이미지 처리 병목
- **preconnect 부재**: `/cdn-cgi/image` 도메인에 대한 사전 연결 없음
- **Tiered Cache 미워밍**: 첫 방문 시 엣지 캐시가 비어 있음

---

## 해결 방안

### Phase 1: 즉시 적용 가능 (코드 수정)

#### 1.1 캐시 이름 통일

**testintro.js**에서 SW와 동일한 캐시 이름 사용:

```javascript
// 현재
const CACHE_NAME = "mbti-assets";

// 수정: SW의 CACHE_VERSION과 동기화
const CACHE_VERSION = "v2";
const CACHE_NAME = `mbti-assets-${CACHE_VERSION}`;
```

SW의 `CACHE_VERSION` 변경 시 testintro도 함께 수정해야 함.  
→ **권장**: `public/scripts/asset-cache-config.js` 등 공통 설정 파일로 분리.

#### 1.2 SW revalidate 디바운스

동일 URL에 대한 백그라운드 revalidate를 짧은 시간(예: 30초) 동안 1회로 제한:

```javascript
// sw.js
const RECENTLY_REVALIDATED = new Map(); // URL -> timestamp
const REVALIDATE_DEBOUNCE_MS = 30_000;

async function updateCache(cache, request) {
  const url = request.url;
  const now = Date.now();
  if (RECENTLY_REVALIDATED.get(url) > now - REVALIDATE_DEBOUNCE_MS) {
    return null; // 스킵
  }
  try {
    const response = await fetch(request);
    if (isStorableResponse(response)) {
      await cache.put(request, response.clone());
      RECENTLY_REVALIDATED.set(url, now);
    }
    return response;
  } catch {
    return null;
  }
}
```

#### 1.3 preload / loadImageAsset 중복 제거

**testquiz**의 `initializeStateFromTestJson`에서 `loadImageAsset` × 3 호출 제거:

- testintro에서 이미 preload함.
- `setImageWithFallback`이 `srcset`으로 필요한 크기만 요청하도록 함.
- `loadImageAsset` 3회 호출은 같은 이미지를 3개 크기로 중복 요청하는 원인.

**수정**: `loadImageAsset` 호출 제거 또는, testintro를 거치지 않고 quiz로 직접 진입한 경우에만 1개 크기(예: 320)로 한 번만 preload.

#### 1.4 preconnect 추가

`public/_headers` 또는 HTML `<head>`에:

```html
<link
  rel="preconnect"
  href="https://[your-domain]"
  crossorigin
/>
```

같은 오리진이면 `/cdn-cgi/image`도 동일 도메인이므로, 기존 preconnect가 있다면 `/cdn-cgi/image` 경로에 대한 첫 요청 시 연결 재사용 가능.  
별도 `cdn-cgi` 서브도메인을 쓰는 경우 해당 origin에 대한 preconnect 추가.

---

### Phase 2: 구조 개선

#### 2.1 단일 preload 진입점

- **testintro**에서만 preload 수행.
- **testquiz**는 preload 없이 `setImageWithFallback`만 사용.
- intro 없이 quiz로 직접 진입 시, 첫 질문 이미지는 `loading="eager"` + `fetchpriority="high"`로 우선 요청.

#### 2.2 srcset 폭 축소 (선택)

현재 320, 480, 640 3개.  
실제 뷰포트 대비 320, 480만 사용해도 되는 경우, 640 제거로 요청 수 감소.

#### 2.3 format 고정 (선택)

`format=auto`는 Accept에 따라 AVIF/WebP 등으로 분기되어, URL은 같아도 캐시 엔트리가 달라질 수 있음.  
`format=webp`로 고정하면 포맷당 1개 캐시만 사용. (AVIF 선호 시 `format=avif` 고정)

---

### Phase 3: 인프라/설정

#### 3.1 Cache Rules (Cloudflare 대시보드)

`/cdn-cgi/image/*`에 대해 Edge TTL을 길게 설정해, 한 번 캐시된 이미지는 재요청 시 엣지에서 즉시 반환되도록 함.

#### 3.2 R2 / Image Resizing 지역

R2가 APAC이면, 주요 사용자 지역과 맞는지 확인.  
이미지 리사이징이 엣지에서 수행되므로, 오리진(R2) fetch 비용과 지연을 줄이는 것이 중요.

---

## 적용 우선순위

| 순위 | 항목                         | 예상 효과                         |
| ---- | ---------------------------- | --------------------------------- |
| 1    | SW revalidate 디바운스       | 동일 URL에 대한 fetch 2회 → 0~1회 |
| 2    | testquiz loadImageAsset 제거 | 3회 중복 요청 제거                |
| 3    | 캐시 이름 통일               | intro preload가 SW 캐시에 활용됨  |
| 4    | preconnect 확인/추가         | 첫 요청 연결 지연 감소            |
| 5    | srcset/format 조정           | 요청 수 및 캐시 효율 개선         |

---

## 검증 방법

1. **Network 탭**: 동일 이미지에 대한 요청 수가 4회 → 1~2회로 감소하는지 확인.
2. **캐시 히트**: 두 번째 방문 시 `cf-cache-status: HIT` 또는 `X-MBTI-Edge-Cache: HIT` 확인.
3. **체감 속도**: 첫 질문 이미지 표시까지 시간이 1.5초 이하로 줄어드는지 확인.
