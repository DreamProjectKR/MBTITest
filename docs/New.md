# 대안 아키텍처 1: Workers 기반 풀스택 (Static Assets + 단일 Worker)

> **상태**: 검토용 문서. 코드에 미적용.  
> **전제**: 현재 아키텍처에서 완전히 벗어나, Cloudflare에 배포한다는 점만 유지.

---

## 1. 개요

**Pages + Pages Functions** 대신 **Cloudflare Workers** 한 종류로 정적 자산(HTML/CSS/JS)과 API·에셋 프록시를 모두 처리하는 구조입니다.  
동일 도메인에서 하나의 Worker가 라우팅을 담당하고, D1·R2·KV는 그대로 사용합니다.

---

## 2. 현재 구조와의 차이

| 구분           | 현재                        | 본 안                                      |
| -------------- | --------------------------- | ------------------------------------------ |
| 정적 호스팅    | Pages (Git/빌드 연동)       | Workers Static Assets (`assets.directory`) |
| API·에셋       | Pages Functions             | 동일 Worker 내 `fetch` 핸들러              |
| 라우팅         | `_routes.json` + 파일 기반  | Worker 스크립트 + `run_worker_first`       |
| 배포           | Pages 배포 + Functions 번들 | Worker 단일 배포 (wrangler deploy)         |
| Cron·Queues·DO | 사용 불가                   | 사용 가능                                  |

---

## 3. 사용 Cloudflare 서비스

| 서비스                    | 용도                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Workers**               | HTTP 진입점, 라우팅, API, 에셋 프록시, 정적 자산 서빙                                  |
| **Workers Static Assets** | `./public` 등 빌드 결과물을 Worker와 함께 배포, `ASSETS` 바인딩으로 코드에서 접근 가능 |
| **D1**                    | 기존과 동일 (테스트 메타, 이미지 메타)                                                 |
| **R2**                    | 기존과 동일 (테스트 JSON, 이미지 바이너리)                                             |
| **KV**                    | 기존과 동일 (테스트 상세 캐시)                                                         |
| **Image Resizing**        | 기존과 동일 (`/cdn-cgi/image`)                                                         |
| **Queues** (선택)         | 어드민 저장 시 캐시 무효화 등을 비동기 처리해 응답 지연 감소                           |
| **Observability**         | Workers 대시보드 로그·메트릭으로 API·에러 모니터링                                     |

---

## 4. 아키텍처 다이어그램

```text
                    ┌─────────────────────────────────────────────────────────┐
                    │  Cloudflare Edge                                         │
  브라우저          │                                                           │
    │               │   Worker (단일 진입점)                                    │
    │  GET /        │      run_worker_first: ["/api/*", "/assets/*"]           │
    ├──────────────►│      ├─ /api/*        → D1, R2, KV, (Queues)             │
    │  GET /api/*   │      ├─ /assets/*     → R2 (또는 ASSETS 아님)            │
    │  GET /assets/*│      └─ 그 외          → Static Assets (ASSETS)          │
    │               │                                                           │
    │               │   D1  R2  KV  [Queues]                                   │
    └───────────────┴─────────────────────────────────────────────────────────┘
```

---

## 5. 성능·유지보수 기대 효과

- **단일 배포**: Pages + Functions 분리 없이 `wrangler deploy` 한 번으로 정적·API·에셋 일괄 배포.
- **라우팅 제어**: `run_worker_first`로 `/api/*`, `/assets/*`만 Worker에서 처리하고 나머지는 정적 자산으로 명확히 분리.
- **Tiered Cache**: Worker에서 `fetch(origin + path, { cf: { cacheTtl, cacheEverything: true } })`로 자기 자신을 호출하는 패턴 사용 시, Cloudflare Tiered Cache 활용 가능 (문서 참고).
- **Cron·Queues**: 추후 캐시 워밍, 통계 수집, 어드민 작업 큐 등 확장 시 Workers 생태계 그대로 사용.
- **Observability**: Workers 대시보드에서 요청/에러/지연 시간 등 한 곳에서 확인 가능.

---

## 6. 검증·도입 시 확인할 점

1. **빌드·배포 파이프라인**: 현재 Pages(Git push → 빌드) 대신, 빌드 산출물을 `assets.directory`에 넣고 Worker와 함께 배포하는 CI 단계 설계.
2. **환경 분리**: `wrangler.toml`의 `[env.*]`로 dev/staging/production 분리 시, D1/KV 등 바인딩 ID 관리.
3. **Worker CPU·요청 한도**: 무료/유료 Workers 한도(일 요청 수, CPU 시간) 내에서 트래픽 예측.
4. **Queues 도입 시**: 어드민 PUT에서 즉시 202 반환 후 큐로 “무효화” 메시지 전송 시, 클라이언트는 “저장됨” 후 일시적으로 이전 캐시를 볼 수 있음. TTL과 재검증 정책으로 수용 가능한지 검토.

---

## 7. 참고 문서

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [run_worker_first로 라우팅 제어](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Pages에서 Workers로 마이그레이션](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
