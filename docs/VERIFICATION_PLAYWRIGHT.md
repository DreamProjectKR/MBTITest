# Playwright 검증 보고서 (dreamp.org)

**대상**: `https://dreamp.org` (프로덕션)

---

## 배포 후 재검증 (2026-03-18)

### 사용 도구

1. **Playwright MCP** `browser_run_code` — 홈/intro/quiz CDN URL·포맷 요약
2. **로컬 스크립트** `npm run verify:dreamp` — intro **고유 자산 파일 수**, testquiz **질문 이미지 width|format**

### 1) MCP 측정 요약

| 구간                        | 관측                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| **홈**                      | CDN 9건 — webp 4, **auto 5** (다른 테스트 썸네일 등)                                     |
| **testintro**               | CDN 전체 75건 중 **webp 73, auto 2** (배너/헤더) — 포맷은 개선된 편                      |
| **testintro** quiz URL 변형 | 쿼리 제외 고유 CDN URL **64건** (폭 320/480/640 조합으로 팽창)                           |
| **testquiz**                | 첫 화면 질문에 **320 webp + 480 webp** 동시 요청 (`format=auto` 혼입은 이번 런에서 없음) |
| **콘솔**                    | **503** 리소스 실패 (ENFJ, ENFP, q1 등 — Image Resizing/R2 쪽)                           |

### 2) `verify:dreamp` 측정 (자산 파일 기준)

- **testintro** `test-summer/images` 내 **고유 파일**(qN·MBTI): **28개** (질문 12 + MBTI 16 전부 네트워크 요청 관측)
- 저장소 `testintro.js` 의도: Phase1·2 합쳐 **약 8개 이하** 프리로드 → **불일치**
- 일부 파일은 폭 **320만**, 일부는 **320+480+640** (썸네일 `srcset` 등으로 보임)

**testquiz** (첫 문제, 셔플로 q2 관측):

- 질문 CDN 요청: **`320|webp` + `480|webp`** → **단일 480 webp 목표 미달**

### 3) 판정

| 목표 (Solution.md)              | 배포 후 프로덕션                  |
| ------------------------------- | --------------------------------- |
| intro 프리로드 소량 (~8 자산)   | **미달** — 28개 파일 요청         |
| testquiz 질문 **480 webp 단일** | **미달** — 320+480 병행           |
| 홈/intro webp 비중              | **부분 달성** — intro는 webp 위주 |
| 503 제거                        | **미해결**                        |

### 4) 해석

- **정적 배포가 일부 반영**된 정황은 있음(intro 전체 webp 비중↑).
- **프리로드 캡·퀴즈 단일 폭**은 프로덕션에서 기대대로 동작하지 않음 → `testintro.js` / `testquiz.js` **구버전 캐시**(CDN·브라우저·SW) 또는 **실제 배포 바이너리가 저장소 최신과 다름** 가능성.
- 다음 확인: 브라우저에서 `testintro.js`·`testquiz.js` 직접 열어 `PRELOAD_PHASE2_MAX_FETCHES` / `480` 단일 srcset 문자열 존재 여부.

---

## 이전 측정 (배포 전 참고)

- 고유 CDN URL만 세면 intro **64건** 등으로 팽창 → **동일 자산 path 기준**으로도 재집계 필요.
- 상세는 위 배포 후 절차 참고.

---

## 재실행

```bash
npm run verify:dreamp
```

(Chromium 필요: `npx playwright install chromium`)

---

## MCP용 스니펫 (요약)

`browser_run_code`에 넣을 수 있는 홈→intro→quiz 순회 예시는 Git 히스토리 또는 `scripts/verify-dreamp.mjs` 로직과 동일하게 구성하면 됩니다.
