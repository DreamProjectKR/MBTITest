# DreamProject Design System

DreamProject Figma(`node-id=228:3`)에서 추출한 토큰과 컴포넌트 정의를 CSS로 제공합니다.  
모든 페이지는 `public/styles/global.css`에서 이 폴더의 파일을 `@import` 하여 사용합니다.

## 1. Tokens (`tokens.css`)

| 토큰 | 설명 |
| --- | --- |
| `--color-surface`, `--color-surface-header`, `--color-surface-brand` | 배경 계층 값 (헤더의 #EDEDED, CTA 영역 #FFDede 등) |
| `--color-border`, `--color-border-strong` | 카드 및 그리드 외곽선 컬러 (#DCDCDC / #B3B3B3) |
| `--color-text-*` | 기본/보조/서브 텍스트 컬러 |
| `--font-display`, `--font-body` | Inter + Noto Sans KR 조합 |
| `--text-size-*` | 섹션 타이틀~서브텍스트 타이포 스케일 |
| `--space-*`, `--radius-*` | 섹션 padding, 카드 라운딩(15px), pill 버튼 등을 위한 값 |
| `--shadow-soft`, `--shadow-medium` | 카드/버튼 그림자 |

필요한 경우 글로벌 스타일에서 `var(--token-name)`으로 참조합니다. 새 토큰이 필요하면 Figma 색/간격을 확인한 뒤 여기에만 추가하세요.

## 2. Components (`components.css`)

- `.ds-button` + modifiers `--primary`, `--secondary`, `--ghost`  
  - 헤더 CTA, \"다른거 보기\" 버튼 등 공통 버튼 스타일
- `.ds-card`, `--test`, `--feed`, `--compact`  
  - 테스트 카드, 포럼 카드, 관리자 리스트 항목 등
- `.ds-badge`, `.ds-badge__media`, `.ds-badge__label`  
  - 16가지 MBTI 그리드 셀과 관리자 결과 리스트
- `.ds-chip`, `.ds-chip-row`  
  - 문항 내 답변 요약 뱃지
- `.ds-link`, `.ds-alert`  
  - 텍스트 CTA 링크와 오류 메시지

필요한 컴포넌트를 여기서 선언한 뒤 앱에서는 클래스만 적용하세요. 새 컴포넌트가 필요하면 이 파일에 정의하고 README에 사용법을 추가합니다.

## 3. 사용 규칙

1. **토큰 우선**: 색/폰트/라운딩/간격을 하드코딩하지 말고 토큰을 사용합니다.
2. **컴포넌트 재사용**: 새로운 UI를 만들기 전에 기존 `.ds-*` 클래스로 표현 가능한지 확인합니다.
3. **문서화 필수**: 새로운 토큰이나 컴포넌트를 만들면 본 README에 표/목록으로 설명을 추가합니다.
