# Playwright MCP 검증 보고서

**대상**: `https://dreamp.org` (프로덕션)  
**일시**: 2026-03-18  
**도구**: Cursor **user-Playwright** MCP `browser_run_code`

---

## 1. 검증 절차

1. `page.on('request')`로 이미지·`/cdn-cgi/image/` URL 수집 (쿼리 제외 dedupe)
2. **홈** `/` — `load` 후 6초 대기
3. **testintro** `testintro.html?testId=test-summer` — `load` 후 12초 대기 (idle preload 구간)
4. **testquiz** `testquiz.html?testId=test-summer` — `load` 후 6초 대기

---

## 2. 목표(Solution.md) 대비 결과

| 목표                                | 기준                                                | 프로덕션 측정                                              | 판정                               |
| ----------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| 홈 format=webp                      | 카드·배너 등 `format=webp` 위주                     | CDN 9건 중 webp 4, **auto 5** (썸네일 등)                  | **부분** — 구버전·캐시 또는 미배포 |
| intro preload ≤8 (퀴즈·결과 이미지) | `test-summer/images` 내 q/MBTI URL **≤8** 고유 요청 | **quiz 관련 64건** 고유 URL                                | **미달** — 코드상 8건 제한 미반영  |
| testquiz 단일 포맷·폭               | 질문 이미지 `format=webp`, `width=480`만            | **q10 기준** 320 webp + 480 webp + **480 format=auto** 3종 | **미달** — 구버전 퀴즈 스크립트    |
| 콘솔                                | 503/404 최소화                                      | ENFJ·ENFP·q10.png 로드 실패 로그                           | **별도 이슈** (R2/503)             |

---

## 3. 측정 수치 요약

### 홈

- 고유 CDN 이미지 URL: **9**
- `format=webp`: **4** (예: mainLogo, mainbanner)
- `format=auto`: **5**

### testintro

- CDN 이미지 URL 전체: **75** (고유)
- `test-summer/images` 경로: **66**
- 그중 질문(qN)·결과(MBTI) 패턴: **64** → Solution 목표 **≤8** 대비 **대량 초과**

### testquiz

- 수집된 질문 이미지 URL 예시:
  - `width=320,…,format=webp,…/q10.png`
  - `width=480,…,format=webp,…/q10.png`
  - `width=480,quality=auto,…,format=auto,…/q10.png`

- 최신 저장소 의도(480 + webp **단일**)와 **불일치**

---

## 4. 해석

1. **프로덕션 정적 자산(Pages `public/`)이 최신 커밋과 다름**
   - testintro preload 축소, testquiz 단일 srcset/480 webp, 홈·카드 webp 일괄 반영이 **배포되지 않았거나** 이전 빌드가 캐시됨.

2. **검증 재실행 조건**
   - `npm run pages:deploy`(또는 사용 중인 배포 파이프라인)로 **public 반영 후**
   - 동일 Playwright 스크립트로 재측정하면 intro **quiz 관련 ≤~10**, quiz **q 이미지 URL 1종·format=webp**에 가까워져야 함.

3. **ENFJ/ENFP/q10 503·404**
   - R2 객체 존재·대소문자·Worker/Image Resizing 503은 **배포와 별도**로 인프라 점검 필요.

---

## 5. 재검증용 Playwright 스니펫

아래는 MCP `browser_run_code`에 넣을 수 있는 동일 로직 요약입니다.

```js
async (page) => {
  const sets = [new Set(), new Set(), new Set()];
  const urls = [
    "https://dreamp.org/",
    "https://dreamp.org/testintro.html?testId=test-summer",
    "https://dreamp.org/testquiz.html?testId=test-summer",
  ];
  for (let i = 0; i < 3; i++) {
    const s = sets[i];
    page.on("request", (req) => {
      const u = req.url();
      if (u.includes("dreamp.org") && u.includes("/cdn-cgi/image/"))
        s.add(u.split("?")[0]);
    });
    await page.goto(urls[i], { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(i === 1 ? 12000 : 6000);
    page.removeAllListeners("request");
  }
  const intro = [...sets[1]].filter(
    (u) =>
      u.includes("test-summer/images") &&
      /q\d+|\/[EI][NS][FT][JP]\.png/i.test(u),
  );
  return {
    introQuizLike: intro.length,
    quizQ: [...sets[2]].filter((u) => /test-summer.*q\d+\.png/i.test(u)),
  };
};
```

---

## 6. 결론

| 질문                                                  | 답                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| Playwright로 목표 개선이 **프로덕션에서** 달성됐는가? | **아니요.** intro·quiz 동작은 배포 전(또는 캐시된 구버전) 상태로 관측됨. |
| 저장소 코드와 일치하려면?                             | **Pages(정적) 재배포 후** 동일 절차로 재검증.                            |
