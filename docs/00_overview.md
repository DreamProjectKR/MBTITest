# MBTI Test Hub Overview

## Purpose

This repository is a static MBTI-test hub (HTML/CSS/JS) deployed on Cloudflare Pages, with Pages Functions providing:

- A small JSON API for listing tests and fetching a test by id
- An R2-backed asset proxy so the frontend can load images/JSON from the same origin

The frontend renders:

- Home page: featured and newest tests
- Test list page: all tests
- Test intro page: per-test landing page
- Test quiz page: question flow and MBTI computation
- Test result page: per-result image rendering and share/restart

## Architecture At A Glance

- Static frontend: `public/`
- Serverless backend (Pages Functions): `functions/`
- Content/data (source for R2 upload): `assets/`

## Key Endpoints (Same Origin)

- Test index: `GET /api/tests`
- Test detail: `GET /api/tests/:id`
- Asset proxy: `GET /assets/*`

### Runtime Building Blocks

- Cloudflare Pages
  - Serves static content from `public/`
  - Routes `functions/` as Pages Functions
- Cloudflare R2 (bound into Pages Functions)
  - Stores `assets/index.json`, test JSON files (`assets/<test-id>/test.json`), and images

## Directory Map

- `public/`
  - `index.html`: home
  - `testlist.html`: list of tests
  - `testintro.html`: intro for a specific test (`?testId=...`)
  - `testquiz.html`: quiz runner (`?testId=...`)
  - `testresult.html`: result page (`?testId=...&result=...`)
  - `scripts/config.js`: runtime config + asset URL helpers
  - `scripts/*.js`: page controllers
  - `styles/*.css`: styling
- `functions/`
  - `api/tests/index.js`: `GET /api/tests`
  - `api/tests/[id].js`: `GET /api/tests/:id`
  - `assets/[[path]].js`: `GET /assets/*` (R2 proxy)
- `assets/`
  - `index.json`: test index metadata used by the API
  - `assets/test-summer/test.json`: sample test definition (in this repo)
  - `images/`: shared images
  - `test-summer/images/`: test-specific images

## Key User Flows

### 1) Browse tests

- Home (`public/index.html`) fetches `/api/tests` to populate newest/top sections.
- List (`public/testlist.html`) fetches `/api/tests` and renders a grid.

### 2) Take a test

- Intro (`public/testintro.html?testId=...`) fetches `/api/tests/:id` and renders meta (thumbnail/tags/author/description). It also warms the cache by preloading images referenced inside the returned test JSON (question prompts/result images), so quiz/result pages avoid cold image fetches.
- Quiz (`public/testquiz.html?testId=...`) fetches `/api/tests/:id` and runs the question flow.
- Quiz computes MBTI by summing per-axis scores from answers and sends user to:
  - `public/testresult.html?testId=...&result=ENFP` (example)

### 2.1) Page-to-Script Mapping (Frontend)

- `public/index.html` -> `public/scripts/main.js` (loads `/api/tests`, renders two sections)
- `public/testlist.html` -> `public/scripts/testlist.js` (loads `/api/tests`, renders list in rows)
- `public/testintro.html` -> `public/scripts/testintro.js` (loads `/api/tests/:id`, start/share buttons)
- `public/testquiz.html` -> `public/scripts/testquiz.js` (loads `/api/tests/:id`, renders quiz/progress, computes MBTI)
- `public/testresult.html` -> `public/scripts/testresult.js` (loads `/api/tests/:id`, uses `results[MBTI].image`)

### 3) Load images and JSON safely

- `public/scripts/config.js` provides `window.assetUrl()` and attribute injection so HTML can reference assets via `data-asset-src`/`data-asset-href`.
- `functions/assets/[[path]].js` proxies `/assets/*` from R2, enabling same-origin loading for images/JSON.

## Routing

- Root `_routes.json` and `public/_routes.json` currently include:
  - `/api/*`
  - `/assets/*`

## Known Gaps / Notes

- `README.md` describes an admin page/workflow (`public/admin.html`), but the current `public/` directory does not contain an admin page. Documents treat admin as out-of-scope for the current repo state.

## Where To Look Next

- Product and scope: [MRD](./MRD.md), [PRD](./PRD.md), [SOW](./SOW.md)
- Requirements/spec: [SRS](./SRS.md), [IRS](./IRS.md)
- Design/implementation mapping: [SDS](./SDS.md)
- Data schemas: [Appendix: Data Schema](./appendix_data_schema.md)
- Deployment and env vars: [Appendix: Deploy Runbook](./appendix_deploy_runbook.md)
