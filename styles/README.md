# DreamProject Design System

DreamProject Figma(`node-id=228:3`)에서 추출한 토큰과 컴포넌트 정의를 CSS로 제공합니다.  
모든 페이지는 `public/styles/global.css`에서 이 폴더의 파일을 `@import` 하여 사용합니다.

## 1. Tokens (`tokens.css`)

### Color tokens

| Token | Description |
| --- | --- |
| `--color-surface` | 기본 페이지 배경 |
| `--color-surface-header` | 헤더 및 구간 강조 배경 |
| `--color-surface-brand` | CTA 강조 배경 |
| `--color-surface-hero` | 카드 내 뒷배경 |
| `--color-surface-cta`, `--color-surface-cta-alt` | CTA 카드 그라데이션 |
| `--color-border`, `--color-border-strong` | 카드/섹션 외곽선 |
| `--color-text-primary`, `--color-text-secondary`, `--color-text-muted` | 타이포 색상 계층 |
| `--color-accent`, `--color-accent-muted` | 포커스 및 상호작용 강조 |

### Typography & motion

| Token | Description |
| --- | --- |
| `--font-display`, `--font-body` | Inter + Noto Sans KR 조합 |
| `--text-size-xs` ~ `--text-size-xl` | 타이포그래피 계층 |
| `--duration-fast`, `--duration-medium`, `--easing-standard` | 인터랙션 타이밍 |

### Spacing & elevation

| Token | Description |
| --- | --- |
| `--space-xxs` ~ `--space-3xl` | 간격 스케일 |
| `--radius-sm` ~ `--radius-lg`, `--radius-pill` | 라운딩 |
| `--shadow-soft`, `--shadow-medium` | 그림자 강도 |

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

### CTA cards

| Class(es) | Purpose |
| --- | --- |
| `.cta-card` | 로그인/회원가입 CTA 블록의 베이스 카드로 토큰 기반 패딩, 그림자, 그라데이션을 지원합니다. |
| `.cta-card--login`, `.cta-card--register` | CTA 별 강조 색상을 적용하는 modifier입니다. |
| `.cta-card__icon` | CTA 아이콘을 원형 배경 안에 정렬합니다. |
| `.cta-card__body` | 타이틀, 설명, 버튼을 세로로 정렬합니다. |
| `.cta-card__eyebrow`, `.cta-card__title`, `.cta-card__description` | 서브텍스트/타이틀/설명을 위한 타이포 스타일이며 `.cta-card__description`은 `var(--color-text-secondary)`를 사용해 대비를 확보합니다. |

`.cta-card` 내부 버튼은 기존 `.ds-button` 클래스를 활용해 제어하세요.

## 3. 사용 규칙

1. **토큰 우선**: 색/폰트/라운딩/간격을 하드코딩하지 말고 토큰을 사용합니다.
2. **컴포넌트 재사용**: 새로운 UI를 만들기 전에 기존 `.ds-*` 클래스로 표현 가능한지 확인합니다.
3. **문서화 필수**: 새로운 토큰이나 컴포넌트를 만들면 본 README에 표/목록으로 설명을 추가합니다.
