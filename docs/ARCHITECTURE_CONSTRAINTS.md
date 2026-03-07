# Architecture Constraints

## 목적

이 문서는 MBTI ZOO의 구현이 따라야 하는 **설계 제약 조건**을 정의합니다.
설명 문서가 아니라, 리팩터링과 기능 추가 시 지켜야 하는 기준 문서입니다.

## 시스템 경계

### 런타임 경계

- `Pages`는 정적 HTML/CSS/JS 제공만 담당합니다.
- `Worker`는 `/api/*`, `/assets/*` 요청 처리만 담당합니다.
- `D1`은 테스트 메타데이터와 이미지 메타데이터의 시스템 오브 레코드입니다.
- `R2`는 테스트 본문 JSON과 이미지 바이너리의 시스템 오브 레코드입니다.
- `KV`는 `GET /api/tests/:id` 응답 캐시 전용입니다.

### 도메인 경계

- 현재 도메인은 `테스트 콘텐츠 관리 + 공개 테스트 제공`입니다.
- `users`, `accounts`, `auth`, `roles`, `sessions`는 현재 설계 범위에 포함되지 않습니다.
- `isPublished`는 UI 표시용 필드가 아니라 **public API 노출 정책**입니다.

## 계층 제약

Worker 코드는 아래 방향으로만 의존해야 합니다.

```text
http -> application -> domain -> infrastructure
```

- `http`
  - 요청 파싱, 응답 생성, 상태 코드 매핑, 헤더 설정만 담당합니다.
- `application`
  - 유스케이스 orchestration, workflow 순서, rollback/compensation 규칙을 담당합니다.
- `domain`
  - 검증, path 정규화, payload 병합, MBTI 계산 같은 순수 규칙을 담당합니다.
- `infrastructure`
  - D1, R2, KV, Edge Cache 접근 구현을 담당합니다.

### 금지 사항

- HTTP handler가 D1/R2/KV 구현 세부사항을 직접 조합해서 workflow를 완성하면 안 됩니다.
- `domain` 계층에서 네트워크, 저장소, 캐시 접근을 수행하면 안 됩니다.
- UI 렌더링 레이어가 상태를 직접 소유하거나 비동기 API를 직접 orchestration하면 안 됩니다.

## 데이터 소유권

### D1 소유 데이터

- `tests`
  - test id
  - title
  - description_json
  - author
  - author_img_path
  - thumbnail_path
  - tags_json
  - source_path
  - created/updated 메타 필드
  - `is_published`
- `test_images`
  - 업로드된 이미지 메타데이터

### R2 소유 데이터

- `assets/<testId>/test.json`
  - 테스트 본문
  - questions
  - results
- `assets/<testId>/images/*`
  - question/result/thumbnail/author 이미지 바이너리

### KV 소유 데이터

- `test:<id>`
  - public 상세 응답 캐시
- KV 데이터는 영속 진실이 아니며 언제든 버려질 수 있어야 합니다.

## Public/Admin 계약

### Public API

- `GET /api/tests`
  - `isPublished = true`인 테스트만 반환합니다.
- `GET /api/tests/:id`
  - `isPublished = true`인 테스트만 반환합니다.
  - draft는 `404`를 반환합니다.

### Admin API

- `GET /api/admin/tests`
  - draft + published를 모두 반환합니다.
- `GET /api/admin/tests/:id`
  - draft + published를 모두 반환합니다.
- admin mutation API는 내부 구조가 바뀌어도 기존 외부 계약을 유지해야 합니다.

## Mutation Workflow 제약

모든 multi-storage mutation은 아래 순서를 따라야 합니다.

```text
validate -> write body/assets -> write metadata -> invalidate cache -> compensate on failure
```

### 공통 원칙

- 검증이 끝나기 전에는 영속 변경을 시작하지 않습니다.
- 본문/에셋과 메타데이터는 application workflow에서 하나의 유스케이스로 묶어 다룹니다.
- 중간 실패 시 가능한 범위에서 보상 작업을 수행합니다.
- rollback/compensation 규칙은 handler가 아니라 workflow에 둡니다.

### 캐시 무효화 원칙

- public 상세 응답이 바뀌면 KV `test:<id>`를 삭제합니다.
- public 목록/상세가 바뀌면 Cache API의 `/api/tests`, `/api/tests/:id`를 무효화합니다.
- 동일한 asset key를 재사용하는 경우 asset freshness 전략을 명시적으로 관리해야 합니다.

## Asset Key 제약

- asset path는 canonical `assets/...` 형태만 사용합니다.
- 테스트 본문과 메타는 같은 canonical path 규칙을 사용해야 합니다.
- path 정규화 규칙은 domain helper 한 곳에서만 정의합니다.

## Frontend Admin 제약

- admin UI는 단일 state source를 유지해야 합니다.
- 이벤트 핸들러는 `dispatch(action)` 또는 effect 호출만 수행합니다.
- 렌더 레이어는 state를 입력으로 받아 UI를 그리는 역할만 수행합니다.
- async API orchestration은 effect/application 성격의 모듈로 분리합니다.
- DOM 참조와 data state는 같은 모듈에 섞지 않습니다.

## 테스트 제약

- 신규 workflow는 최소한 성공 경로 1개와 실패 경로 1개를 자동 테스트로 가져야 합니다.
- public/admin visibility, save workflow, image upload workflow, asset proxy cache 정책은 회귀 테스트 필수입니다.
- route 추가 시 라우팅 단위 테스트 또는 Worker entry 테스트를 함께 갱신해야 합니다.

## 문서 제약

- `docs/README.md`는 설계 문서 인덱스입니다.
- `docs/API.md`는 API 계약의 기준 문서입니다.
- `docs/ERD.md`는 저장 구조와 데이터 소유권의 기준 문서입니다.
- 이 문서는 구현이 따라야 하는 제약 문서입니다.
