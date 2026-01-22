## 목표
이 문서는 `dreamp.org`(Cloudflare Pages) 배포 환경에서 **이미지/데이터 로딩 체감 속도**를 더 끌어올리기 위해, Cloudflare 대시보드/`wrangler`에서 해야 하는 작업을 정리합니다.

현재 아키텍처:
- **Pages Functions**: `/api/tests`, `/api/tests/:id`, `/assets/*`
- **D1**: 테스트 메타데이터(목록/검색용)
- **R2**: `test.json`(본문) + 이미지
- **이미지 최적화**: `/cdn-cgi/image` (format=auto + resize)

---

## 1) Rocket Loader 설정 (권장: 끄기 또는 Manual + 예외 처리)
### 왜?
`type="module"`/`defer` 스크립트는 브라우저가 이미 최적화해서 로딩하는데, Rocket Loader가 개입하면 **실행 타이밍이 바뀌어 preload 경고/초기 렌더 지연**이 생길 수 있습니다.

### 옵션 A (권장): Rocket Loader OFF
- Cloudflare Dashboard → **Speed** → **Optimization** → **Rocket Loader** → **Off**

### 옵션 B: Manual + critical script 제외
- Rocket Loader를 Manual로 바꾸고, 중요한 스크립트에 `data-cfasync="false"`를 추가
- (이미 일부 페이지에서 사용했던 방식)

---

## 2) API 응답도 Edge 캐시 되도록 `s-maxage` 적용 (코드 반영됨)
### 왜?
브라우저 캐시(`max-age`)만 있으면, Edge(Cloudflare CDN)는 API 응답을 적극 캐시하지 못합니다.

### 현재 코드 적용 내용
- `functions/api/_utils/http.ts`에서 `Cache-Control`에 `s-maxage`/`stale-while-revalidate`를 지원하도록 확장
- `/api/tests` 및 `/api/tests/:id`에서 더 공격적인 edge 캐시 TTL 적용
- 또한 Cache API(`caches.default`)에 **ETag별 캐시 키**(`__cache=<etag>`)로 저장해서, 내용 변경 시 구 캐시를 자동으로 회피

---

## 3) Cloudflare Cache Rules(대시보드)로 캐시 정책 고정 (선택, 하지만 강력 추천)
### 왜?
코드 헤더가 실수로 변경되어도, 대시보드 규칙으로 캐시를 안정적으로 유지할 수 있습니다.

### 추천 규칙 예시
1) **API 캐시**
- Match: `*dreamp.org/api/tests*`
- Edge TTL: 60s (또는 120s)

2) **Assets 캐시**
- Match: `*dreamp.org/assets/*`
- Edge TTL: 1 year
- (현재는 `/assets/*` 함수가 `?v=`가 있을 때 `immutable`로 응답하도록 구현되어 있음)

---

## 4) D1 인덱스 추가 (필수: 데이터 늘수록 체감)
### 왜?
`/api/tests`는 `ORDER BY updated_at DESC`를 쓰기 때문에, 인덱스가 없으면 테스트가 늘수록 느려집니다.

### 적용 파일
- `migrations/0002_add_indexes.sql`

### 실행 예시
- 로컬(예시):

```bash
wrangler d1 execute mbti-db --local --file=migrations/0002_add_indexes.sql
```

- 원격(예시):

```bash
wrangler d1 execute mbti-db --remote --file=migrations/0002_add_indexes.sql
```

> D1 바인딩 이름/DB 이름은 프로젝트 설정(`wrangler.toml`)에 맞게 바꿔주세요.

---

## 5) (선택) KV로 “테스트 목록” 초고속화
### 언제 필요?
`/api/tests` 트래픽이 커지고, D1 읽기 비용/지연을 더 줄이고 싶을 때.

### 접근
- KV에 `{ tests, maxUpdated, count }`를 1시간 TTL로 캐싱
- Admin 저장 성공 시 KV 키 삭제(무효화)

### 해야 하는 일(요약)
- KV namespace 생성 + `wrangler.toml` 바인딩 추가
- `functions/api/tests/index.ts`에서 KV 우선 조회
- `functions/api/admin/tests/[id].ts` 저장 성공 후 KV delete

---

## 6) (선택) Cloudflare Images로 이동
### 결론
현재는 `/cdn-cgi/image`로 충분히 빠릅니다. 월 수십만~수백만 이미지 요청 규모로 커지거나, 변환 캐시/관리 기능이 필요해질 때 고려하세요.

