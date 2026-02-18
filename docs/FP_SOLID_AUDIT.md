# FP & SOLID Audit Report

공격적 세부 검사 결과 및 적용한 수정 사항.

---

## 1. SOLID 점검

### S (Single Responsibility) ✅

| 위치                              | 상태 | 비고                                            |
| --------------------------------- | ---- | ----------------------------------------------- |
| `worker/index.ts`                 | ✅   | 라우팅·캐시·디스패치만; 핸들러는 각 모듈에 위임 |
| `worker/router.ts`                | ✅   | 경로 파싱 + Tiered Cache 옵션만 (I/O 없음)      |
| `worker/api/_utils/http.ts`       | ✅   | 헤더·캐시키·Response 생성만                     |
| `worker/api/admin/utils/store.ts` | ✅   | D1/R2 접근만; 키/날짜는 Pure                    |
| 각 API 핸들러                     | ✅   | 한 라우트당 한 책임; 검증·변환은 Pure로 분리    |

### O (Open/Closed) ✅

| 항목         | 상태 | 비고                                                         |
| ------------ | ---- | ------------------------------------------------------------ |
| 라우트 확장  | ✅   | `routeTable`에 항목 추가만으로 확장; `parsePath` 수정 불필요 |
| 새 캐시 정책 | ✅   | `getTieredCacheCf`에 분기 추가로 확장                        |
| 새 API       | ✅   | 새 핸들러 파일 + index 라우트 테이블 등록                    |

### L (Liskov) ✅

- 핸들러는 모두 `(context: PagesContext<MbtiEnv>) => Promise<Response>` 계약 준수.
- `MbtiEnv` 바인딩이 없어도 500/명시적 메시지로 실패; 치환 가능.

### I (Interface Segregation) ✅

- `worker/_types.ts`: `MbtiEnv`, `PagesContext`, R2/D1/KV 인터페이스만 노출.
- 페이로드 타입은 핸들러/검증 로컬에 한정.

### D (Dependency Inversion) ✅

- 핸들러는 `context.env`, `context.request`에만 의존; 구체적 전역/하드코딩 없음.
- `new URL(context.request.url)`로 origin 등 파생.

---

## 2. FP 점검

### Pure vs I/O 경계 ✅ (수정 반영)

| 파일                         | 이슈                                                                       | 조치                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `worker/assets/handler.ts`   | `addCaseFallbackCandidates(keys, tail)`가 `keys` 배열을 뮤테이트           | **수정**: `getCaseFallbackCandidates(tail)`로 변경해 새 배열 반환, 호출부에서 spread로 병합                   |
| `public/scripts/testquiz.js` | `getQuestionImageUrlCandidates(question)`이 `state.test?.id` 참조로 비순수 | **수정**: `getQuestionImageUrlCandidates(testId, question)`로 시그니처 변경, 호출부에서 `state.test?.id` 전달 |

### 순수 함수 표기 보강 ✅

| 파일                              | 조치                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `worker/api/tests/[id].ts`        | `normalizeR2KeyFromIndexPath`, `parseJsonArray`, `cacheTagForTest`에 `/** Pure */` 추가 |
| `worker/api/admin/utils/store.ts` | `formatIndexDate`: 인자 없이 호출 시 현재 시간 사용(비순수)을 주석으로 명시             |

### 불변성 ✅

| 파일                                                  | 상태                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `worker/api/admin/tests/[id]/results/[mbti]/image.ts` | 이전 리팩터에서 `mergeResultImageIntoTest`로 입력 객체 불변 유지 적용됨          |
| `worker/index.ts`                                     | 404 응답 생성 중복 제거: `notFoundResponse()` 한 곳에서만 생성 (DRY + 단일 정의) |

### 부수 효과 위치 ✅

- I/O(D1, R2, KV, Cache API, `fetch`, `context.waitUntil`)는 핸들러 또는 명시적 함수(`readTest`, `writeTest`, `extractUpload`, `tryTieredCache` 등)에만 존재.
- Public: `readCachedTestJson`, `persistTestJson`, `fetch`, DOM 업데이트는 별도 함수로 분리되어 있음.

---

## 3. 남은 주의 사항 (수정 없음)

- **`getParam` / `getTestIdFromQuery` / `getPercentParam`** (testresult.js, testquiz.js): `window.location.search`를 읽음. 엄밀한 FP에서는 I/O이지만, “현재 URL 기준으로 동일 입력→동일 출력”으로 볼 수 있어 주석만으로 구분 가능. 필요 시 "(reads current URL)" 등으로 표기.
  **`formatIndexDate()`** (store.ts): 인자 없이 호출하면 `new Date()` 사용으로 호출 시점에 따라 결과가 달라짐. D1 `updated_at` 등에 필요하므로 유지하고, 주석으로 “no-arg 시 impure” 명시함.
- **`main.js`** (public): `normalizeTests`는 순수. `resolveThumbnailPath`는 `window.assetUrl` 사용으로 전역 의존. 구조상 config 의존이므로 추가 리팩터 없이 유지.

---

## 4. 적용한 수정 요약

1. **worker/assets/handler.ts**: `addCaseFallbackCandidates` → `getCaseFallbackCandidates(tail)` (순수, 배열 반환).
2. **public/scripts/testquiz.js**: `getQuestionImageUrlCandidates(testId, question)` 시그니처 변경 및 호출부 수정.
3. **worker/index.ts**: `notFoundResponse()` 도입, 404 응답 단일 정의.
4. **worker/api/tests/[id].ts**: `normalizeR2KeyFromIndexPath`, `parseJsonArray`, `cacheTagForTest`에 Pure 주석 추가.
5. **worker/api/admin/tests/[id].ts**: `formatIndexDate()` import 후 `now` 계산에 사용 (중복 제거).
6. **worker/api/admin/utils/store.ts**: `formatIndexDate` JSDoc에 “no-arg 시 현재 시간 사용(impure)” 명시.

---

## 5. 검사 대상 파일 목록

- Worker: `index.ts`, `router.ts`, `_types.ts`, `api/_utils/http.ts`, `api/tests/index.ts`, `api/tests/[id].ts`, `api/tests/[id]/compute.ts`, `api/admin/tests/[id].ts`, `api/admin/tests/[id]/images.ts`, `api/admin/tests/[id]/results/[mbti]/image.ts`, `api/admin/utils/store.ts`, `assets/handler.ts`
- Public: `config.js`, `main.js`, `testintro.js`, `testlist.js`, `testquiz.js`, `testresult.js`, `admin/*.js`, `sw.js`

위 파일들에 대해 위 원칙들이 충족되는지 확인했으며, 위반·누락된 부분은 위와 같이 수정·문서화함.

---

## 6. 2차 검사 (추가 수정)

### 불변성 보강

| 파일                         | 이슈                                                                 | 조치                                                                 |
| ---------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `public/scripts/testlist.js` | `normalizeTests`: `deduped.sort()`로 **자기 배열 in-place 뮤테이트** | **수정**: `return [...deduped].sort(...)` 로 정렬된 **새 배열** 반환 |
| `public/scripts/main.js`     | 동일 `normalizeTests` in-place sort                                  | **수정**: 동일하게 `return [...deduped].sort(...)` 적용              |

---

## 7. 재검사용 체크리스트

- [x] **입력 뮤테이트**: 어떤 함수도 인자(객체/배열)를 직접 수정하지 않음. (`getCaseFallbackCandidates` 반환 병합·`parts.slice(0,-1)` 사용, `mergeResultImageIntoTest` 불변 반환, `normalizeTests` `[...].sort`, `shuffleCopy`·`buildShuffledQuestions` 불변 셔플, `computeFromAnswers` reduce/map 누적)
- [x] **순수 표기**: I/O 없는 변환/검증에는 `/** Pure */` 또는 섹션 주석으로 구분. (worker/public 전역 검색으로 확인)
- [x] **I/O 경계**: D1/R2/KV/Cache/fetch/DOM/Storage는 핸들러 또는 명시적 I/O 함수에만 존재.
- [x] **404/에러 응답**: Worker `notFoundResponse()` 단일 정의, 3곳에서 사용.
- [x] **라우팅**: `parsePath` + `routeTable`; 새 라우트는 테이블 추가로만 확장(Open/Closed).
- [x] **공유 상태**: Public 단일 소스; Admin·testquiz 모두 불변 업데이트만 사용(§8·§9 반영).

---

## 8. 3차 검사 (추가 수정)

| 파일                           | 이슈                                                   | 조치                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/scripts/admin/main.js` | `handleBulkResultUpload`: `test.results` 직접 뮤테이트 | **수정**: `nextResults` 새 객체로 누적 후 `state.loadedTests[test.id] = { ...test, results: nextResults }` 로 한 번만 반영 (불변 업데이트). |
| `public/scripts/main.js`       | `normalizeTests` Pure 표기 없음                        | **수정**: 섹션 주석에 "Pure: 중복 제거 + 최신순 정렬 (입력 불변, 새 배열 반환)" 추가.                                                       |
| `worker/index.ts`              | `isCacheableGetRoute` Pure 표기 없음                   | **수정**: `/** Pure: whether route is GET-cacheable for tiered cache. */` 추가.                                                             |

---

## 9. 4차 검사 (의도적 미수정 제거 — 전부 수정)

| 위치                                 | 이슈                                                              | 조치                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin 전역**                       | `active`/`activeTest` 직접 뮤테이트                               | **수정**: `state.js`에 `updateLoadedTest(testId, nextOrUpdater)` 추가. `syncImagesToActiveTestFromStore`는 새 객체 구성 후 `updateLoadedTest(active.id, next)`. `forms.js` 메타/질문/결과 추가·삭제·업로드 핸들러는 모두 `updateLoadedTest(activeTest.id, next)` 또는 `(prev) => ({ ...prev, ... })` 로 불변 업데이트만 사용. |
| **testintro.js** `extractImagePaths` | `questionPaths.push`, `resultPaths.push`                          | **수정**: `questions.flatMap(...)`, `Object.values(resultsObj).map(...).filter(Boolean)` 로 변경 (push 없음).                                                                                                                                                                                                                 |
| **testquiz.js**                      | `state.answers.push(answer)`, `state.scores[axis][dir]` 직접 대입 | **수정**: `state.answers = [...state.answers, answer]`. `recordScore`는 `state.scores = { ...state.scores, [axis]: { ...prevAxis, [dir]: prevCount + 1 } }` 로 불변 업데이트.                                                                                                                                                 |

---

## 10. 5차 검사 (FP/SOLID 전수 재검사)

| 파일                               | 이슈                                                                                                                             | 조치                                                                                                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worker/assets/handler.ts`         | `getCaseFallbackCandidates` 내부에서 `parts.pop()`으로 **배열 인자 뮤테이트** (split 결과는 새 배열이지만 in-place 변경)         | **수정**: `filename = parts[parts.length - 1] ?? ""`, `toggledTail = [...parts.slice(0, -1), toggled].join("/")` 로 입력 배열 비뮤테이트.                                                                                                                 |
| `worker/api/tests/[id]/compute.ts` | `computeFromAnswers` 루프 안에서 `scores[axis][direction]`, `percentages[first/second]`, `mbti +=` **로컬 객체/문자열 뮤테이트** | **수정**: `reduce`로 scores 누적(매 단계 새 객체 반환), `reduce`로 percentages, `map().join("")`로 mbti 생성. 상수 `INITIAL_SCORES`/`INITIAL_PERCENTAGES` 사용.                                                                                           |
| `public/scripts/testquiz.js`       | `shuffleInPlace(list)`가 **인자 배열을 in-place 뮤테이트**; `buildShuffledQuestions`에서 `copied`/`q.answers` 뮤테이트           | **수정**: `shuffleInPlace` 제거, **`shuffleCopy(list)`** 도입(입력 불변, `[...list]` 복사 후 Fisher-Yates로 새 배열만 수정). `buildShuffledQuestions`는 `shuffleCopy(copied).map(q => ({ ...q, answers: shuffleCopy(q.answers \|\| []) }))` 로 불변 반환. |

---

## 11. 6차 검사 (FP/SOLID 재검사)

| 파일                           | 이슈                                                                                                                                     | 조치                                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/scripts/testquiz.js`   | `computeMbti()`에서 `result +=` 로 **문자열 뮤테이트**; `computePercentagesFromScores()`에서 `percentages[first] =` 로 **객체 뮤테이트** | **수정**: `computeMbti`는 `axes.map(...).join("")` 로 반환. `computePercentagesFromScores`는 `pairs.reduce((acc, ...) => ({ ...acc, [first]: ... }), { E:50, S:50, T:50, J:50 })` 로 불변 누적. |
| `public/scripts/admin/main.js` | `syncImagesToActiveTestFromStore`에서 `results[code] =` 로 **로컬 객체 뮤테이트**                                                        | **수정**: `MBTI_ORDER.reduce((acc, code) => { ... return { ...acc, [code]: { ... } }; }, { ...(active.results ?? {}) })` 로 results 객체 불변 생성.                                             |
| `public/scripts/config.js`     | `parseResizeOptions` 내부 `forEach`에서 **`out[key] =`, `out.quality/fit/format` 직접 대입**                                             | **수정**: `str.split(",").reduce((acc, pair) => { ... return { ...acc, [key]: n } \|\| acc; }, {})` 로 옵션 객체 불변 생성.                                                                     |

---

## 12. 7차 검사 (FP/SOLID 재검사)

| 파일                         | 이슈                                                                                                      | 조치                                                                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/scripts/testquiz.js` | `state.test =`, `state.scores =`, `state.answers =`, `state.currentIndex =` **직접 대입** (분산 뮤테이트) | **수정**: `const state` → `let state`, **`setQuizState(update)`** 도입 (`state = { ...state, ...update }`). 모든 state 갱신을 `setQuizState` 호출로 통일. |
| `public/scripts/config.js`   | `assetResizeUrl` 내부 **`params.push`** 로 쿼리 배열 구성; `parseSrcsetWidths` 내부 **`widths.push`**     | **수정**: `basePairs`/`extraPairs` filter+map으로 `params` 배열 생성. `parseSrcsetWidths`는 `list.map(...).filter(n => n != null)` 로 `widths` 반환.      |

---

## 13. 8차 검사 (Worker 배열 뮤테이트 제거)

| 파일                        | 이슈                                                         | 조치                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worker/assets/handler.ts`  | `buildCacheTagHeader` 내부 **`tags.push("test", m[1])`**     | **수정**: `const tags = m?.[1] ? ["assets", "test", m[1]] : ["assets"]` 로 한 번에 배열 생성.                                                                       |
| `worker/api/_utils/http.ts` | `withCacheHeaders` 내부 **`parts.push(...)` 3회**            | **수정**: `const parts = ["public", \`max-age=...\`, ...(조건 ? [s-maxage] : []), \`stale-while-revalidate=...\`, \`stale-if-error=...\`]` 로 스프레드로 배열 구성. |
| `worker/router.ts`          | `getTieredCacheCf` 내부 **`tags.push(\`test-${pathSeg}\`)`** | **수정**: `const tags = pathSeg ? ["assets", \`test-${pathSeg}\`] : ["assets"]` 로 한 번에 배열 생성.                                                               |

---

## 14. 9차 검사 (setState 내부 뮤테이트 제거)

| 파일                            | 이슈                                                                                  | 조치                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/scripts/admin/state.js` | `setState(update)` 내부에서 **`next.loading = { ... }`** 로 로컬 객체 `next` 뮤테이트 | **수정**: `next`를 한 번에 생성. `const next = { ...state, ...update, ...(update.loading != null && typeof update.loading === "object" ? { loading: { ...state.loading, ...update.loading } } : {}) }; state = next;` 로 `next`에 대한 대입 제거. |

---

## 15. 10차 검사 (scripts/ 빌드·정규화 스크립트 FP 적용)

| 파일                              | 이슈                                                                                                                                | 조치                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/generate_d1_seed.cjs`    | **`out.push`**, **`lines.push`** 로 배열 구성                                                                                       | **수정**: `discoverTests`는 `dirs.flatMap(...)` 반환. `discoverTestImages`는 `entries.filter().map().filter(Boolean)` 후 `[...out].sort(...)`. `main`은 `initialLines` + `discovered.flatMap(...)` 로 `lines` 한 번에 구성, `block.push("")` 제거 후 `return imageLines.length > 0 ? [...block, ""] : block`. |
| `scripts/normalize_test_json.cjs` | **`next.questions`/`next.results` 직접 대입**, **`qq.label`/`qq.id`/`aa.label`/`aa.id` 대입**, **`out[code]=`**, **`touched.push`** | **수정**: `normalizeTestJson`을 순수 함수로 재작성 — `questions`/`results`를 map·reduce로 새 객체만 반환, 인자 불변. `main`의 `touched`는 `testDirs.flatMap(...)` 로 생성.                                                                                                                                    |

---

## 16. 11차 검사 (in-place sort 제거)

| 파일                           | 이슈                                                                                              | 조치                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/generate_d1_seed.cjs` | `discoverTests` 내부 **`.map((e) => e.name).sort(...)`** 가 map 반환 배열을 **in-place 뮤테이트** | **수정**: `const dirs = [...entries.filter(...).map((e) => e.name)].sort((a, b) => a.localeCompare(b));` 로 정렬 전에 복사본 사용. |
