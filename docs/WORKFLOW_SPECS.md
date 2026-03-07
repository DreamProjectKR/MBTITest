# Workflow Specs

## 목적

이 문서는 MBTI ZOO의 핵심 workflow를 구현 기준으로 정의합니다.
핸들러, 서비스, 리포지토리 분리 이후에도 아래 흐름은 유지되어야 합니다.

## 1. Public Browse Workflow

### Admin 목록 조회

경로: `GET /api/tests`

순서:

1. D1에서 테스트 메타데이터를 조회합니다.
2. `is_published = 1`인 데이터만 반환합니다.
3. 응답은 public cache policy를 적용합니다.

규칙:

- draft는 절대 목록에 포함되면 안 됩니다.
- 응답 형식은 `{ tests: [...] }`를 유지합니다.

### Admin 상세 조회

경로: `GET /api/tests/:id`

순서:

1. KV에서 `test:<id>` 캐시를 조회합니다.
2. 없으면 Cache API를 조회합니다.
3. 없으면 D1 메타데이터를 읽습니다.
4. `isPublished=false`면 `404`를 반환합니다.
5. R2의 `test.json`을 읽습니다.
6. D1 메타 + R2 본문을 병합합니다.
7. 응답 캐시를 다시 채웁니다.

규칙:

- public은 draft를 읽을 수 없습니다.
- public 응답은 병합 결과를 기준으로 캐시합니다.

## 2. Admin Read Workflow

### 목록 조회

경로: `GET /api/admin/tests`

규칙:

- draft와 published를 모두 반환합니다.
- 캐시는 `no-store`를 유지합니다.
- admin 편집기 초기 목록 로딩에 사용됩니다.

### 상세 조회

경로: `GET /api/admin/tests/:id`

순서:

1. D1 메타데이터를 읽습니다.
2. R2 `test.json`을 읽습니다.
3. 메타와 본문을 병합합니다.
4. `no-store` 응답으로 반환합니다.

규칙:

- admin은 draft도 읽을 수 있어야 합니다.
- public visibility 정책을 admin read에 재사용하면 안 됩니다.

## 3. Admin Save Workflow

경로: `PUT /api/admin/tests/:id`

순서:

1. request payload를 파싱합니다.
2. domain validation을 수행합니다.
3. asset path를 canonical 형태로 정규화합니다.
4. slim `test.json` body를 구성합니다.
5. R2에 `test.json`을 기록합니다.
6. D1 `tests` 메타데이터를 upsert 합니다.
7. KV `test:<id>`를 삭제합니다.
8. Cache API의 `/api/tests`, `/api/tests/:id`를 무효화합니다.

실패 규칙:

- validation 실패 시 어떤 영속 변경도 발생하면 안 됩니다.
- R2 성공 후 D1 실패 시 rollback/compensation 전략을 workflow에서 관리해야 합니다.

## 4. Generic Image Upload Workflow

경로: `PUT /api/admin/tests/:id/images`

순서:

1. 업로드 파일과 이름을 파싱합니다.
2. canonical image base name을 계산합니다.
3. canonical asset key를 계산합니다.
4. R2에 바이너리를 저장합니다.
5. D1 `test_images`에 메타데이터를 upsert 합니다.
6. public 상세 캐시를 무효화합니다.

실패 규칙:

- metadata write가 실패하면 방금 쓴 R2 object를 삭제합니다.
- 이 workflow는 이미지 staging 역할을 할 수 있으므로, 이미지가 아직 본문에 참조되지 않을 수 있습니다.

## 5. Result Image Upload Workflow

경로: `PUT /api/admin/tests/:id/results/:mbti/image`

순서:

1. 파일과 MBTI code를 검증합니다.
2. 기존 `test.json`을 먼저 읽습니다.
3. 결과 이미지 경로가 반영된 새 `test.json`을 메모리에서 구성합니다.
4. R2에 이미지 바이너리를 저장합니다.
5. R2에 갱신된 `test.json`을 기록합니다.
6. D1 `test_images` 메타를 upsert 하고 `tests.updated_at`을 갱신합니다.
7. KV와 Cache API를 무효화합니다.

실패 규칙:

- `test.json`이 없으면 이미지를 먼저 쓰지 않고 `404`를 반환합니다.
- metadata write 실패 시 원래 `test.json` 복원과 업로드 이미지 삭제를 시도합니다.

## 6. Asset Proxy Workflow

경로: `GET /assets/*`

순서:

1. Cache API를 조회합니다.
2. cache miss면 canonical/legacy 후보 key를 계산합니다.
3. R2에서 object를 찾습니다.
4. 로컬 개발 환경에서는 필요 시 public R2 URL fallback을 허용합니다.
5. ETag, Cache-Control, Cache-Tag, Range 응답을 설정합니다.
6. cacheable response면 Cache API에 다시 저장합니다.

규칙:

- same-origin asset URL 정책을 유지합니다.
- cache policy는 asset type과 versioning 유무에 따라 달라질 수 있습니다.
- canonical key 우선, legacy key fallback 허용 정책은 유지해야 합니다.

## 7. Admin UI State Workflow

목표:

- 단일 state source 유지
- event -> action/effect -> state -> render 흐름 유지

규칙:

- 이벤트 핸들러는 직접 렌더링을 orchestrate 하지 않습니다.
- async API 호출은 effect 레이어가 담당합니다.
- selector를 통해 active test와 파생 상태를 계산합니다.
- form hydration은 명시적 전이 시점에만 수행합니다.

## 8. Required Regression Coverage

아래 workflow는 항상 자동 테스트를 가져야 합니다.

- public 목록에서 draft 제외
- public 상세에서 draft 404
- admin 목록/상세에서 draft 허용
- admin save validation
- result image upload rollback
- generic image upload cleanup
- asset proxy ETag/Range/cache policy
- route dispatch correctness
