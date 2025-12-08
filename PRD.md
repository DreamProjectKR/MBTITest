# PRD - DreamProject MBTI 테스트 허브 (초안)

최종 배포 목표: Cloudflare Pages + Functions + R2/KV 기반으로 Figma 기획안을 웹에 구현하고, 관리자 UI에서 테스트를 작성·업로드해 즉시 반영되는 MBTI 테스트 허브를 제공한다.

## 1. 배경 & 목적

- Figma 기획을 동일한 UI/UX로 웹에 구현한 MVP.
- 정적 자산(HTML/CSS/JS)을 Pages로 서빙하고, 테스트 데이터/이미지는 R2·KV에 저장·배포.
- 관리자(Admin)에서 질문/썸네일/결과 이미지를 작성·업로드해 실시간으로 반영.

## 2. 범위

- 포함: 홈·테스트 소개·퀴즈·결과 노출, 관리자 CRUD(생성/업데이트) 및 JSON 내보내기.
- 제외: 회원가입/로그인 UI, 댓글·포럼 작성, 복잡한 추천 알고리즘, 다국어 지원.

## 3. 핵심 지표

- 테스트 시작 클릭률, 완주율, 결과 공유 클릭률.
- 관리자 업로드 성공률(에러 없는 업로드 비율), 테스트 반영 시간(업로드 → 조회).

## 4. 사용자 시나리오

- 방문자: 홈에서 테스트 카드 목록 확인 → 테스트 선택 → 2지선다 질문 진행 → MBTI 결과 카드 확인 및 공유.
- 관리자: admin 페이지 진입(Access/토큰 보호) → 테스트 선택/신규 생성 → 질문·결과·이미지 입력 → 업로드(POST /api/tests) → 홈에서 최신 데이터 확인.

## 5. 기능 요구사항

### 5.1 퍼블릭(웹)

- 홈 데이터는 Functions GET `/api/tests`를 통해 로드하며, `tests`, `forumHighlights`, `assetBaseUrl`를 사용해 카드/그리드를 렌더링한다.
- 테스트 소개 페이지에서 썸네일·설명·태그·애니메이션(`heroAnimation`) 표시.
- 퀴즈: 모든 문항 2지선다, 각 답변에 MBTI 축(`EI/SN/TF/JP`)과 방향(`E/I/S/N/T/F/J/P`)을 매핑해 점수 계산.
- 결과: 16개 MBTI 코드 전부 렌더링 가능하며, 결과별 이미지·요약을 표시하고 공유 링크 버튼 제공.
- 에러/빈 상태: 데이터 불러오기 실패 시 재시도 안내, 결과 누락 시 기본 메시지 표출.

### 5.2 관리자(Admin)

- 접근 제어: Cloudflare Access 또는 `X-Admin-Token`(환경변수 `ADMIN_TOKEN`)으로 보호.
- 테스트 생성/수정: 제목, 설명, 태그, `heroAnimation`, 썸네일, 질문 배열, 결과(16 MBTI) 입력/수정.
- 업로드: POST `/api/tests`(multipart/form-data)로 JSON+이미지 업로드 → R2 `assets/data/{testId}/`에 저장, KV index(`assets/data/index.json`) 갱신.
- 인덱스 동기화: 신규 테스트 시 `{id, title, path}`를 index에 upsert.
- 미리보기/내보내기: 최신 JSON을 화면에서 확인하고 다운로드 가능.

## 6. 데이터 모델

- Index (`assets/data/index.json`): `tests[]`(id, title, path), `forumHighlights[]`.
- Test (`assets/data/{testId}/test.json`):
  - `id`, `title`, `description`, `tags[]`, `heroAnimation`, `thumbnail`
  - `questions[]`: `{ id, prompt, answers:[{ id, label, mbtiAxis, direction }] }`
  - `results{ MBTI_CODE: { summary, image } }` (16개 코드 모두 지원)
- 이미지: `assets/data/{testId}/images/*` (썸네일, MBTI별 이미지). 응답 시 `assetBaseUrl` + 상대경로로 완전한 URL 제공.

## 7. API 요구사항 (Cloudflare Pages Functions)

- `GET /api/tests`
  - R2에서 index와 각 테스트 JSON을 읽어 응답.
  - 헤더: `Cache-Control: public, max-age=60..300, stale-while-revalidate=600`, `ETag` 권장.
- `POST /api/tests` (관리자 업로드)
  - multipart/form-data. 필드: `title`(필수), `description`, `heroAnimation`, `tags`(JSON), `questions`(JSON), `results`(JSON), `testId`(옵션), `thumbnail` 파일, `resultImage_{MBTI}` 파일들.
  - `testId` 미제공 시 제목으로 slugify(`test-...`). 업로드 후 index upsert 및 정규화된 test JSON 반환.
  - 실패 시 JSON 에러 메시지 + 4xx/5xx.
- CORS: `Access-Control-Allow-Origin` 동적 허용, 메서드 `GET,POST,OPTIONS`.

## 8. 비기능 요구사항

- 성능/캐시: GET 응답은 CDN 캐시 허용, 관리자 POST 응답은 `no-store`. 이미지(R2)는 CDN 기본 캐시 사용.
- 가용성: Cloudflare Pages/Functions 기본 SLA 활용, Functions 실패 로그는 console/error로 남김.
- 보안: 관리자 API는 Access 또는 서명 토큰으로 보호, R2 공개 URL은 ASSETS_BASE/R2_PUBLIC_BASE_URL 환경변수로 제한된 경로만 노출.
- 접근성: 주요 버튼/섹션에 aria 레이블, 포커스 링 유지. 모바일(≤768px) 레이아웃 유지.

## 9. 배포/운영

- 로컬: `wrangler pages dev public` 실행, preview KV/R2 바인딩 사용. `.dev.vars`에 `MBTI_BUCKET`, `R2_PUBLIC_BASE_URL`(또는 `ASSETS_BASE`), 필요 시 `ADMIN_TOKEN` 설정.
- 프로덕션 Pages 설정:
  - Build command 비움, Output `public`, Functions dir `functions`.
  - R2 바인딩 이름 `MBTI_BUCKET`; 환경변수 `R2_PUBLIC_BASE_URL`(또는 `ASSETS_BASE=.../assets/data`), `ADMIN_TOKEN`.
  - 초기 데이터: `assets/data/index.json` 및 `assets/data/{testId}/test.json`/이미지를 R2에 업로드.
- 배포: `wrangler pages publish public` 또는 Git 연결 후 자동 배포.

## 10. 리스크 & 오픈 이슈

- 인증 미설정 시 관리자 API 남용 위험 → Access/토큰 필수.
- R2 공개 경로 오구성 시 잘못된 URL 노출 가능 → `ASSETS_BASE` 검증 필요.
- 대량 테스트 업로드 시 KV 인덱스 병합 충돌 위험 → 단일 관리 채널 유지 또는 잠금 전략 검토.
- 단일 GET 엔드포인트만 존재 → 향후 `/api/tests/:id` 분리 필요 여부 검토.

## 11. 향후 과제(초안)

- Admin UI에 업로드 진행 상태/실패 알림 강화.
- 결과 공유용 OG 이미지/동적 메타 태그 지원 검토.
- 모니터링: 업로드/조회 실패율 대시보드(Workers Analytics) 연결.
