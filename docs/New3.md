# 대안 아키텍처 4: Queues + Workflows 비동기 어드민 파이프라인

> **상태**: 검토용 문서. 코드에 미적용.  
> **전제**: 현재 아키텍처에서 완전히 벗어나, Cloudflare에 배포한다는 점만 유지.

---

## 1. 개요

**어드민 저장·이미지 업로드**를 “동기 처리”가 아니라 **Queues**에 작업을 넣고, **Consumer Worker** 또는 **Workflows**가 R2/D1 쓰기와 캐시 무효화를 **비동기**로 수행하는 구조입니다.  
API는 즉시 **202 Accepted**를 반환하고, 실제 저장은 백그라운드에서 처리됩니다.  
선택적으로 **Vectorize**로 테스트 제목·설명의 의미 검색, **Hyperdrive**로 외부 DB(Postgres/MySQL) 연동을 붙일 수 있습니다.

---

## 2. 현재 구조와의 차이

| 구분            | 현재                                 | 본 안                                            |
| --------------- | ------------------------------------ | ------------------------------------------------ |
| 어드민 PUT 응답 | 200 + 동기적으로 R2·D1·KV·Cache 처리 | **202 Accepted** + 본문/메타를 **Queues**에 전송 |
| 실제 저장       | 같은 요청 내에서 완료                | **Queue Consumer** 또는 **Workflow**가 순차 처리 |
| 검색 (선택)     | D1 단순 쿼리                         | **Vectorize**로 임베딩 기반 유사 테스트 검색     |
| DB (선택)       | D1만                                 | **Hyperdrive**로 기존 Postgres/MySQL 연결·풀링   |

---

## 3. 사용 Cloudflare 서비스

| 서비스                      | 용도                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Pages + Pages Functions** | 정적 호스팅, 읽기 API (목록·상세·compute·에셋). 기존과 동일.                                                 |
| **Queues**                  | 어드민 “저장 요청” 메시지 전달. Producer = Pages Function(또는 Worker), Consumer = 전용 Worker.              |
| **Workflows** (선택)        | 다단계 오케스트레이션: 1) R2 put, 2) D1 batch, 3) KV delete + Cache purge, 4) (선택) 알림. 재시도·상태 유지. |
| **Vectorize** (선택)        | 테스트 제목·설명을 임베딩하여 저장; “비슷한 테스트” 검색, 추천. Workers AI 또는 외부 임베딩 API 연동.        |
| **Hyperdrive** (선택)       | 기존 Postgres/MySQL이 있을 때 연결 풀·지연 최적화. D1 대체가 아니라 분석·리포트용 보조 DB로 사용 가능.       |
| **D1, R2, KV**              | 기존과 동일. Consumer/Workflow에서 사용.                                                                     |

---

## 4. 아키텍처 다이어그램

```text
  어드민: "저장하기" 클릭
     │
     ▼
  PUT /api/admin/tests/:id  (Pages Function 또는 Worker)
     │
     ├─ 요청 검증 (payload, 권한)
     ├─ Queues.send({ type: "save-test", testId, body: {...} })
     └─ 응답: 202 Accepted + { jobId, message: "저장이 큐에 등록되었습니다" }
     │
     ▼
  Queue Consumer (Worker)
     │
     ├─ R2 put (test.json)
     ├─ D1 batch (메타, test_images 등)
     ├─ KV delete, Cache purge
     └─ (선택) Workflows로 넘기거나, 완료 시 알림
     │
  [선택] Workflows
     │
     └─ step 1: R2  →  step 2: D1  →  step 3: purge  →  step 4: notify
```

**Vectorize (선택)**

- 테스트 저장/수정 시 제목·설명을 임베딩하여 Vectorize에 upsert.
- 검색 API: `GET /api/tests?q=여행` → Vectorize 유사도 검색 + D1 메타 병합.

**Hyperdrive (선택)**

- 별도 Postgres/MySQL에 “테스트 조회 로그”, “통계” 등을 적재할 때 Worker에서 Hyperdrive로 연결.

---

## 5. 성능·유지보수 기대 효과

- **빠른 API 응답**: 어드민 저장 시 DB/스토리지 I/O 없이 큐에만 넣고 202 반환 → 체감 지연 감소.
- **저장 신뢰성**: Queues/Workflows의 재시도·내구성으로 일시적 장애 시에도 작업 유실 감소.
- **확장성**: Consumer를 여러 개 두거나 Workflows로 단계별로 나누어 부하 분산·모니터링 용이.
- **검색 고도화**: Vectorize 도입 시 “제목/설명과 비슷한 테스트” 추천이나 검색 품질 향상.
- **기존 DB 활용**: Hyperdrive로 이미 쓰는 Postgres/MySQL이 있으면, Workers에서 풀링·지연 최적화된 연결로 분석 쿼리만 추가 가능.

---

## 6. 검증·도입 시 확인할 점

1. **일관성**: 202 반환 후 아직 Consumer가 처리 전이면, 사용자가 목록/상세를 새로고침해도 “아직 반영 안 됨”이 될 수 있음. “저장 중” UI·폴링 또는 WebSocket으로 “저장 완료” 알림을 주는 설계 필요.
2. **Queues 한도·비용**: 메시지 수, 크기 한도, 유료 플랜 요금.
3. **Workflows**: GA 이후 문서·한도 확인. “저장 파이프라인”을 Workflows로 옮기면 재시도·가시성은 좋아지나, 구성 요소가 늘어남.
4. **Vectorize**: 임베딩 생성 비용(Workers AI 또는 외부 API), 인덱스 크기·비용. “검색” 수요가 있을 때만 도입 권장.
5. **Hyperdrive**: D1을 대체하기보다는 “추가 분석 DB”로 쓰는 경우에 검토. 관리할 DB 인스턴스가 생김.

---

## 7. 참고 문서

- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Workflows (다단계 내구 실행)](https://developers.cloudflare.com/workflows/)
- [Vectorize (벡터 DB)](https://developers.cloudflare.com/vectorize/)
- [Hyperdrive (DB 연결 풀링)](https://developers.cloudflare.com/hyperdrive/)
