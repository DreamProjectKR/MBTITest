# Solution — Result.md 기준 해결 방안

[Result.md](../Result.md)에서 도출한 문제를 **우선순위·담당(대시보드 vs 코드)** 별로 정리합니다.

---

## 0. 목표

| 지표                 | 현재(요약)             | 목표                                            |
| -------------------- | ---------------------- | ----------------------------------------------- |
| 홈·intro 이미지 TTFB | 700ms~1,500ms          | 캐시 히트 시 100ms 이하, 콜드도 500ms 이하 경향 |
| testintro 동시 fetch | 40+                    | 8개 이하(핵심만)                                |
| testquiz format 미스 | webp vs auto 이중 요청 | 단일 포맷으로 캐시 일치                         |
| 404 preload          | ENFJ/ENFP 등           | 0건                                             |

---

## 1. Cloudflare 대시보드 (우선순위 1)

### 1.1 Cache Rules — `/cdn-cgi/image/*`

**문제**: Result §3.3 — 리사이즈 결과가 엣지에 오래 캐시되지 않으면 매 요청마다 Image Resizing + origin 처리.

**조치**:

1. Cloudflare Dashboard → **Caching** → **Cache Rules** → **Create rule**
2. **Rule name**: `Image Resizing edge cache`
3. **When incoming requests match**: Custom expression  
   `(http.host eq "dreamp.org" or http.host eq "www.dreamp.org") and starts_with(http.request.uri.path, "/cdn-cgi/image/")`
4. **Then**: Cache eligibility **Eligible for cache**, Edge TTL **1 day** (또는 7일)
5. 저장 후 배포

**검증**: 동일 이미지 URL 두 번 요청 → 응답 헤더 `cf-cache-status: HIT` (두 번째)

**롤백**: 규칙 비활성화 또는 삭제

---

### 1.2 Rocket Loader OFF

**문제**: Result와 별도 이슈 — Rocket Loader가 스크립트 지연·동시 요청을 유발해 503 가능.

**조치**: Dashboard → **Speed** → **Optimization** → **Rocket Loader** → **Off**

**검증**: 페이지 소스에 `rocket-loader` 미로드, Network에 스크립트가 즉시 실행

---

### 1.3 (선택) Tiered Cache

**문제**: Result §3.3 — Tiered Cache가 꺼져 있으면 엣지 적중률이 낮을 수 있음.

**조치**: Dashboard → **Caching** → **Tiered Cache** → 플랜에 따라 활성화

---

## 2. 코드 — testintro preload 축소 (우선순위 2) — **적용됨**

**문제**: Result §2.2 — `startBackgroundPrefetch`가 40+ 이미지를 fetch → 병목·503·불필요한 대역폭.

**파일**: `public/scripts/testintro.js` — Phase1: 질문 1 + 결과 1 (@320), Phase2: 최대 6건(@320), Start 클릭 warm-up 동일 축소.

**조치(권장 스펙)**:

| 단계               | 현재                    | 변경                                                                     |
| ------------------ | ----------------------- | ------------------------------------------------------------------------ |
| Phase 1 (critical) | 질문 2 + 결과 2, 폭 320 | **유지** 또는 질문 **1** + 결과 **1**만                                  |
| Phase 2 (idle)     | 나머지 전체 + 다중 폭   | **제거** 또는 **다음 2문항만** (폭 320만)                                |
| `runRest`          | 전체 질문·결과          | **비활성화** 또는 `requestIdleCallback` 안에서 **최대 N=6** fetch로 상한 |

**구현 힌트**:

- `startBackgroundPrefetch`의 `runRest`를 빈 함수로 두거나, `extractImagePaths`에서 상위 4~6개 경로만 반환하는 플래그 추가.
- `preloadResultImages`는 실제 존재하는 키만 preload (§3 참고: 404 제거 후 적용).

**검증**: Network 탭에서 testintro 진입 후 **fetch 이미지 수 ≤ 8**

**롤백**: `git revert` 해당 커밋

---

## 3. 코드 — 홈 format=webp (우선순위 3) — **적용됨**

**문제**: Result §2.1 — `format=auto`는 인코딩 비용·캐시 키 분기.

**적용 파일**: `index.html`, `main.js`, `testlist.js`, `config.js`(헤더/푸터 CSS 변수), `partials/header.html`, `footer.html`, `testintro.html`, `testlist.html`, `testresult.html`

**검증**: 홈 카드·배너 요청 URL에 `format=webp` 포함

---

## 4. 데이터·스토리지 — 404 제거 (우선순위 4) — **수동 확인**

**문제**: Result §1.2 — ENFJ.png 등 preload 실패는 **프로덕션 R2에 객체가 없거나 키 대소문자 불일치**일 때 발생. 로컬 `assets/test-summer/images/`에는 `ENFJ.png`, `ENFP.png` 등 존재.

**조치**(운영): `wrangler r2 object list mbti-assets --prefix assets/test-summer/images/` 로 R2 동기화, 누락 시 어드민 업로드.

---

## 5. 코드 — testquiz format·폭 일치 (Result §2.3) — **적용됨**

**조치**: 질문 이미지 `width=480` + `srcset` 단일 `480` + preload 동일 URL — 요청 1건·format=webp만 사용.

---

## 6. 배포·운영 체크리스트

- [x] Cache Rules 저장 후 5~10분 대기 (전파)
- [ ] `npm test` 통과
- [ ] `npm run pages:deploy` + Worker 배포 (`npm run worker:deploy` 등 프로젝트 스크립트 기준)
- [ ] dreamp.org 홈·testintro·testquiz Network 재측정 (Result.md와 동일 절차)

---

## 7. 문서 상호 참조

| 문서                                                   | 내용                        |
| ------------------------------------------------------ | --------------------------- |
| [Result.md](../Result.md)                              | 측정·원인                   |
| [Image.md](Image.md)                                   | 단일 요청 지연·preload 전략 |
| [IMAGE_LOADING_FIX.md](IMAGE_LOADING_FIX.md)           | SW 디바운스·캐시 이름 등    |
| [CLOUDFLARE_PERFORMANCE.md](CLOUDFLARE_PERFORMANCE.md) | Tiered Cache·Cache-Tag      |

---

## 8. 우선 적용 순서(한 줄)

**대시보드 Cache Rules + Rocket Loader OFF → testintro preload 상한 → 홈 webp → R2/test.json 404 정리 → 퀴즈 format 통일**
