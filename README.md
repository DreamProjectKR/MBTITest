# DreamProject MBTI MVP

Figma 기획안
([DreamProject](https://www.figma.com/design/WMJMNrcMjLdI88EM1Xc6TS/DreamProject?node-id=228-3))
을 그대로 옮긴 HTML/CSS/JS 기반의 MBTI 테스트 허브입니다. Cloudflare Pages에서바
로 배포할 수 있도록 정적 자원으로 구성했으며, JSON 기반의 테스트 데이터를 관리자
가 직접 만들고 내보낼 수 있습니다.

## 폴더 구조

```text
public/                    # 정적 페이지 (index, admin)
public/styles/global.css    # 레이아웃 및 페이지 단위 스타일
path_to_your_design_system/ # 디자인 토큰 + 컴포넌트 정의
scripts/                    # index/admin 전용 JS
assets/data/mbti-tests.json # 샘플 테스트 및 결과 데이터
```

## 실행 방법

1. `public/index.html`을 브라우저에서 열면 홈을, `public/admin.html`을 열면 관리
   자 페이지를 볼 수 있습니다.
2. 개발 서버가 필요하다면 `npx serve public`처럼 정적 서버로 `public` 폴더를 호
   스팅하면 됩니다.

## 데이터 스키마 (`assets/data/mbti-tests.json`)

```json
{
  "tests": [
    {
      "id": "dream-001",
      "title": "첫번째 테스트",
      "description": "string",
      "tags": ["#tag"],
      "thumbnail": "https://...",
      "questions": [
        {
          "id": "q1",
          "prompt": "질문",
          "answers": [
            {
              "id": "q1a",
              "label": "답변",
              "mbtiAxis": "EI",
              "direction": "E"
            },
            { "id": "q1b", "label": "답변", "mbtiAxis": "EI", "direction": "I" }
          ]
        }
      ],
      "results": {
        "ENFP": { "image": "https://...", "summary": "string" },
        "ESFP": { "image": "https://...", "summary": "string" }
        // ... 16개 MBTI 모두 필요
      }
    }
  ],
  "forumHighlights": [
    {
      "id": "forum-001",
      "title": "MBTI 관련 내용요약",
      "image": "https://...",
      "ctaLabel": "이글 보러가기",
      "href": "#"
    }
  ]
}
```

- 각 문항은 **2지선다**이고, 모든 답변에는 `mbtiAxis(EI/SN/TF/JP)`와
  `direction`(해당 축에서 어떤 문자를 의미하는지)이 必 필수입니다.
- `results`에 16개 MBTI를 모두 채우면 홈 화면의 "16가지 MBTI" 그리드와 관리자 미
  리보기가 동기화됩니다.

## 관리자 페이지 워크플로우

1. `public/admin.html`을 열면 기본 JSON이 자동으로 로드됩니다.
2. 상단 셀렉트 박스로 편집할 테스트를 고르거나 `새 테스트` 버튼으로 신규 테스트
   를 만듭니다.
3. **테스트 기본 정보**에서 제목/설명/태그/썸네일을 수정하면 실시간으로 상태에반
   영됩니다.
4. **문항 작성** 섹션에서 질문과 두 개의 답변을 입력하고, 각 답변의 MBTI 축과 극
   을 지정한 뒤 `문항 추가`를 누르면 리스트에서 순서를 이동하거나 삭제할 수 있습
   니다.
5. **MBTI 결과 콘텐츠**에서 코드(예: ENFP), 이미지, 설명을 작성하고 저장하면 우
   측 리스트에 카드가 추가됩니다.
6. 상단의 `JSON 내보내기` 버튼으로 최신 데이터를 다운로드하고, Cloudflare Pages
   저장소(`assets/data/mbti-tests.json`)에 덮어쓰면 홈과 관리자 페이지가 동시에
   갱신됩니다.

## Cloudflare Pages 배포 가이드

### Pages + R2(Functions) 설정

> **중요:** Admin에서 테스트를 생성/업로드하려면 반드시 Functions(또는 Workers)
> 이 켜져 있어야 합니다. 정적 배포만으로는 R2에 쓰기가 되지 않습니다.

관리자 페이지에서 업로드하면 R2에 `assets/data/{testId}/test.json`과 `images/*`
가 생성됩니다. 다음을 설정하세요.

1. **Functions 활성화**: 루트 `functions/api/tests.js`가 Pages Functions로 배포
   됩니다.
2. **R2 바인딩**: Pages > Settings > Functions > R2 bindings에서 버킷을 만들고바
   인딩 이름을 `MBTI_BUCKET`으로 지정합니다.
3. **공개 URL 환경변수**: `R2_PUBLIC_BASE_URL`을
   `https://<r2-public-domain>/assets/data` 형태로 설정해야 프런트가 이미지에 접
   근할 수 있습니다. (custom domain을 R2에연결했다면 해당 도메인을 사용)
4. 로컬 테스트: `npm install wrangler -g` 후 `npx wrangler pages dev public` 로
   실행. `.dev.vars`에 `R2_PUBLIC_BASE_URL`, `MBTI_BUCKET` 바인딩을 설정하거나
   wrangler 대시보드에서 로컬 R2를 연결하세요.

이전처럼 정적 JSON만 사용할 경우 `scripts/utils/constants.js`의 `DATA_URL`을
`../assets/data/index.json`으로 되돌리면 기존 동작을 유지할 수 있습니다.

### 필수 환경 변수

- `MBTI_BUCKET`: R2 버킷 바인딩 이름 (Pages Functions에서 R2 객체로 주입됨)
- `R2_PUBLIC_BASE_URL`: R2에 정적 공개 경로(`https://<도메인>/assets/data`)를 가
  리키는 URL

로컬 개발 시 `.dev.vars`를 사용하세요. 샘플: `.dev.vars.example` → `.dev.vars`로
복사 후 값 채우기.

### Workers + R2 + D1/D2로 배포하기 (선택)

Admin 업로드를 Workers로 운영하려면:

1. `wrangler.toml`에 바인딩 선언

```toml
name = "mbti-admin"
main = "functions/api/tests.js"
compatibility_date = "2024-12-01"

r2_buckets = [{ binding = "MBTI_BUCKET", bucket_name = "mbti-data" }]

# D1 (선택: 테스트 메타/로그 저장용)
d1_databases = [{ binding = "MBTI_DB", database_name = "mbti-db", database_id = "<your-d1-id>" }]

# D2(베타)/서드파티 SQL을 쓸 경우 별도 Worker에서 API를 노출하고 여기서는 fetch로 연동하세요.
```

1. 변수 설정: `R2_PUBLIC_BASE_URL`를 `vars`에 추가하거나 dash에서 환경 변수로 설
   정.

2. 배포: `npx wrangler deploy` (Pages가 아닌 Workers 모드).

3. 로컬:
   `npx wrangler dev --local --var R2_PUBLIC_BASE_URL=https://<r2-public>/assets/data`.

**참고**: 현재 Functions는 R2만 사용합니다. D1/D2를 쓰려면
`functions/api/tests.js`에 추가 로직을 넣어야 하며, 바인딩 이름은 위 예시
(`MBTI_DB`)로 맞추면 됩니다.

### Cloudflare Pages에서 “Missing entry-point to Worker script” 오류가 날 때

이 메시지는 Pages 빌드 명령을 `npx wrangler deploy`로 설정했을 때 발생합니다.
Pages는정적 파일을 복사하고 Functions 폴더(`functions/`)를 자동 인식하므로, 별도
Worker 엔트리(main)가 없어도 됩니다. 해결:

1. Cloudflare Pages 대시보드 > Project > Settings > Build & Deploy

   - Build command: (비움)
   - Output directory: `public`
   - Functions directory: `functions`
   - Env vars: `MBTI_BUCKET`, `R2_PUBLIC_BASE_URL`

2. Worker 모드로 직접 배포하려면 `wrangler pages deploy ./public`(정적) 또는
   `npx wrangler deploy --config wrangler.toml`처럼 목적에 맞는 명령을 사용하세
   요. `wrangler deploy`를 Pages 빌드 명령으로 넣으면 동일 오류가 재발합니다.

## GitHub Pages 배포 가이드

1. `.github/workflows/deploy.yml`에서 정의된 workflow가 `public` 폴더를
   `gh-pages` 브랜치로 배포하므로 추가 빌드 스크립트 없이도 자동으로 페이지가 만
   들어집니다.
2. GitHub 저장소의 **Settings > Pages**로 이동해 **Source**를 `gh-pages` 브랜치
   의 루트로 설정하고 저장합니다.
3. **Settings > Actions > General**에서 Workflow permissions를 **Read and write
   permissions**로 변경하고
   `Allow GitHub Actions to create and approve pull requests` 옵션을 체크해야
   `github-actions[bot]`이 `gh-pages`에 푸시할 수 있습니다. (조직 정책상 불가능
   하다면 `repo` 권한 PAT를 발급해 `GH_PAGES_TOKEN` 같은 시크릿으로 등록하고
   workflow에서 사용하세요.)
4. workflow 실행 시 `assets/`, `scripts/`, `path_to_your_design_system/` 폴더를
   자동 으로 `public/` 안쪽으로 복사해 README에서 안내한 상대 경로(`../scripts`,
   `../assets` 등)를 유지합니다.
5. 커밋마다 `main` 브랜치로 푸시하면 workflow가 실행되며, GitHub Pages에서 곧바
   로 `public`을 서빙합니다.

## QA & 접근성 체크리스트

- [ ] `index.html` / `admin.html` 모두 데스크톱(≥1280px)과 모바일(≤768px)에서 주
      요 그리드가 깨지지 않는지 확인합니다.
- [ ] JSON을 수정한 뒤 홈의 테스트 카드/MBTI 그리드/포럼 카드가 최신 데이터를 불
      러오는지 확인합니다.
- [ ] 관리자에서 문항 추가 → 순서 이동 → 삭제 → JSON 내보내기까지 한 번의 플로우
      를 검증합니다.
- [ ] 스크린 리더가 섹션 제목(`aria-labelledby`)을 올바르게 읽는지, 버튼 포커스
      링이 명확한지 확인합니다.
- [ ] Lighthouse/axe로 기본 접근성 점검을 수행하고 대비 이슈가 없는지 확인합니다
      .

## 참고

- 디자인 토큰과 컴포넌트는 반드시 `/path_to_your_design_system` 폴더의 CSS를 통
  해 확장하세요.
- Cloudflare Workers/D1 등의 추가 백엔드가 필요하면 현재 JSON 구조를 API로 노출
  하는 방식으로 확장할 수 있습니다.
