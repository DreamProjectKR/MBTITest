# 대안 아키텍처 2: Pages 정적 + Worker API 게이트웨이 (Tiered Cache)

> **상태**: 검토용 문서. 코드에 미적용.  
> **전제**: 현재 아키텍처에서 완전히 벗어나, Cloudflare에 배포한다는 점만 유지.

---

## 1. 개요

**정적 사이트는 Pages, API·에셋은 전용 Worker**가 담당하는 이원 구조입니다.  
Worker는 `/api/*`, `/assets/*`만 처리하고, **fetch(자기 자신 또는 오리진)에 `cf` 옵션**을 써서 Cloudflare **Tiered Cache**를 채우는 방식으로 캐시 히트율과 응답 속도를 높입니다.

---

## 2. 현재 구조와의 차이

| 구분        | 현재                                 | 본 안                                                          |
| ----------- | ------------------------------------ | -------------------------------------------------------------- |
| 정적 호스팅 | Pages (HTML/CSS/JS + Functions)      | Pages **정적만** (Functions 없음 또는 최소화)                  |
| API·에셋    | Pages Functions (단일 PoP Cache API) | **별도 Worker** (Tiered Cache 활용)                            |
| 라우팅      | Pages `_routes.json`                 | **Cloudflare 라우팅**: 도메인/경로에 따라 Worker vs Pages 분기 |
| 캐시        | Cache API + KV (PoP 단위)            | Worker에서 `fetch` + `cf` → **Tiered Cache** (여러 PoP)        |

---

## 3. 사용 Cloudflare 서비스

| 서비스             | 용도                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Pages**          | 정적 HTML/CSS/JS만 호스팅. 빌드 시 Functions 제거 또는 비활성화.                                                                          |
| **Workers**        | API 게이트웨이. `GET /api/*`, `GET /assets/*` 수신 → D1/R2/KV 조회 또는 오리진 fetch 후 `cf: { cacheTtl, cacheEverything }` 로 응답 캐시. |
| **D1**             | Worker에서 바인딩하여 테스트 메타·이미지 메타 조회.                                                                                       |
| **R2**             | Worker에서 바인딩하여 테스트 JSON·이미지 제공.                                                                                            |
| **KV**             | Worker에서 테스트 상세 캐시 (기존과 동일).                                                                                                |
| **Tiered Cache**   | Worker가 `fetch(url, { cf: { cacheTtl, cacheEverything: true } })` 로 응답을 캐시에 적재.                                                 |
| **Image Resizing** | 기존과 동일 (`/cdn-cgi/image`).                                                                                                           |

---

## 4. 아키텍처 다이어그램

```text
  브라우저
     │
     │  GET /
     │  GET /admin.html  ──────►  Pages (정적만)  ──►  HTML/CSS/JS
     │
     │  GET /api/*
     │  GET /assets/*   ──────►  Worker (API 게이트웨이)
     │                                  │
     │                                  ├─ Tiered Cache (fetch + cf)
     │                                  ├─ D1, R2, KV
     │                                  └─ 200/206 응답
     │
     └── GET /cdn-cgi/image/...  ──────►  Image Resizing (기존)
```

라우팅 예:

- `example.com/`, `example.com/*.html`, `example.com/styles/*`, `example.com/scripts/*` → **Pages**.
- `example.com/api/*`, `example.com/assets/*` → **Worker**.

(Cloudflare에서 Worker 라우트를 `*example.com/api/*`, `*example.com/assets/*` 로 등록.)

---

## 5. 성능·유지보수 기대 효과

- **Tiered Cache**: 여러 엣지 PoP에 캐시가 쌓여, 동일 URL 재요청 시 원본(D1/R2) 접근 없이 가까운 PoP에서 응답 가능.
- **Pages 단순화**: Pages는 정적 파일만 담당해 빌드·배포가 단순해지고, Functions 의존성 제거 가능.
- **Worker 전담**: API·에셋 로직을 Worker 한 곳에 모아 캐시 정책·에러 처리·로깅을 일원화.
- **점진적 전환**: 기존 Pages Functions를 Worker로 옮기면서, Pages에는 정적만 남기는 방식으로 단계적 이전 가능.

---

## 6. 검증·도입 시 확인할 점

1. **라우팅 설정**: Cloudflare 대시보드 또는 Workers 라우트에서 `*도메인/api/*`, `*도메인/assets/*` 를 해당 Worker에 연결. 나머지는 Pages.
2. **오리진 fetch vs 직접 처리**: Worker가 D1/R2/KV를 직접 호출해 응답을 만들고, 그 응답을 “자기 자신 URL”로 한 번 더 fetch해서 `cf` 옵션으로 캐시에 넣는 패턴이면, 불필요한 왕복이 생길 수 있음. 대안: Worker가 처음부터 응답을 만들고, Cache API나 Tiered Cache 정책만 적용하는 방식 검토.
3. **캐시 무효화**: 어드민 저장 시 Worker에서 Cache purge API 또는 태그 퍼지로 Tiered Cache 무효화 방법 확인.
4. **비용**: Workers 요청 수와 Pages 대역폭이 분리되어 과금되므로, 예상 트래픽으로 요금 추정.

---

## 7. 참고 문서

- [Cache using fetch (Tiered Cache)](https://developers.cloudflare.com/workers/examples/cache-using-fetch)
- [Workers 라우팅](https://developers.cloudflare.com/workers/configuration/routing/)
- [Tiered Cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/)
