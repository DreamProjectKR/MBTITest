# 대안 아키텍처 3: Durable Objects로 어드민 쓰기 일원화

> **상태**: 검토용 문서. 코드에 미적용.  
> **전제**: 현재 아키텍처에서 완전히 벗어나, Cloudflare에 배포한다는 점만 유지.

---

## 1. 개요

**읽기 경로(목록·상세·에셋·compute)** 는 기존처럼 Pages + Functions + D1/R2/KV를 유지하고,  
**어드민 쓰기(테스트 저장, 이미지 업로드)** 만 **Durable Objects(DO)** 로 모아서, “테스트 ID당 하나의 DO”가 해당 테스트에 대한 모든 수정을 **직렬화**하는 구조입니다.  
동시 저장·이미지 업로드 시 경쟁 조건을 줄이고, 캐시 무효화 순서를 보장할 수 있습니다.

---

## 2. 현재 구조와의 차이

| 구분                     | 현재                                           | 본 안                                                    |
| ------------------------ | ---------------------------------------------- | -------------------------------------------------------- |
| 읽기 (사용자·퍼블릭 API) | Pages Functions + D1/R2/KV                     | **동일** (Pages Functions 유지)                          |
| 어드민 쓰기              | Pages Functions에서 직접 D1·R2·KV·Cache 무효화 | **Durable Object** 하나가 “테스트 ID” 단위로 쓰기 직렬화 |
| 일관성                   | 동시 PUT 시 나중 요청이 덮어쓸 수 있음         | DO가 요청을 큐처럼 처리해 순차 적용                      |
| 캐시 무효화              | 각 핸들러에서 KV delete + Cache delete         | DO가 쓰기 완료 후 무효화 명령 일괄 실행                  |

---

## 3. 사용 Cloudflare 서비스

| 서비스                      | 용도                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pages + Pages Functions** | 정적 호스팅, `GET /api/tests`, `GET /api/tests/:id`, `POST /api/tests/:id/compute`, `GET /assets/*` (기존과 동일).                                                                                             |
| **Durable Objects**         | 어드민 전용. `TestEditor` 같은 DO 클래스 하나를 두고, `idFromName(testId)` 로 “테스트 ID당 1 DO”. 이 DO가 `PUT /api/admin/tests/:id`, 이미지 업로드 등을 **내부적으로** R2/D1에 쓰고, 완료 후 KV·Cache 무효화. |
| **D1**                      | 기존과 동일. DO가 HTTP를 통해 Workers에서 접근하거나, DO가 직접 D1 바인딩을 가질 수 있는지 런타임 확인 필요. (일반적으로 DO는 Worker와 같은 env 바인딩 사용.)                                                  |
| **R2**                      | 기존과 동일. DO → Worker 호출 또는 DO에 R2 바인딩 전달.                                                                                                                                                        |
| **KV**                      | 기존과 동일. 무효화는 DO가 트리거.                                                                                                                                                                             |
| **Workers**                 | DO를 사용하려면 **Workers** 진입점이 필요. 따라서 “어드민 API”만 Worker로 보내고, Worker가 DO에 포워딩하는 구조가 됨. Pages와 Worker 라우팅 분리 필요.                                                         |

---

## 4. 아키텍처 다이어그램

```text
  사용자 요청 (읽기)
     │
     ├─ GET /api/tests, /api/tests/:id, /assets/*  ──►  Pages Functions  ──►  D1, R2, KV
     │
  어드민 요청 (쓰기)
     │
     └─ PUT /api/admin/tests/:id, .../images, .../results/:mbti/image
              │
              ▼
        Worker (어드민 라우트만)
              │
              └─ env.TEST_EDITOR.idFromName(testId)  ──►  Durable Object (테스트별 1개)
                                                               │
                                                               ├─ 요청 큐 (직렬 실행)
                                                               ├─ R2 put, D1 batch
                                                               └─ KV delete, Cache purge
```

---

## 5. 성능·유지보수 기대 효과

- **강한 일관성**: 같은 테스트에 대한 여러 어드민 요청이 DO 안에서 순차 실행되어, “마지막 쓰기”가 항상 예측 가능.
- **캐시 무효화 순서**: 쓰기 완료 후 한 번만 무효화하므로, “저장은 됐는데 아직 이전 캐시가 보인다” 구간을 줄일 수 있음.
- **확장 가능성**: 나중에 “실시간 협업 편집”(같은 테스트를 여러 관리자가 편집) 시 DO가 WebSocket이나 알림을 담당하는 패턴으로 확장 가능.

---

## 6. 검증·도입 시 확인할 점

1. **DO에서 D1/R2/KV 접근**: Durable Object가 `env`를 통해 D1, R2, KV를 쓰는지, 아니면 DO는 “조율만” 하고 실제 쓰기는 Worker에 HTTP로 요청하는지 결정. Cloudflare 문서상 DO도 동일 Worker env 바인딩 공유 가능.
2. **라우팅**: 어드민 경로(`/api/admin/*`)만 Worker로 보내고, 나머지는 Pages. Custom Domain + Worker Route 설정 필요.
3. **DO 한도·비용**: DO 동시 실행 수, 요청 수 한도 및 요금(유료 플랜) 확인.
4. **복잡도**: 도입 시 Worker 프로젝트·DO 클래스·마이그레이션 경로가 늘어남. “동시 저장” 문제가 실제로 있는지 먼저 확인 후 도입 여부 결정 권장.

---

## 7. 참고 문서

- [Durable Objects 소개](https://developers.cloudflare.com/durable-objects/)
- [When to use Durable Objects (Coordination, Strong consistency)](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Durable Objects with Storage and WebSockets](https://developers.cloudflare.com/durable-objects/api/websockets/)
