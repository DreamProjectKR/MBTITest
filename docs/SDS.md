# SDS (Software Design Specification)

## 1. High-Level Design

### 1.1 Modules

- Frontend
  - Static HTML pages in `public/*.html`
  - Page controllers in `public/scripts/*.js`
  - Runtime configuration in `public/scripts/config.js`
- Backend (Pages Functions)
  - Test index endpoint: `functions/api/tests/index.js`
  - Test detail endpoint: `functions/api/tests/[id].js`
- Content
  - `assets/index.json` and per-test JSON/images

### 1.2 Responsibilities

- `public/scripts/config.js`
  - Defines runtime variables:
    - `window.ASSETS_BASE` (default empty; used to build asset URLs)
    - `window.API_TESTS_BASE` (default `/api/tests`)
    - `window.TEST_INDEX_PATH` (default `assets/index.json`)
  - Defines helpers:
    - `window.assetUrl(path)`: builds absolute URL for assets
    - `window.resolveTestDataUrl(rawPath)`: resolves index `path` to absolute URL
    - `window.getTestIndex()`: memoized fetch of `window.TEST_INDEX_URL`
  - Applies `data-asset-*` attribute injection to DOM.

- `functions/api/tests/index.js`
  - Reads R2 key `assets/index.json`.
  - Returns JSON (or `{ "tests": [] }` if missing) with cache headers and optional ETag.

- `functions/api/tests/[id].js`
  - Reads `assets/index.json`, finds matching `tests[].id`.
  - Normalizes `tests[].path` to an R2 key (ensuring `assets/` prefix).
  - Fetches test JSON and returns with cache headers and optional ETag.

## 1.3 Asset Loading (Current)

- Images and other assets are loaded directly from the public R2 base URL (absolute URLs).
- The frontend uses `public/scripts/config.js` (`window.assetUrl`) to build absolute URLs from `assets/...` paths.

## 2. Data Flow

### 2.1 Test Listing

1. Browser loads `public/index.html` or `public/testlist.html`.
2. JS fetches `GET /api/tests`.
3. Backend reads `assets/index.json` from R2 and returns `{ tests: [...] }`.
4. Frontend renders cards and navigates with `testId` querystring.

### 2.2 Test Execution

1. Intro/Quiz/Result fetch `GET /api/tests/:id`.
2. Backend finds `id` in index and returns the referenced test JSON.
3. Quiz renders questions and records scores.
4. Quiz navigates to result page with `result` parameter.
5. Result page reads `results[MBTI].image` and renders it.

## 2.3 Page Controllers (Current Implementation)

### `public/scripts/main.js` (home)

- Fetches `window.API_TESTS_BASE || "/api/tests"`.
- Normalizes and sorts tests by `updatedAt || createdAt`.
- Renders:
  - "new tests" up to 4
  - "top tests" up to 8
- Card click navigates to `testintro.html?testId=<id>`.

### `public/scripts/testlist.js` (list)

- Fetches `window.API_TESTS_BASE || "/api/tests"`.
- De-dupes by `id-path` and sorts newest first.
- Renders cards in rows of 4.
- Note: there is a leftover click handler on `.test1` that navigates to `testintro.html` without a `testId`; the dynamic cards correctly include the querystring.

### `public/scripts/testintro.js` (intro)

- Reads `testId` from querystring.
- Fetches `GET /api/tests/:id`.
- Renders:
  - thumbnail (`thumbnail`)
  - tags (`tags[]`)
  - author and author image (`author`, `authorImg`)
  - description (supports string or array-of-strings; array is rendered as multiple `<p>` lines)
- Performance behavior:
  - After rendering, the script warms the browser cache by preloading image assets referenced in the returned test JSON (e.g., `questions[].prompt`, `results[*].image`, plus any other image-like string paths found).
  - Preloading is staged via `requestIdleCallback` (fallback `setTimeout`) and uses `Image().src` with a conservative file-extension filter; the implementation caps how many images are queued to avoid overwhelming the network.
- Start button navigates to `testquiz.html?testId=...`.
- Share uses Web Share API if available; otherwise copies URL to clipboard.

### `public/scripts/testquiz.js` (quiz)

- Reads `testId`, fetches `GET /api/tests/:id`.
- Renders question prompt as image (`questions[].prompt`) and answer buttons from `questions[].answers`.
- Maintains a progress bar element and updates ARIA progress attributes.
- Scoring:
  - `mbtiAxis` chooses which axis bucket (EI/SN/TF/JP)
  - `direction` increments E/I/S/N/T/F/J/P within that axis bucket
  - tie-breaker chooses E, S, T, J on equal counts
- On completion navigates to `testresult.html?testId=...&result=MBTI`.

### `public/scripts/testresult.js` (result)

- Reads `testId` and `result` query params.
- Fetches `GET /api/tests/:id`.
- Renders `results[result].image` into the result image.
- The script tries to bind `dom.titleEl` via `.ResultShellTextBox h2`, but the current `public/testresult.html` does not contain an `h2` inside `.ResultShellTextBox`; in practice, title rendering is best-effort and `document.title` still updates.
- Restart navigates back to `testquiz.html?testId=...`.
- Share uses Web Share API if available; otherwise copies URL to clipboard.

## 3. Configuration and Environment

- Backend binding (required): `MBTI_BUCKET` (R2 bucket).
- Backend vars (observed in `wrangler.toml`):
  - `ASSETS_BASE`
  - `R2_PUBLIC_BASE_URL`
- Frontend runtime variables are set through `public/scripts/config.js` defaults or by injecting `window.*` variables earlier in HTML.

### 3.1 Frontend Runtime Config Details (`public/scripts/config.js`)

- Defaults:
  - `DEFAULT_ASSETS_BASE = ""`
  - `DEFAULT_API_TESTS_BASE = "/api/tests"`
  - `DEFAULT_TEST_INDEX_PATH = "assets/index.json"`
- `window.assetUrl(path)` behavior:
  - If `path` is absolute (`http(s)://`), return it as-is.
  - Else, prefix with `window.ASSETS_BASE` and normalize leading slashes.
- `window.TEST_INDEX_URL` default behavior:
  - If not set by the page, `config.js` assigns it to `window.API_TESTS_BASE` (which defaults to `/api/tests`).
  - Practically, the \"index\" is fetched via the API endpoint (not by directly requesting `assets/index.json` from a public bucket).

## 4. Caching Design

- API responses set `Cache-Control` and support `ETag` / `If-None-Match`.
- Public R2 asset caching is handled at the R2/public URL layer (outside this repo).

## 5. Error Handling

- Backend returns JSON errors for missing binding, missing id, missing files, invalid JSON.
- Frontend logs errors and renders fallback messages (intro/quiz/result).

## 6. Known Design Deviations

- README references an admin workflow/page that is not present. Current design is read-only from the end-user perspective.
