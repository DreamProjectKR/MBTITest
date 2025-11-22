# DreamProject MBTI MVP

Figma 기획안([DreamProject](https://www.figma.com/design/WMJMNrcMjLdI88EM1Xc6TS/DreamProject?node-id=228-3))을 그대로 옮긴 HTML/CSS/JS 기반의 MBTI 테스트 허브입니다. Cloudflare Pages에서 바로 배포할 수 있도록 정적 자원으로 구성했으며, JSON 기반의 테스트 데이터를 관리자가 직접 만들고 내보낼 수 있습니다.

## 폴더 구조

```
public/                    # 정적 페이지 (index, admin)
public/styles/global.css    # 레이아웃 및 페이지 단위 스타일
path_to_your_design_system/ # 디자인 토큰 + 컴포넌트 정의
scripts/                    # index/admin 전용 JS
assets/data/mbti-tests.json # 샘플 테스트 및 결과 데이터
```

## 실행 방법

1. `public/index.html`을 브라우저에서 열면 홈을, `public/admin.html`을 열면 관리자 페이지를 볼 수 있습니다.
2. 개발 서버가 필요하다면 `npx serve public`처럼 정적 서버로 `public` 폴더를 호스팅하면 됩니다.

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
            { "id": "q1a", "label": "답변", "mbtiAxis": "EI", "direction": "E" },
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
    { "id": "forum-001", "title": "MBTI 관련 내용요약", "image": "https://...", "ctaLabel": "이글 보러가기", "href": "#" }
  ]
}
```

- 각 문항은 **2지선다**이고, 모든 답변에는 `mbtiAxis(EI/SN/TF/JP)`와 `direction`(해당 축에서 어떤 문자를 의미하는지)이 必 필수입니다.
- `results`에 16개 MBTI를 모두 채우면 홈 화면의 "16가지 MBTI" 그리드와 관리자 미리보기가 동기화됩니다.

## 관리자 페이지 워크플로우

1. `public/admin.html`을 열면 기본 JSON이 자동으로 로드됩니다.
2. 상단 셀렉트 박스로 편집할 테스트를 고르거나 `새 테스트` 버튼으로 신규 테스트를 만듭니다.
3. **테스트 기본 정보**에서 제목/설명/태그/썸네일을 수정하면 실시간으로 상태에 반영됩니다.
4. **문항 작성** 섹션에서 질문과 두 개의 답변을 입력하고, 각 답변의 MBTI 축과 극을 지정한 뒤 `문항 추가`를 누르면 리스트에서 순서를 이동하거나 삭제할 수 있습니다.
5. **MBTI 결과 콘텐츠**에서 코드(예: ENFP), 이미지, 설명을 작성하고 저장하면 우측 리스트에 카드가 추가됩니다.
6. 상단의 `JSON 내보내기` 버튼으로 최신 데이터를 다운로드하고, Cloudflare Pages 저장소(`assets/data/mbti-tests.json`)에 덮어쓰면 홈과 관리자 페이지가 동시에 갱신됩니다.

## Cloudflare Pages 배포 가이드

1. Git 저장소를 연동한 뒤 **Project name**을 만들고, Build command는 비워둔 채 Output directory를 `public`으로 설정합니다.
2. `assets/data/mbti-tests.json`과 `scripts/`, `path_to_your_design_system/` 등 나머지 폴더는 루트에 그대로 둡니다. Pages는 `public` 이외의 경로를 그대로 복사하므로 JSON을 업데이트하면 다음 배포에 포함됩니다.
3. 환경 변수나 서버 코드가 필요 없으므로 무료 플랜에서도 동작합니다.

## QA & 접근성 체크리스트

- [ ] `index.html` / `admin.html` 모두 데스크톱(≥1280px)과 모바일(≤768px)에서 주요 그리드가 깨지지 않는지 확인합니다.
- [ ] JSON을 수정한 뒤 홈의 테스트 카드/MBTI 그리드/포럼 카드가 최신 데이터를 불러오는지 확인합니다.
- [ ] 관리자에서 문항 추가 → 순서 이동 → 삭제 → JSON 내보내기까지 한 번의 플로우를 검증합니다.
- [ ] 스크린 리더가 섹션 제목(`aria-labelledby`)을 올바르게 읽는지, 버튼 포커스 링이 명확한지 확인합니다.
- [ ] Lighthouse/axe로 기본 접근성 점검을 수행하고 대비 이슈가 없는지 확인합니다.

## 참고

- 디자인 토큰과 컴포넌트는 반드시 `/path_to_your_design_system` 폴더의 CSS를 통해 확장하세요.
- Cloudflare Workers/D1 등의 추가 백엔드가 필요하면 현재 JSON 구조를 API로 노출하는 방식으로 확장할 수 있습니다.
